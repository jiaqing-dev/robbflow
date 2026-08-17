from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from robbflow_agent import plan_from_prompt
from robbflow_api.db import get_db
from robbflow_api.deps import CurrentContext, get_current
from robbflow_api.events import emit
from robbflow_api.schemas import AgentPlanIn, WorkItemOut
from robbflow_api.services.workflow import load_definition_for_item
from robbflow_domain.enums import EventType
from robbflow_domain.models import Project, WorkItem

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/plan")
async def plan(
    body: AgentPlanIn,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = plan_from_prompt(body.prompt)
    created: list[WorkItemOut] = []
    if body.apply:
        if body.project_id is None:
            raise HTTPException(422, "project_id required when apply=true")
        project = await db.scalar(
            select(Project).where(
                Project.id == body.project_id, Project.workspace_id == ctx.workspace.id
            )
        )
        if project is None:
            raise HTTPException(404, "Project not found")
        for planned in result.items:
            key = f"{project.key_prefix}-{project.next_number}"
            project.next_number += 1
            item = WorkItem(
                workspace_id=ctx.workspace.id,
                project_id=project.id,
                type=planned.type,
                key=key,
                title=planned.title,
                status="todo",
                priority=planned.priority,
                creator_id=ctx.user.id,
                assignee_id=ctx.user.id,
                position=float(project.next_number),
            )
            db.add(item)
            await db.flush()
            definition = await load_definition_for_item(db, item)
            item.status = definition.initial_state()
            await emit(
                db,
                event_type=EventType.WORK_ITEM_CREATED,
                payload={"key": item.key, "type": item.type, "priority": item.priority},
                workspace_id=ctx.workspace.id,
                actor_id=ctx.user.id,
                entity_type="work_item",
                entity_id=item.id,
                action="created",
            )
            created.append(
                WorkItemOut(
                    id=item.id,
                    project_id=item.project_id,
                    type=item.type,
                    key=item.key,
                    title=item.title,
                    description=item.description,
                    status=item.status,
                    priority=item.priority,
                    creator_id=item.creator_id,
                    assignee_id=item.assignee_id,
                    parent_id=item.parent_id,
                    position=item.position,
                    properties=item.properties or {},
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                    project_name=project.name,
                )
            )
        await db.commit()
    return {
        "summary": result.summary,
        "items": [{"type": i.type, "title": i.title, "priority": i.priority} for i in result.items],
        "created": created,
    }
