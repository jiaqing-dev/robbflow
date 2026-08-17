"""Load persisted workflow definitions (Feishu-style: data, not code)."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from robbflow_domain.models import Workflow, WorkItem, WorkItemTypeSchema
from robbflow_workflow import DEFAULT_WORKFLOW, WorkflowDefinition, definition_from_records


def definition_from_orm(wf: Workflow) -> WorkflowDefinition:
    states = sorted(wf.states, key=lambda s: s.position)
    return definition_from_records(
        wf.key,
        wf.name,
        [
            {
                "key": s.key,
                "name": s.name,
                "category": s.category,
                "color": s.color,
                "position": s.position,
            }
            for s in states
        ],
        [
            {"from_state": t.from_state, "to_state": t.to_state, "name": t.name}
            for t in wf.transitions
        ],
    )


async def get_workspace_workflows(db: AsyncSession, workspace_id: UUID) -> list[Workflow]:
    result = await db.scalars(
        select(Workflow)
        .options(selectinload(Workflow.states), selectinload(Workflow.transitions))
        .where(Workflow.workspace_id == workspace_id)
        .order_by(Workflow.created_at)
    )
    return list(result)


async def load_definition_for_item(db: AsyncSession, item: WorkItem) -> WorkflowDefinition:
    type_row = await db.scalar(
        select(WorkItemTypeSchema).where(
            WorkItemTypeSchema.workspace_id == item.workspace_id,
            WorkItemTypeSchema.key == item.type,
        )
    )
    workflow_id = type_row.workflow_id if type_row else None
    wf = None
    if workflow_id:
        wf = await db.scalar(
            select(Workflow)
            .options(selectinload(Workflow.states), selectinload(Workflow.transitions))
            .where(Workflow.id == workflow_id)
        )
    if wf is None:
        wf = await db.scalar(
            select(Workflow)
            .options(selectinload(Workflow.states), selectinload(Workflow.transitions))
            .where(Workflow.workspace_id == item.workspace_id, Workflow.is_default.is_(True))
        )
    if wf is None:
        return DEFAULT_WORKFLOW
    return definition_from_orm(wf)


async def load_definition_for_type(
    db: AsyncSession, workspace_id: UUID, type_key: str
) -> WorkflowDefinition:
    type_row = await db.scalar(
        select(WorkItemTypeSchema).where(
            WorkItemTypeSchema.workspace_id == workspace_id,
            WorkItemTypeSchema.key == type_key,
        )
    )
    workflow_id = type_row.workflow_id if type_row else None
    wf = None
    if workflow_id:
        wf = await db.scalar(
            select(Workflow)
            .options(selectinload(Workflow.states), selectinload(Workflow.transitions))
            .where(Workflow.id == workflow_id)
        )
    if wf is None:
        return await load_default_definition(db, workspace_id)
    return definition_from_orm(wf)


async def load_default_definition(db: AsyncSession, workspace_id: UUID) -> WorkflowDefinition:
    wf = await db.scalar(
        select(Workflow)
        .options(selectinload(Workflow.states), selectinload(Workflow.transitions))
        .where(Workflow.workspace_id == workspace_id, Workflow.is_default.is_(True))
    )
    if wf is None:
        return DEFAULT_WORKFLOW
    return definition_from_orm(wf)
