from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from robbflow_api.bootstrap import bootstrap_workspace
from robbflow_api.db import get_db
from robbflow_api.deps import CurrentContext, get_current
from robbflow_api.schemas import TypeGraphPut, WorkItemTypeIn, WorkItemTypeOut
from robbflow_domain.models import WorkItemTypeSchema

router = APIRouter(prefix="/work-item-types", tags=["work-item-types"])


def _dump_ports(ports: list | None) -> list[dict]:
    if not ports:
        return []
    out = []
    for p in ports:
        if hasattr(p, "model_dump"):
            out.append(p.model_dump())
        else:
            out.append(dict(p))
    return out


def _apply_type_body(row: WorkItemTypeSchema, body: WorkItemTypeIn) -> None:
    row.name = body.name
    row.icon = body.icon
    row.color = body.color
    row.fields = body.fields
    row.workflow_id = body.workflow_id
    if body.description is not None:
        row.description = body.description
    if body.inputs is not None:
        row.inputs = _dump_ports(body.inputs)
    if body.outputs is not None:
        row.outputs = _dump_ports(body.outputs)
    if body.layout_x is not None:
        row.layout_x = body.layout_x
    if body.layout_y is not None:
        row.layout_y = body.layout_y
    if body.detail_layout is not None:
        row.detail_layout = body.detail_layout


@router.get("", response_model=list[WorkItemTypeOut])
async def list_types(
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> list[WorkItemTypeSchema]:
    await bootstrap_workspace(db, ctx.workspace.id)
    await db.commit()
    result = await db.scalars(
        select(WorkItemTypeSchema)
        .where(WorkItemTypeSchema.workspace_id == ctx.workspace.id)
        .order_by(WorkItemTypeSchema.created_at)
    )
    return list(result)


@router.post("", response_model=WorkItemTypeOut)
async def create_type(
    body: WorkItemTypeIn,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> WorkItemTypeSchema:
    key = (
        body.key or "".join(ch.lower() if ch.isalnum() else "_" for ch in body.name).strip("_")[:32]
    )
    exists = await db.scalar(
        select(WorkItemTypeSchema).where(
            WorkItemTypeSchema.workspace_id == ctx.workspace.id,
            WorkItemTypeSchema.key == key,
        )
    )
    if exists:
        raise HTTPException(409, "该类型标识已存在")
    row = WorkItemTypeSchema(
        workspace_id=ctx.workspace.id,
        key=key,
        name=body.name,
        icon=body.icon,
        color=body.color,
        fields=body.fields,
        workflow_id=body.workflow_id,
        description=body.description,
        inputs=_dump_ports(body.inputs),
        outputs=_dump_ports(body.outputs),
        layout_x=body.layout_x,
        layout_y=body.layout_y,
        detail_layout=body.detail_layout,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.put("/graph", response_model=list[WorkItemTypeOut])
async def save_type_graph(
    body: TypeGraphPut,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> list[WorkItemTypeSchema]:
    rows = {
        row.id: row
        for row in await db.scalars(
            select(WorkItemTypeSchema).where(WorkItemTypeSchema.workspace_id == ctx.workspace.id)
        )
    }
    by_key = {row.key: row for row in rows.values()}
    for node in body.nodes:
        row = rows.get(node.id)
        if row is None:
            continue
        row.layout_x = node.layout_x
        row.layout_y = node.layout_y
        if node.name is not None:
            row.name = node.name
        if node.color is not None:
            row.color = node.color
        if node.description is not None:
            row.description = node.description
        if node.fields is not None:
            row.fields = node.fields
        if "workflow_id" in node.model_fields_set:
            row.workflow_id = node.workflow_id
        if node.detail_layout is not None:
            row.detail_layout = node.detail_layout

    outputs: dict[str, list[dict]] = {key: [] for key in by_key}
    inputs: dict[str, list[dict]] = {key: [] for key in by_key}
    for edge in body.edges:
        port = {
            "type_key": edge.target_key,
            "relation": edge.relation,
            "label": edge.label,
        }
        in_port = {
            "type_key": edge.source_key,
            "relation": edge.relation,
            "label": edge.label,
        }
        if edge.source_key in outputs:
            outputs[edge.source_key].append(port)
        if edge.target_key in inputs:
            inputs[edge.target_key].append(in_port)

    for key, row in by_key.items():
        row.outputs = outputs.get(key, [])
        row.inputs = inputs.get(key, [])

    await db.commit()
    result = await db.scalars(
        select(WorkItemTypeSchema)
        .where(WorkItemTypeSchema.workspace_id == ctx.workspace.id)
        .order_by(WorkItemTypeSchema.created_at)
    )
    return list(result)


@router.put("/{type_id}", response_model=WorkItemTypeOut)
async def update_type(
    type_id: UUID,
    body: WorkItemTypeIn,
    ctx: CurrentContext = Depends(get_current),
    db: AsyncSession = Depends(get_db),
) -> WorkItemTypeSchema:
    row = await db.scalar(
        select(WorkItemTypeSchema).where(
            WorkItemTypeSchema.id == type_id,
            WorkItemTypeSchema.workspace_id == ctx.workspace.id,
        )
    )
    if row is None:
        raise HTTPException(404, "未找到该工作项类型")
    _apply_type_body(row, body)
    await db.commit()
    await db.refresh(row)
    return row
