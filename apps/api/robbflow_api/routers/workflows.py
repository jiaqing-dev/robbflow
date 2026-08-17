from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from robbflow_api.bootstrap import bootstrap_workspace
from robbflow_api.db import get_db
from robbflow_api.deps import CurrentContext, get_current
from robbflow_api.events import emit
from robbflow_api.schemas import WorkflowCreate, WorkflowOut, WorkflowPut, WorkflowStateOut
from robbflow_domain.enums import EventType
from robbflow_domain.models import Workflow, WorkflowState, WorkflowTransition
from robbflow_workflow import WORKFLOW_PRESETS

router = APIRouter(prefix="/workflows", tags=["workflows"])


def _serialize(wf: Workflow) -> WorkflowOut:
    states = sorted(wf.states, key=lambda s: s.position)
    return WorkflowOut(
        id=wf.id,
        key=wf.key,
        name=wf.name,
        description=wf.description,
        is_default=wf.is_default,
        states=[
            WorkflowStateOut(
                key=s.key,
                name=s.name,
                category=s.category,
                color=s.color,
                position=s.position,
                layout_x=s.layout_x or 0,
                layout_y=s.layout_y or 0,
            )
            for s in states
        ],
        transitions=[
            {"from_state": t.from_state, "to_state": t.to_state, "name": t.name}
            for t in wf.transitions
        ],
        created_at=wf.created_at,
    )


async def _load(db: AsyncSession, workspace_id: UUID, workflow_id: str) -> Workflow:
    stmt = (
        select(Workflow)
        .options(selectinload(Workflow.states), selectinload(Workflow.transitions))
        .where(Workflow.workspace_id == workspace_id)
    )
    try:
        stmt = stmt.where(Workflow.id == UUID(workflow_id))
    except ValueError:
        stmt = stmt.where(Workflow.key == workflow_id)
    wf = await db.scalar(stmt)
    if wf is None:
        raise HTTPException(404, "Workflow not found")
    return wf


@router.get("", response_model=list[WorkflowOut])
async def list_workflows(
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> list[WorkflowOut]:
    await bootstrap_workspace(db, ctx.workspace.id)
    await db.commit()
    result = await db.scalars(
        select(Workflow)
        .options(selectinload(Workflow.states), selectinload(Workflow.transitions))
        .where(Workflow.workspace_id == ctx.workspace.id)
        .order_by(Workflow.created_at)
    )
    return [_serialize(wf) for wf in result]


@router.post("", response_model=WorkflowOut)
async def create_workflow(
    body: WorkflowCreate,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> WorkflowOut:
    preset = WORKFLOW_PRESETS.get(body.preset or "engineering")
    key = body.key or (body.name.lower().replace(" ", "-")[:64])
    exists = await db.scalar(
        select(Workflow).where(Workflow.workspace_id == ctx.workspace.id, Workflow.key == key)
    )
    if exists:
        raise HTTPException(409, "Workflow key already exists")
    wf = Workflow(
        workspace_id=ctx.workspace.id,
        key=key,
        name=body.name,
        description=body.description,
        is_default=body.is_default,
    )
    db.add(wf)
    await db.flush()
    for i, state in enumerate(preset.ordered_states()):
        db.add(
            WorkflowState(
                workflow_id=wf.id,
                key=state.key,
                name=state.name,
                category=state.category,
                color=state.color,
                position=state.position,
                layout_x=80 + i * 320,
                layout_y=96 if state.key != "cancelled" else 280,
            )
        )
    for trans in preset.transitions:
        db.add(
            WorkflowTransition(
                workflow_id=wf.id,
                from_state=trans.from_state,
                to_state=trans.to_state,
                name=trans.name,
            )
        )
    if body.is_default:
        others = await db.scalars(
            select(Workflow).where(Workflow.workspace_id == ctx.workspace.id, Workflow.id != wf.id)
        )
        for other in others:
            other.is_default = False
    await db.commit()
    return _serialize(await _load(db, ctx.workspace.id, str(wf.id)))


@router.get("/{workflow_id}", response_model=WorkflowOut)
async def get_workflow(
    workflow_id: str,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> WorkflowOut:
    return _serialize(await _load(db, ctx.workspace.id, workflow_id))


@router.put("/{workflow_id}", response_model=WorkflowOut)
async def replace_workflow(
    workflow_id: str,
    body: WorkflowPut,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> WorkflowOut:
    wf = await _load(db, ctx.workspace.id, workflow_id)
    if not body.states:
        raise HTTPException(422, "Workflow needs at least one state")
    keys = [s.key for s in body.states]
    if len(keys) != len(set(keys)):
        raise HTTPException(409, "保存失败：状态标识重复。请给每个节点一个唯一标识后再保存。")
    keyset = set(keys)
    for trans in body.transitions:
        if trans.from_state not in keyset or trans.to_state not in keyset:
            raise HTTPException(
                422, f"Transition {trans.from_state}→{trans.to_state} uses unknown state"
            )
    wf.name = body.name
    wf.description = body.description
    wf.is_default = body.is_default
    if body.is_default:
        others = await db.scalars(
            select(Workflow).where(Workflow.workspace_id == ctx.workspace.id, Workflow.id != wf.id)
        )
        for other in others:
            other.is_default = False

    # Update existing states in place. Delete+reinsert of the same (workflow_id, key)
    # hits the unique constraint because SQLAlchemy often INSERTs before DELETE.
    for trans in list(wf.transitions):
        await db.delete(trans)
    await db.flush()

    existing = {s.key: s for s in wf.states}
    for key, row in list(existing.items()):
        if key not in keyset:
            await db.delete(row)
            del existing[key]
    await db.flush()

    for state in body.states:
        row = existing.get(state.key)
        if row is None:
            db.add(
                WorkflowState(
                    workflow_id=wf.id,
                    key=state.key,
                    name=state.name,
                    category=state.category,
                    color=state.color,
                    position=state.position,
                    layout_x=state.layout_x,
                    layout_y=state.layout_y,
                )
            )
        else:
            row.name = state.name
            row.category = state.category
            row.color = state.color
            row.position = state.position
            row.layout_x = state.layout_x
            row.layout_y = state.layout_y
    for trans in body.transitions:
        db.add(
            WorkflowTransition(
                workflow_id=wf.id,
                from_state=trans.from_state,
                to_state=trans.to_state,
                name=trans.name,
            )
        )
    try:
        await emit(
            db,
            event_type=EventType.WORKFLOW_UPDATED,
            payload={"key": wf.key, "name": wf.name},
            workspace_id=ctx.workspace.id,
            actor_id=ctx.user.id,
            entity_type="workflow",
            entity_id=wf.id,
            action="updated",
        )
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(409, "保存失败：状态标识重复。请给新节点换一个唯一标识后再保存。") from exc
    return _serialize(await _load(db, ctx.workspace.id, str(wf.id)))
