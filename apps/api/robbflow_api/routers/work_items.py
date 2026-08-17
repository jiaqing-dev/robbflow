from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from robbflow_api.db import get_db
from robbflow_api.deps import CurrentContext, get_current
from robbflow_api.events import emit
from robbflow_api.schemas import (
    ActivityOut,
    CommentCreate,
    CommentOut,
    RelationCreate,
    RelationOut,
    WorkItemCreate,
    WorkItemLinkCreate,
    WorkItemLinkOut,
    WorkItemOut,
    WorkItemUpdate,
)
from robbflow_api.services.workflow import load_definition_for_item
from robbflow_domain.association import association_allowed
from robbflow_domain.enums import EventType, RelationType
from robbflow_domain.feishu_docs import InvalidDocLinkError, parse_feishu_doc
from robbflow_domain.graph import build_trace_graph, serialize_graph
from robbflow_domain.models import (
    Activity,
    Comment,
    Project,
    WorkItem,
    WorkItemLink,
    WorkItemRelation,
    WorkItemTypeSchema,
)
from robbflow_workflow import InvalidTransitionError

router = APIRouter(prefix="/work-items", tags=["work-items"])


def _serialize(item: WorkItem) -> WorkItemOut:
    out = WorkItemOut.model_validate(item)
    if item.project is not None:
        out.project_name = item.project.name
    return out


@router.get("", response_model=list[WorkItemOut])
async def list_work_items(
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
    project_id: UUID | None = None,
    assignee: str | None = Query(default=None, description="me | unassigned | uuid"),
    status: str | None = None,
    type: str | None = None,
    sprint_id: UUID | None = None,
    milestone_id: UUID | None = None,
    q: str | None = None,
    limit: int = Query(default=100, le=500),
) -> list[WorkItemOut]:
    stmt = (
        select(WorkItem)
        .options(
            selectinload(WorkItem.assignee),
            selectinload(WorkItem.project),
            selectinload(WorkItem.creator),
        )
        .where(WorkItem.workspace_id == ctx.workspace.id)
        .order_by(WorkItem.updated_at.desc())
        .limit(limit)
    )
    if project_id:
        stmt = stmt.where(WorkItem.project_id == project_id)
    if status:
        stmt = stmt.where(WorkItem.status == status)
    if type:
        stmt = stmt.where(WorkItem.type == type)
    if sprint_id:
        stmt = stmt.where(WorkItem.sprint_id == sprint_id)
    if milestone_id:
        stmt = stmt.where(WorkItem.milestone_id == milestone_id)
    if assignee == "me":
        stmt = stmt.where(WorkItem.assignee_id == ctx.user.id)
    elif assignee == "unassigned":
        stmt = stmt.where(WorkItem.assignee_id.is_(None))
    elif assignee:
        stmt = stmt.where(WorkItem.assignee_id == UUID(assignee))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(WorkItem.title.ilike(like), WorkItem.key.ilike(like)))
    items = list(await db.scalars(stmt))
    return [_serialize(i) for i in items]


@router.post("", response_model=WorkItemOut)
async def create_work_item(
    body: WorkItemCreate,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> WorkItemOut:
    project = await db.scalar(
        select(Project).where(
            Project.id == body.project_id, Project.workspace_id == ctx.workspace.id
        )
    )
    if project is None:
        raise HTTPException(404, "Project not found")

    item = WorkItem(
        workspace_id=ctx.workspace.id,
        project_id=project.id,
        type=body.type,
        key=f"{project.key_prefix}-{project.next_number}",
        title=body.title,
        description=body.description,
        status="todo",
        priority=body.priority,
        creator_id=ctx.user.id,
        assignee_id=body.assignee_id,
        parent_id=body.parent_id,
        properties=body.properties,
        sprint_id=body.sprint_id,
        milestone_id=body.milestone_id,
        position=float(project.next_number),
    )
    project.next_number += 1
    db.add(item)
    await db.flush()
    definition = await load_definition_for_item(db, item)
    item.status = body.status or definition.initial_state()
    if body.status:
        keys = definition.state_map()
        if body.status not in keys:
            raise HTTPException(422, f"Unknown status {body.status}")
    db.add(item)
    await db.flush()
    await emit(
        db,
        event_type=EventType.WORK_ITEM_CREATED,
        payload={
            "id": str(item.id),
            "key": item.key,
            "type": item.type,
            "priority": item.priority,
            "title": item.title,
        },
        workspace_id=ctx.workspace.id,
        actor_id=ctx.user.id,
        entity_type="work_item",
        entity_id=item.id,
        action="created",
    )
    await db.commit()
    item = await db.scalar(
        select(WorkItem)
        .options(
            selectinload(WorkItem.assignee),
            selectinload(WorkItem.project),
            selectinload(WorkItem.creator),
        )
        .where(WorkItem.id == item.id)
    )
    return _serialize(item)


@router.get("/{item_id}", response_model=WorkItemOut)
async def get_work_item(
    item_id: str,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> WorkItemOut:
    item = await _load(db, ctx, item_id)
    return _serialize(item)


@router.patch("/{item_id}", response_model=WorkItemOut)
async def update_work_item(
    item_id: str,
    body: WorkItemUpdate,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> WorkItemOut:
    item = await _load(db, ctx, item_id)
    data = body.model_dump(exclude_unset=True)
    if "status" in data and data["status"] is not None:
        definition = await load_definition_for_item(db, item)
        try:
            definition.validate_transition(item.status, data["status"])
        except InvalidTransitionError as exc:
            raise HTTPException(422, str(exc)) from exc
        old = item.status
        item.status = data.pop("status")
        await emit(
            db,
            event_type=EventType.WORK_ITEM_MOVED,
            payload={"key": item.key, "from": old, "to": item.status},
            workspace_id=ctx.workspace.id,
            actor_id=ctx.user.id,
            entity_type="work_item",
            entity_id=item.id,
            action="moved",
        )
    if "properties" in data and data["properties"] is not None:
        merged = dict(item.properties or {})
        merged.update(data["properties"])
        item.properties = merged
        data.pop("properties")
    for field, value in data.items():
        setattr(item, field, value)
    await emit(
        db,
        event_type=EventType.WORK_ITEM_UPDATED,
        payload={"key": item.key, "fields": list(data.keys())},
        workspace_id=ctx.workspace.id,
        actor_id=ctx.user.id,
        entity_type="work_item",
        entity_id=item.id,
        action="updated",
    )
    await db.commit()
    item = await _load(db, ctx, str(item.id))
    return _serialize(item)


@router.get("/{item_id}/comments", response_model=list[CommentOut])
async def list_comments(
    item_id: str,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> list[Comment]:
    item = await _load(db, ctx, item_id)
    result = await db.scalars(
        select(Comment)
        .options(selectinload(Comment.author))
        .where(Comment.work_item_id == item.id)
        .order_by(Comment.created_at)
    )
    return list(result)


@router.post("/{item_id}/comments", response_model=CommentOut)
async def add_comment(
    item_id: str,
    body: CommentCreate,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> Comment:
    item = await _load(db, ctx, item_id)
    comment = Comment(work_item_id=item.id, author_id=ctx.user.id, body=body.body)
    db.add(comment)
    await db.flush()
    await emit(
        db,
        event_type=EventType.COMMENT_CREATED,
        payload={"key": item.key, "body": body.body[:200]},
        workspace_id=ctx.workspace.id,
        actor_id=ctx.user.id,
        entity_type="work_item",
        entity_id=item.id,
        action="commented",
    )
    await db.commit()
    comment = await db.scalar(
        select(Comment).options(selectinload(Comment.author)).where(Comment.id == comment.id)
    )
    return comment


@router.get("/{item_id}/links", response_model=list[WorkItemLinkOut])
async def list_links(
    item_id: str,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> list[WorkItemLink]:
    item = await _load(db, ctx, item_id)
    result = await db.scalars(
        select(WorkItemLink)
        .where(WorkItemLink.work_item_id == item.id)
        .order_by(WorkItemLink.created_at)
    )
    return list(result)


@router.post("/{item_id}/links", response_model=WorkItemLinkOut)
async def add_link(
    item_id: str,
    body: WorkItemLinkCreate,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> WorkItemLink:
    item = await _load(db, ctx, item_id)
    try:
        parsed = parse_feishu_doc(body.url)
    except InvalidDocLinkError as exc:
        raise HTTPException(422, str(exc)) from exc
    link = WorkItemLink(
        work_item_id=item.id,
        url=parsed["url"],
        title=(body.title or parsed["title"]).strip() or parsed["title"],
        provider=parsed["provider"],
        kind=parsed["kind"],
    )
    db.add(link)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(409, "该飞书文档已经引用过了") from exc
    await emit(
        db,
        event_type=EventType.WORK_ITEM_UPDATED,
        payload={"key": item.key, "url": link.url},
        workspace_id=ctx.workspace.id,
        actor_id=ctx.user.id,
        entity_type="work_item",
        entity_id=item.id,
        action="linked_doc",
    )
    await db.commit()
    await db.refresh(link)
    return link


@router.delete("/{item_id}/links/{link_id}")
async def delete_link(
    item_id: str,
    link_id: UUID,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    item = await _load(db, ctx, item_id)
    link = await db.scalar(
        select(WorkItemLink).where(WorkItemLink.id == link_id, WorkItemLink.work_item_id == item.id)
    )
    if not link:
        raise HTTPException(404, "文档引用不存在")
    await db.delete(link)
    await emit(
        db,
        event_type=EventType.WORK_ITEM_UPDATED,
        payload={"key": item.key, "url": link.url},
        workspace_id=ctx.workspace.id,
        actor_id=ctx.user.id,
        entity_type="work_item",
        entity_id=item.id,
        action="unlinked_doc",
    )
    await db.commit()
    return {"ok": True}


@router.get("/{item_id}/activity", response_model=list[ActivityOut])
async def list_activity(
    item_id: str,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> list[Activity]:
    item = await _load(db, ctx, item_id)
    result = await db.scalars(
        select(Activity)
        .where(Activity.entity_id == item.id)
        .order_by(Activity.created_at.desc())
        .limit(50)
    )
    return list(result)


@router.get("/{item_id}/relations", response_model=list[RelationOut])
async def list_relations(
    item_id: str,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> list[RelationOut]:
    item = await _load(db, ctx, item_id)
    rels = list(
        await db.scalars(
            select(WorkItemRelation).where(
                (WorkItemRelation.source_id == item.id) | (WorkItemRelation.target_id == item.id)
            )
        )
    )
    ids = {r.source_id for r in rels} | {r.target_id for r in rels}
    others = (
        {w.id: w for w in await db.scalars(select(WorkItem).where(WorkItem.id.in_(ids)))}
        if ids
        else {}
    )
    out: list[RelationOut] = []
    for rel in rels:
        src = others.get(rel.source_id)
        tgt = others.get(rel.target_id)
        out.append(
            RelationOut(
                id=rel.id,
                source_id=rel.source_id,
                target_id=rel.target_id,
                relation_type=rel.relation_type,
                source_key=src.key if src else None,
                source_title=src.title if src else None,
                target_key=tgt.key if tgt else None,
                target_title=tgt.title if tgt else None,
            )
        )
    return out


@router.post("/{item_id}/relations", response_model=RelationOut)
async def add_relation(
    item_id: str,
    body: RelationCreate,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> RelationOut:
    item = await _load(db, ctx, item_id)
    if body.relation_type not in {t.value for t in RelationType}:
        raise HTTPException(422, "未知的关联类型")
    target = await _load(db, ctx, str(body.target_id))
    schemas = {
        row.key: row
        for row in await db.scalars(
            select(WorkItemTypeSchema).where(WorkItemTypeSchema.workspace_id == ctx.workspace.id)
        )
    }
    src_schema = schemas.get(item.type)
    tgt_schema = schemas.get(target.type)
    if not association_allowed(
        item.type,
        target.type,
        src_schema.outputs if src_schema else None,
        tgt_schema.inputs if tgt_schema else None,
        body.relation_type,
    ):
        src_name = src_schema.name if src_schema else item.type
        tgt_name = tgt_schema.name if tgt_schema else target.type
        raise HTTPException(422, f"「{src_name}」不能关联到「{tgt_name}」，请在流程设计中配置输入/输出")
    rel = WorkItemRelation(source_id=item.id, target_id=target.id, relation_type=body.relation_type)
    db.add(rel)
    await db.commit()
    await db.refresh(rel)
    return RelationOut(
        id=rel.id,
        source_id=rel.source_id,
        target_id=rel.target_id,
        relation_type=rel.relation_type,
        source_key=item.key,
        source_title=item.title,
        target_key=target.key,
        target_title=target.title,
    )


@router.delete("/{item_id}/relations/{relation_id}")
async def delete_relation(
    item_id: str,
    relation_id: UUID,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> dict:
    item = await _load(db, ctx, item_id)
    rel = await db.get(WorkItemRelation, relation_id)
    if rel is None or (rel.source_id != item.id and rel.target_id != item.id):
        raise HTTPException(404, "Relation not found")
    await db.delete(rel)
    await db.commit()
    return {"ok": True}


@router.get("/{item_id}/graph")
async def item_graph(
    item_id: str,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
    depth: int = Query(default=4, ge=1, le=8),
) -> dict:
    item = await _load(db, ctx, item_id)
    rels = list(
        await db.scalars(
            select(WorkItemRelation).where(
                WorkItemRelation.source_id.in_(
                    select(WorkItem.id).where(WorkItem.workspace_id == ctx.workspace.id)
                )
            )
        )
    )
    tuples = [(r.source_id, r.target_id, r.relation_type, r.id) for r in rels]
    node_ids, edges = build_trace_graph(item.id, tuples, depth=depth)
    items = (
        {
            w.id: w
            for w in await db.scalars(
                select(WorkItem)
                .options(
                    selectinload(WorkItem.assignee),
                    selectinload(WorkItem.project),
                    selectinload(WorkItem.creator),
                )
                .where(WorkItem.id.in_(node_ids))
            )
        }
        if node_ids
        else {}
    )
    nodes = {
        wid: {
            "id": str(w.id),
            "key": w.key,
            "title": w.title,
            "type": w.type,
            "status": w.status,
            "priority": w.priority,
            "project_name": w.project.name if w.project else None,
        }
        for wid, w in items.items()
    }
    return serialize_graph(item.id, nodes, edges)


async def _load(db: AsyncSession, ctx: CurrentContext, item_id: str) -> WorkItem:
    stmt = (
        select(WorkItem)
        .options(
            selectinload(WorkItem.assignee),
            selectinload(WorkItem.project),
            selectinload(WorkItem.creator),
        )
        .where(WorkItem.workspace_id == ctx.workspace.id)
    )
    try:
        stmt = stmt.where(WorkItem.id == UUID(item_id))
    except ValueError:
        stmt = stmt.where(WorkItem.key == item_id.upper())
    item = await db.scalar(stmt)
    if item is None:
        raise HTTPException(404, "Work item not found")
    return item
