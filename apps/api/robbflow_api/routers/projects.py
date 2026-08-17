from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from robbflow_api.db import get_db
from robbflow_api.deps import CurrentContext, get_current
from robbflow_api.events import emit
from robbflow_api.schemas import ProjectCreate, ProjectOut, ProjectUpdate, WorkItemOut
from robbflow_api.services.workflow import load_default_definition, load_definition_for_type
from robbflow_domain.enums import EventType
from robbflow_domain.models import Project, WorkItem, WorkItemTypeSchema
from robbflow_domain.templates import WORK_TEMPLATES, type_keys_for

router = APIRouter(prefix="/projects", tags=["projects"])


_TEMPLATE_KEYS = {row["key"] for row in WORK_TEMPLATES}


def _slugify(value: str) -> str:
    slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in value).strip("-")
    return slug[:64] or "project"


def _normalize_templates(keys: list[str] | None) -> list[str]:
    values = keys if keys is not None else ["engineering"]
    unknown = [key for key in values if key not in _TEMPLATE_KEYS]
    if unknown:
        raise HTTPException(400, f"未知工作模板: {', '.join(unknown)}")
    seen: set[str] = set()
    ordered: list[str] = []
    for key in values:
        if key not in seen:
            ordered.append(key)
            seen.add(key)
    return ordered


async def _get_project(db: AsyncSession, workspace_id: UUID, project_id: str) -> Project:
    filters = [Project.slug == project_id]
    try:
        filters.append(Project.id == UUID(project_id))
    except ValueError:
        pass
    project = await db.scalar(
        select(Project).where(Project.workspace_id == workspace_id, or_(*filters))
    )
    if project is None:
        raise HTTPException(404, "Project not found")
    return project


@router.get("", response_model=list[ProjectOut])
async def list_projects(
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> list[Project]:
    result = await db.scalars(
        select(Project)
        .where(Project.workspace_id == ctx.workspace.id)
        .order_by(Project.created_at.desc())
    )
    return list(result)


@router.post("", response_model=ProjectOut)
async def create_project(
    body: ProjectCreate,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> Project:
    slug = body.slug or _slugify(body.name)
    base = slug
    suffix = 2
    while await db.scalar(
        select(Project.id).where(Project.workspace_id == ctx.workspace.id, Project.slug == slug)
    ):
        slug = f"{base}-{suffix}"[:64]
        suffix += 1
    project = Project(
        workspace_id=ctx.workspace.id,
        name=body.name,
        slug=slug,
        description=body.description,
        key_prefix=body.key_prefix.upper()[:8],
        color=body.color,
        templates=_normalize_templates(body.templates),
    )
    db.add(project)
    await db.flush()
    await emit(
        db,
        event_type=EventType.PROJECT_CREATED,
        payload={"name": project.name, "id": str(project.id)},
        workspace_id=ctx.workspace.id,
        actor_id=ctx.user.id,
        entity_type="project",
        entity_id=project.id,
        action="created",
    )
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: str,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> Project:
    return await _get_project(db, ctx.workspace.id, project_id)


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: str,
    body: ProjectUpdate,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> Project:
    project = await _get_project(db, ctx.workspace.id, project_id)
    data = body.model_dump(exclude_unset=True)
    if "templates" in data:
        data["templates"] = _normalize_templates(data["templates"])
    if "key_prefix" in data and data["key_prefix"]:
        data["key_prefix"] = data["key_prefix"].upper()[:8]
    if "status" in data and data["status"] not in {"active", "archived", "paused"}:
        raise HTTPException(400, "状态仅支持 active / paused / archived")
    for key, value in data.items():
        setattr(project, key, value)
    await emit(
        db,
        event_type=EventType.PROJECT_UPDATED,
        payload={"name": project.name, "id": str(project.id), "fields": list(data)},
        workspace_id=ctx.workspace.id,
        actor_id=ctx.user.id,
        entity_type="project",
        entity_id=project.id,
        action="updated",
    )
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}/board")
async def project_board(
    project_id: str,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
    lane: str | None = Query(default=None, description="assignee | type | priority | sprint"),
    type: str | None = Query(default=None, description="work item type key; board columns follow that type's workflow"),
) -> dict:
    project = await _get_project(db, ctx.workspace.id, project_id)
    type_key = type or (type_keys_for(project.templates)[:1] or [None])[0]
    if type_key:
        definition = await load_definition_for_type(db, ctx.workspace.id, type_key)
    else:
        definition = await load_default_definition(db, ctx.workspace.id)
    stmt = (
        select(WorkItem)
        .options(selectinload(WorkItem.assignee))
        .where(WorkItem.project_id == project.id)
        .order_by(WorkItem.position, WorkItem.created_at)
    )
    if type_key:
        stmt = stmt.where(WorkItem.type == type_key)
    items = list(await db.scalars(stmt))
    serialized: list[WorkItemOut] = []
    for item in items:
        out = WorkItemOut.model_validate(item)
        out.project_name = project.name
        serialized.append(out)
    grouped: dict[str, list[WorkItemOut]] = {}
    for item in serialized:
        grouped.setdefault(item.status, []).append(item)
    closed = {
        s.key
        for s in definition.ordered_states()
        if s.category in {"completed", "cancelled"}
    }
    open_count = sum(1 for item in serialized if item.status not in closed)
    columns: list[dict] = []
    for state in definition.ordered_states():
        bucket = grouped.get(state.key, [])
        if state.category == "cancelled" and not bucket:
            continue
        columns.append(
            {
                "key": state.key,
                "name": state.name,
                "color": state.color,
                "category": state.category,
                "items": bucket,
            }
        )
    known = {c["key"] for c in columns}
    orphans = [item for item in serialized if item.status not in known]
    if orphans:
        columns.append(
            {
                "key": "_other",
                "name": "其他状态",
                "color": "#78716c",
                "category": "unstarted",
                "items": orphans,
            }
        )
    lanes = _build_lanes(serialized, lane) if lane else []
    type_row = None
    if type_key:
        type_row = await db.scalar(
            select(WorkItemTypeSchema).where(
                WorkItemTypeSchema.workspace_id == ctx.workspace.id,
                WorkItemTypeSchema.key == type_key,
            )
        )
    return {
        "project": ProjectOut.model_validate(project),
        "type_key": type_key,
        "type_name": type_row.name if type_row else None,
        "workflow": {
            "key": definition.key,
            "name": definition.name,
            "states": [
                {
                    "key": s.key,
                    "name": s.name,
                    "color": s.color,
                    "category": s.category,
                    "position": s.position,
                }
                for s in definition.ordered_states()
            ],
            "transitions": [
                {"from_state": t.from_state, "to_state": t.to_state, "name": t.name}
                for t in definition.transitions
            ],
        },
        "columns": columns,
        "lanes": lanes,
        "counts": {"total": len(items), "open": open_count},
    }


def _build_lanes(items: list[WorkItemOut], lane: str) -> list[dict]:
    buckets: dict[str, dict] = {}
    for item in items:
        if lane == "assignee":
            key = str(item.assignee_id) if item.assignee_id else "unassigned"
            name = item.assignee.name if item.assignee else "未指派"
        elif lane == "type":
            key = item.type
            name = {
                "requirement": "需求",
                "feature": "功能点",
                "task": "任务",
                "bug": "缺陷",
                "issue": "事项",
                "test_task": "测试任务",
                "test_case": "用例",
                "action": "行动项",
                "risk": "风险",
                "improvement": "改进",
                "incident": "事故",
            }.get(item.type, item.type)
        elif lane == "priority":
            key = item.priority
            name = {"urgent": "紧急", "high": "高", "medium": "中", "low": "低", "none": "无"}.get(
                item.priority, item.priority
            )
        elif lane == "sprint":
            key = str(item.sprint_id) if item.sprint_id else "backlog"
            name = "迭代" if item.sprint_id else "待规划"
        else:
            key = "all"
            name = "全部"
        bucket = buckets.setdefault(key, {"key": key, "name": name, "items_by_status": {}})
        bucket["items_by_status"].setdefault(item.status, []).append(item)
    return list(buckets.values())
