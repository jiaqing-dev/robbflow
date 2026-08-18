from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from robbflow_api.db import get_db
from robbflow_api.deps import CurrentContext, get_current
from robbflow_api.schemas import BindingIn, IntegrationSave
from robbflow_api.services.rbac import require_admin
from robbflow_api.services.workflow import load_definition_for_item
from robbflow_domain.models import IdentityBinding, IntegrationCredential, WorkItem
from robbflow_integrations import REGISTRY, NotifyCard, build_connector
from robbflow_workflow import InvalidTransitionError

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("")
async def list_integrations(
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    creds = {
        row.provider: row
        for row in await db.scalars(
            select(IntegrationCredential).where(
                IntegrationCredential.workspace_id == ctx.workspace.id
            )
        )
    }
    out = []
    for key, cls in REGISTRY.items():
        row = creds.get(key)
        connected = False
        if row and row.enabled:
            connector = build_connector(key, row.config)
            connected = await connector.test_connection()
        out.append(
            {
                "key": key,
                "name": getattr(cls, "name", key),
                "status": "connected" if connected else ("configured" if row else "planned"),
                "enabled": bool(row and row.enabled),
            }
        )
    return out


@router.put("/{provider}")
async def save_integration(
    provider: str,
    body: IntegrationSave,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    require_admin(ctx.role)
    if provider not in REGISTRY:
        raise HTTPException(404, "未知集成")
    row = await db.scalar(
        select(IntegrationCredential).where(
            IntegrationCredential.workspace_id == ctx.workspace.id,
            IntegrationCredential.provider == provider,
        )
    )
    if row is None:
        row = IntegrationCredential(
            workspace_id=ctx.workspace.id,
            provider=provider,
            config=body.config,
            enabled=body.enabled,
        )
        db.add(row)
    else:
        merged = dict(row.config or {})
        merged.update(body.config)
        row.config = merged
        row.enabled = body.enabled
    await db.commit()
    connector = build_connector(provider, row.config)
    ok = await connector.test_connection()
    return {"ok": True, "connected": ok, "provider": provider}


@router.post("/{provider}/test")
async def test_integration(
    provider: str,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    if provider not in REGISTRY:
        raise HTTPException(404, "未知集成")
    row = await db.scalar(
        select(IntegrationCredential).where(
            IntegrationCredential.workspace_id == ctx.workspace.id,
            IntegrationCredential.provider == provider,
        )
    )
    connector = build_connector(provider, row.config if row else {})
    ok = await connector.test_connection()
    return {"ok": ok}


@router.post("/oa/callback")
async def oa_callback(
    payload: dict[str, Any],
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Inbound OA webhook: {work_item_id, status} advances the workflow if legal."""
    item_id = payload.get("work_item_id") or payload.get("key")
    status = payload.get("status")
    if not item_id or not status:
        raise HTTPException(422, "需要 work_item_id 与 status")
    try:
        uid = UUID(str(item_id))
        item = await db.scalar(
            select(WorkItem).where(WorkItem.id == uid, WorkItem.workspace_id == ctx.workspace.id)
        )
    except ValueError:
        item = await db.scalar(
            select(WorkItem).where(
                WorkItem.key == str(item_id).upper(), WorkItem.workspace_id == ctx.workspace.id
            )
        )
    if item is None:
        raise HTTPException(404, "工作项不存在")
    definition = await load_definition_for_item(db, item)
    try:
        definition.validate_transition(item.status, status)
    except InvalidTransitionError as exc:
        raise HTTPException(422, str(exc)) from exc
    item.status = status
    await db.commit()
    return {"ok": True, "key": item.key, "status": item.status}


@router.get("/bindings")
async def list_bindings(
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, str]]:
    rows = await db.scalars(
        select(IdentityBinding).where(
            IdentityBinding.user_id == ctx.user.id,
            IdentityBinding.workspace_id == ctx.workspace.id,
        )
    )
    return [{"provider": r.provider, "external_id": r.external_id} for r in rows]


@router.post("/bindings")
async def bind_identity(
    body: BindingIn,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    if body.provider not in {"feishu", "dingtalk", "wecom"}:
        raise HTTPException(422, "仅支持绑定飞书 / 钉钉 / 企微账号")
    existing = await db.scalar(
        select(IdentityBinding).where(
            IdentityBinding.user_id == ctx.user.id,
            IdentityBinding.workspace_id == ctx.workspace.id,
            IdentityBinding.provider == body.provider,
        )
    )
    if existing:
        existing.external_id = body.external_id
    else:
        db.add(
            IdentityBinding(
                user_id=ctx.user.id,
                workspace_id=ctx.workspace.id,
                provider=body.provider,
                external_id=body.external_id,
            )
        )
    await db.commit()
    return {"provider": body.provider, "external_id": body.external_id}


@router.get("/oidc/{provider}")
async def oidc_start(provider: str, ctx: CurrentContext = Depends(get_current)) -> dict[str, Any]:
    if provider not in {"feishu", "dingtalk"}:
        raise HTTPException(404, "不支持的登录方式")
    return {
        "status": "not_configured",
        "provider": provider,
        "hint": "社区版请在设置中绑定 IM 账号。扫码 OIDC 为企业版预留。",
        "authorize_url": None,
    }


async def dispatch_status_notify(
    db: AsyncSession, ctx: CurrentContext, item: WorkItem, to_status: str
) -> None:
    creds = list(
        await db.scalars(
            select(IntegrationCredential).where(
                IntegrationCredential.workspace_id == ctx.workspace.id,
                IntegrationCredential.enabled.is_(True),
            )
        )
    )
    bindings = {
        row.provider: row.external_id
        for row in await db.scalars(
            select(IdentityBinding).where(
                IdentityBinding.workspace_id == ctx.workspace.id,
                IdentityBinding.user_id == (item.assignee_id or ctx.user.id),
            )
        )
    }
    card = NotifyCard(title=f"{item.key} → {to_status}", body=item.title)
    for cred in creds:
        if cred.provider not in {"feishu", "dingtalk", "wecom", "oa"}:
            continue
        external = bindings.get(cred.provider) or "open"
        connector = build_connector(cred.provider, cred.config)
        await connector.notify(external, card)
