from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from robbflow_api.db import get_db
from robbflow_api.deps import CurrentContext, get_current
from robbflow_api.events import emit
from robbflow_api.schemas import MilestoneCreate, MilestoneOut, SprintCreate, SprintOut
from robbflow_domain.enums import EventType
from robbflow_domain.models import Milestone, Sprint, WorkItem

router = APIRouter(tags=["cycles"])


def _sprint_out(row: Sprint, count: int) -> SprintOut:
    return SprintOut(
        id=row.id,
        project_id=row.project_id,
        name=row.name,
        goal=row.goal,
        start_at=row.start_at,
        end_at=row.end_at,
        status=row.status,
        item_count=count,
    )


def _milestone_out(row: Milestone, count: int) -> MilestoneOut:
    return MilestoneOut(
        id=row.id,
        project_id=row.project_id,
        name=row.name,
        description=row.description,
        due_at=row.due_at,
        status=row.status,
        item_count=count,
    )


@router.get("/sprints", response_model=list[SprintOut])
async def list_sprints(
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
    project_id: UUID | None = None,
) -> list[SprintOut]:
    stmt = (
        select(Sprint)
        .where(Sprint.workspace_id == ctx.workspace.id)
        .order_by(Sprint.start_at.desc())
    )
    if project_id:
        stmt = stmt.where(Sprint.project_id == project_id)
    rows = list(await db.scalars(stmt))
    out = []
    for row in rows:
        count = await db.scalar(
            select(func.count()).select_from(WorkItem).where(WorkItem.sprint_id == row.id)
        )
        out.append(_sprint_out(row, count or 0))
    return out


@router.post("/sprints", response_model=SprintOut)
async def create_sprint(
    body: SprintCreate,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> SprintOut:
    row = Sprint(
        workspace_id=ctx.workspace.id,
        project_id=body.project_id,
        name=body.name,
        goal=body.goal,
        start_at=body.start_at,
        end_at=body.end_at,
        status=body.status,
    )
    if body.status == "active":
        await _deactivate_others(db, ctx.workspace.id, body.project_id)
    db.add(row)
    await db.flush()
    await emit(
        db,
        event_type=EventType.SPRINT_UPDATED,
        payload={"name": row.name, "status": row.status},
        workspace_id=ctx.workspace.id,
        actor_id=ctx.user.id,
        entity_type="sprint",
        entity_id=row.id,
        action="created",
    )
    await db.commit()
    await db.refresh(row)
    return _sprint_out(row, 0)


@router.patch("/sprints/{sprint_id}", response_model=SprintOut)
async def update_sprint(
    sprint_id: UUID,
    body: SprintCreate,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> SprintOut:
    row = await db.scalar(
        select(Sprint).where(Sprint.id == sprint_id, Sprint.workspace_id == ctx.workspace.id)
    )
    if row is None:
        raise HTTPException(404, "Sprint not found")
    row.name = body.name
    row.goal = body.goal
    row.start_at = body.start_at
    row.end_at = body.end_at
    row.status = body.status
    if body.status == "active":
        await _deactivate_others(db, ctx.workspace.id, row.project_id, except_id=row.id)
    await db.commit()
    count = await db.scalar(
        select(func.count()).select_from(WorkItem).where(WorkItem.sprint_id == row.id)
    )
    return _sprint_out(row, count or 0)


@router.get("/milestones", response_model=list[MilestoneOut])
async def list_milestones(
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
    project_id: UUID | None = None,
) -> list[MilestoneOut]:
    stmt = (
        select(Milestone)
        .where(Milestone.workspace_id == ctx.workspace.id)
        .order_by(Milestone.due_at.nulls_last())
    )
    if project_id:
        stmt = stmt.where(Milestone.project_id == project_id)
    rows = list(await db.scalars(stmt))
    out = []
    for row in rows:
        count = await db.scalar(
            select(func.count()).select_from(WorkItem).where(WorkItem.milestone_id == row.id)
        )
        out.append(_milestone_out(row, count or 0))
    return out


@router.post("/milestones", response_model=MilestoneOut)
async def create_milestone(
    body: MilestoneCreate,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> MilestoneOut:
    row = Milestone(
        workspace_id=ctx.workspace.id,
        project_id=body.project_id,
        name=body.name,
        description=body.description,
        due_at=body.due_at,
        status=body.status,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _milestone_out(row, 0)


@router.patch("/milestones/{milestone_id}", response_model=MilestoneOut)
async def update_milestone(
    milestone_id: UUID,
    body: MilestoneCreate,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> MilestoneOut:
    row = await db.scalar(
        select(Milestone).where(
            Milestone.id == milestone_id, Milestone.workspace_id == ctx.workspace.id
        )
    )
    if row is None:
        raise HTTPException(404, "Milestone not found")
    row.name = body.name
    row.description = body.description
    row.due_at = body.due_at
    row.status = body.status
    await db.commit()
    count = await db.scalar(
        select(func.count()).select_from(WorkItem).where(WorkItem.milestone_id == row.id)
    )
    return _milestone_out(row, count or 0)


async def _deactivate_others(
    db: AsyncSession, workspace_id: UUID, project_id: UUID, except_id: UUID | None = None
) -> None:
    stmt = select(Sprint).where(
        Sprint.workspace_id == workspace_id,
        Sprint.project_id == project_id,
        Sprint.status == "active",
    )
    if except_id:
        stmt = stmt.where(Sprint.id != except_id)
    for row in await db.scalars(stmt):
        row.status = "planned"
