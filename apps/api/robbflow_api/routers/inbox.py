from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from robbflow_api.db import get_db
from robbflow_api.deps import CurrentContext, get_current
from robbflow_api.schemas import ActivityOut, WorkItemOut
from robbflow_domain.models import Activity, WorkItem

router = APIRouter(tags=["inbox"])


def _serialize(item: WorkItem) -> WorkItemOut:
    out = WorkItemOut.model_validate(item)
    if item.project is not None:
        out.project_name = item.project.name
    return out


@router.get("/inbox", response_model=list[WorkItemOut])
async def inbox(
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> list[WorkItemOut]:
    items = list(
        await db.scalars(
            select(WorkItem)
            .options(selectinload(WorkItem.assignee), selectinload(WorkItem.project))
            .where(
                WorkItem.workspace_id == ctx.workspace.id,
                or_(WorkItem.assignee_id == ctx.user.id, WorkItem.assignee_id.is_(None)),
                WorkItem.status.notin_(["done", "cancelled"]),
            )
            .order_by(WorkItem.updated_at.desc())
            .limit(50)
        )
    )
    return [_serialize(i) for i in items]


@router.get("/my-work", response_model=list[WorkItemOut])
async def my_work(
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> list[WorkItemOut]:
    items = list(
        await db.scalars(
            select(WorkItem)
            .options(selectinload(WorkItem.assignee), selectinload(WorkItem.project))
            .where(
                WorkItem.workspace_id == ctx.workspace.id,
                WorkItem.assignee_id == ctx.user.id,
            )
            .order_by(WorkItem.updated_at.desc())
            .limit(100)
        )
    )
    return [_serialize(i) for i in items]


@router.get("/activity", response_model=list[ActivityOut])
async def workspace_activity(
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> list[Activity]:
    result = await db.scalars(
        select(Activity)
        .where(Activity.workspace_id == ctx.workspace.id)
        .order_by(Activity.created_at.desc())
        .limit(40)
    )
    return list(result)


@router.get("/search", response_model=list[WorkItemOut])
async def search(
    q: str,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> list[WorkItemOut]:
    like = f"%{q}%"
    items = list(
        await db.scalars(
            select(WorkItem)
            .options(selectinload(WorkItem.assignee), selectinload(WorkItem.project))
            .where(
                WorkItem.workspace_id == ctx.workspace.id,
                or_(
                    WorkItem.title.ilike(like),
                    WorkItem.key.ilike(like),
                    WorkItem.description.ilike(like),
                ),
            )
            .limit(30)
        )
    )
    return [_serialize(i) for i in items]
