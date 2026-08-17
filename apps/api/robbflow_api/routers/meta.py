from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from robbflow_api.db import get_db
from robbflow_api.deps import CurrentContext, get_current
from robbflow_api.schemas import WorkspaceOut
from robbflow_domain.models import Membership, User
from robbflow_domain.templates import WORK_TEMPLATES
from robbflow_integrations import REGISTRY

router = APIRouter(tags=["meta"])


@router.get("/workspaces/current", response_model=WorkspaceOut)
async def current_workspace(ctx: CurrentContext = Depends(get_current)) -> WorkspaceOut:
    return WorkspaceOut.model_validate(ctx.workspace)


@router.get("/members")
async def members(
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    rows = await db.execute(
        select(User, Membership.role)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.workspace_id == ctx.workspace.id)
    )
    return [{"id": str(u.id), "name": u.name, "email": u.email, "role": role} for u, role in rows]


@router.get("/integrations")
async def integrations() -> list[dict]:
    return [{"key": k, "name": cls.name, "status": "planned"} for k, cls in REGISTRY.items()]


@router.get("/work-templates")
async def work_templates() -> list[dict]:
    return WORK_TEMPLATES
