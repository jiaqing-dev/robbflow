from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from robbflow_api.db import get_db
from robbflow_api.deps import CurrentContext, get_current
from robbflow_api.events import emit
from robbflow_api.schemas import (
    DocumentCreate,
    DocumentOut,
    NotificationOut,
    SavedViewIn,
    SavedViewOut,
)
from robbflow_domain.doc_refs import parse_doc_url
from robbflow_domain.enums import EventType
from robbflow_domain.feishu_docs import InvalidDocLinkError
from robbflow_domain.models import Document, Notification, Project, SavedView, WorkItem

router = APIRouter(tags=["collab"])


@router.get("/notifications", response_model=list[NotificationOut])
async def list_notifications(
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
    unread: bool = False,
) -> list[Notification]:
    stmt = (
        select(Notification)
        .where(
            Notification.workspace_id == ctx.workspace.id,
            Notification.recipient_id == ctx.user.id,
        )
        .order_by(Notification.created_at.desc())
        .limit(80)
    )
    if unread:
        stmt = stmt.where(Notification.read_at.is_(None))
    return list(await db.scalars(stmt))


@router.post("/notifications/{note_id}/read")
async def read_notification(
    note_id: UUID,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    row = await db.scalar(
        select(Notification).where(
            Notification.id == note_id, Notification.recipient_id == ctx.user.id
        )
    )
    if row is None:
        raise HTTPException(404, "通知不存在")
    row.read_at = datetime.now(UTC)
    await db.commit()
    return {"ok": True}


@router.post("/notifications/read-all")
async def read_all_notifications(
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    rows = await db.scalars(
        select(Notification).where(
            Notification.recipient_id == ctx.user.id,
            Notification.read_at.is_(None),
        )
    )
    now = datetime.now(UTC)
    for row in rows:
        row.read_at = now
    await db.commit()
    return {"ok": True}


@router.get("/views", response_model=list[SavedViewOut])
async def list_views(
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
    project_id: UUID | None = None,
) -> list[SavedView]:
    stmt = select(SavedView).where(SavedView.workspace_id == ctx.workspace.id)
    if project_id:
        stmt = stmt.where((SavedView.project_id == project_id) | (SavedView.project_id.is_(None)))
    return list(await db.scalars(stmt.order_by(SavedView.created_at)))


@router.post("/views", response_model=SavedViewOut)
async def create_view(
    body: SavedViewIn,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> SavedView:
    row = SavedView(
        workspace_id=ctx.workspace.id,
        project_id=body.project_id,
        created_by=ctx.user.id,
        name=body.name,
        filters=body.filters,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/views/{view_id}")
async def delete_view(
    view_id: UUID,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    row = await db.scalar(
        select(SavedView).where(SavedView.id == view_id, SavedView.workspace_id == ctx.workspace.id)
    )
    if row is None:
        raise HTTPException(404, "视图不存在")
    await db.delete(row)
    await db.commit()
    return {"ok": True}


@router.get("/documents", response_model=list[DocumentOut])
async def list_documents(
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
    project_id: UUID | None = None,
    work_item_id: UUID | None = None,
) -> list[Document]:
    stmt = select(Document).where(Document.workspace_id == ctx.workspace.id).order_by(Document.created_at.desc())
    if project_id:
        stmt = stmt.where(Document.project_id == project_id)
    if work_item_id:
        stmt = stmt.where(Document.work_item_id == work_item_id)
    return list(await db.scalars(stmt))


@router.post("/documents", response_model=DocumentOut)
async def create_document(
    body: DocumentCreate,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> Document:
    project_id = body.project_id
    work_item_id = body.work_item_id
    if work_item_id:
        item = await db.scalar(
            select(WorkItem).where(
                WorkItem.id == work_item_id, WorkItem.workspace_id == ctx.workspace.id
            )
        )
        if item is None:
            raise HTTPException(404, "工作项不存在")
        project_id = item.project_id
    elif project_id:
        project = await db.scalar(
            select(Project).where(
                Project.id == project_id, Project.workspace_id == ctx.workspace.id
            )
        )
        if project is None:
            raise HTTPException(404, "项目不存在")
    title = body.title or "未命名文档"
    provider = body.provider or "note"
    url = body.url
    kind = body.kind
    mime = "text/markdown" if kind == "note" else None
    external_id = None
    if url:
        try:
            parsed = parse_doc_url(url)
        except InvalidDocLinkError as exc:
            raise HTTPException(422, str(exc)) from exc
        provider = parsed["provider"]
        kind = parsed["kind"]
        title = body.title or parsed["title"]
        url = parsed["url"]
    elif kind == "note":
        provider = "note"
        title = body.title or "短文"
    else:
        raise HTTPException(422, "请粘贴链接或写一篇短文")
    row = Document(
        workspace_id=ctx.workspace.id,
        project_id=project_id,
        work_item_id=work_item_id,
        provider=provider,
        kind=kind,
        title=title,
        url=url,
        mime=mime,
        external_id=external_id,
        body=body.body,
    )
    db.add(row)
    await emit(
        db,
        event_type=EventType.DOCUMENT_CREATED,
        payload={"title": title, "provider": provider},
        workspace_id=ctx.workspace.id,
        actor_id=ctx.user.id,
        entity_type="document",
        entity_id=ctx.user.id,
        action="created_doc",
    )
    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: UUID,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    row = await db.scalar(
        select(Document).where(Document.id == doc_id, Document.workspace_id == ctx.workspace.id)
    )
    if row is None:
        raise HTTPException(404, "文档不存在")
    await db.delete(row)
    await db.commit()
    return {"ok": True}
