"""Bootstrap Feishu-like defaults: work item types + editable workflows."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from robbflow_domain.association import PROJECT_TYPE_KEY
from robbflow_domain.detail_layout import default_layout
from robbflow_domain.models import (
    Workflow,
    WorkflowState,
    WorkflowTransition,
    WorkItem,
    WorkItemTypeSchema,
)
from robbflow_workflow import LEGACY_STATUS_MAP, WORKFLOW_PRESETS

_EN_STATE_NAMES = {
    "Backlog",
    "Todo",
    "In Progress",
    "In Review",
    "Testing",
    "Done",
    "Cancelled",
    "Idea",
    "Discovery",
    "PRD",
    "Development",
    "Launch",
}
_EN_WF_NAMES = {"Engineering", "Product"}
_EN_TYPE_NAMES = {"Issue": "事项", "Action": "行动项"}


def _port(type_key: str, relation: str = "relates_to", label: str | None = None) -> dict:
    return {"type_key": type_key, "relation": relation, "label": label}


TYPE_SPECS: list[dict] = [
    {
        "key": "requirement",
        "name": "需求",
        "icon": "target",
        "color": "#8b5cf6",
        "workflow": "product",
        "description": "可关联到项目；向下分解功能点、任务与测试。",
        "layout_x": 260.0,
        "layout_y": 80.0,
        "fields": [
            {
                "key": "source",
                "name": "来源",
                "type": "select",
                "options": ["客户", "内部", "数据反馈", "线上问题"],
            },
            {"key": "value", "name": "业务价值", "type": "text"},
        ],
        "inputs": [_port(PROJECT_TYPE_KEY, "belongs_to", "归属项目")],
        "outputs": [
            _port("feature", "parent_of", "分解为功能点"),
            _port("task", "implements", "拆解任务"),
            _port("bug", "relates_to", "相关缺陷"),
            _port("test_task", "tested_by", "测试任务"),
            _port("issue", "derived_from", "转事项"),
        ],
    },
    {
        "key": "feature",
        "name": "功能点",
        "icon": "layers",
        "color": "#a78bfa",
        "workflow": "product",
        "description": "需求拆出的可交付功能，可再关联任务与测试。",
        "layout_x": 520.0,
        "layout_y": 40.0,
        "fields": [{"key": "module", "name": "模块", "type": "text"}],
        "inputs": [_port("requirement", "belongs_to", "归属需求")],
        "outputs": [
            _port("task", "implements", "实现任务"),
            _port("bug", "relates_to", "相关缺陷"),
            _port("test_task", "tested_by", "测试任务"),
        ],
    },
    {
        "key": "task",
        "name": "任务",
        "icon": "check",
        "color": "#38bdf8",
        "workflow": "engineering",
        "description": "具体执行工作。",
        "layout_x": 780.0,
        "layout_y": 20.0,
        "fields": [{"key": "estimate", "name": "估时(h)", "type": "number"}],
        "inputs": [
            _port("requirement", "implements", "实现需求"),
            _port("feature", "implements", "实现功能点"),
            _port("bug", "fixed_by", "修复缺陷"),
            _port("issue", "relates_to", "关联事项"),
        ],
        "outputs": [_port("test_task", "tested_by", "提测")],
    },
    {
        "key": "bug",
        "name": "缺陷",
        "icon": "bug",
        "color": "#fb7185",
        "workflow": "bug",
        "description": "可挂到需求、功能点或任务上。",
        "layout_x": 780.0,
        "layout_y": 180.0,
        "fields": [
            {
                "key": "severity",
                "name": "严重程度",
                "type": "select",
                "options": ["P0", "P1", "P2", "P3"],
            },
            {
                "key": "environment",
                "name": "环境",
                "type": "select",
                "options": ["开发", "测试", "预发", "生产"],
            },
            {"key": "version", "name": "版本", "type": "text"},
            {"key": "steps", "name": "复现步骤", "type": "textarea"},
            {"key": "expected", "name": "期望结果", "type": "textarea"},
            {"key": "actual", "name": "实际结果", "type": "textarea"},
        ],
        "inputs": [
            _port("requirement", "relates_to", "相关需求"),
            _port("feature", "relates_to", "相关功能点"),
            _port("task", "relates_to", "相关任务"),
            _port("issue", "relates_to", "来自事项"),
        ],
        "outputs": [
            _port("task", "fixed_by", "修复任务"),
            _port("test_task", "tested_by", "验证测试"),
        ],
    },
    {
        "key": "issue",
        "name": "事项",
        "icon": "circle",
        "color": "#94a3b8",
        "workflow": "engineering",
        "description": "通用事项，可标记为缺陷 / 需求 / 任务并互相关联。",
        "layout_x": 520.0,
        "layout_y": 220.0,
        "fields": [
            {
                "key": "kind",
                "name": "事项类型",
                "type": "select",
                "options": ["缺陷", "需求", "任务"],
            },
        ],
        "inputs": [_port("requirement", "derived_from", "来自需求")],
        "outputs": [
            _port("bug", "relates_to", "转缺陷"),
            _port("requirement", "relates_to", "转需求"),
            _port("task", "relates_to", "转任务"),
        ],
    },
    {
        "key": "test_task",
        "name": "测试任务",
        "icon": "flask",
        "color": "#fbbf24",
        "workflow": "test_task",
        "description": "可自定义测试流程，并关联需求、功能点、缺陷等模块。",
        "layout_x": 1040.0,
        "layout_y": 80.0,
        "fields": [
            {
                "key": "stage",
                "name": "测试阶段",
                "type": "select",
                "options": ["冒烟", "功能", "回归", "性能"],
            },
            {
                "key": "env",
                "name": "环境",
                "type": "select",
                "options": ["开发", "测试", "预发", "生产"],
            },
        ],
        "inputs": [
            _port("requirement", "tested_by", "测需求"),
            _port("feature", "tested_by", "测功能点"),
            _port("task", "tested_by", "测任务"),
            _port("bug", "tested_by", "验证缺陷"),
        ],
        "outputs": [_port("test_case", "covers", "覆盖用例")],
    },
    {
        "key": "test_case",
        "name": "用例",
        "icon": "list",
        "color": "#eab308",
        "workflow": "test_case",
        "description": "测试用例，归属测试任务或需求。",
        "layout_x": 1040.0,
        "layout_y": 240.0,
        "fields": [
            {"key": "precondition", "name": "前置条件", "type": "textarea"},
            {"key": "steps", "name": "测试步骤", "type": "textarea"},
            {"key": "expected", "name": "期望结果", "type": "textarea"},
            {
                "key": "result",
                "name": "最近结果",
                "type": "select",
                "options": ["未测", "通过", "失败", "阻塞"],
            },
        ],
        "inputs": [
            _port("test_task", "covers", "归属测试任务"),
            _port("requirement", "covers", "覆盖需求"),
        ],
        "outputs": [],
    },
    {
        "key": "improvement",
        "name": "改进",
        "icon": "spark",
        "color": "#34d399",
        "workflow": "engineering",
        "description": "体验或质量改进。",
        "layout_x": 260.0,
        "layout_y": 280.0,
        "fields": [],
        "inputs": [_port(PROJECT_TYPE_KEY, "belongs_to", "归属项目")],
        "outputs": [_port("task", "implements", "落地任务")],
    },
    {
        "key": "incident",
        "name": "事故",
        "icon": "alert",
        "color": "#f43f5e",
        "workflow": "engineering",
        "description": "线上事故。",
        "layout_x": 780.0,
        "layout_y": 340.0,
        "fields": [
            {
                "key": "severity",
                "name": "级别",
                "type": "select",
                "options": ["SEV-1", "SEV-2", "SEV-3"],
            },
        ],
        "inputs": [_port(PROJECT_TYPE_KEY, "belongs_to", "归属项目")],
        "outputs": [
            _port("task", "fixed_by", "止血任务"),
            _port("bug", "derived_from", "转缺陷"),
        ],
    },
    {
        "key": "action",
        "name": "行动项",
        "icon": "zap",
        "color": "#fb923c",
        "workflow": "engineering",
        "description": "会议或评审产生的待办。",
        "layout_x": 520.0,
        "layout_y": 380.0,
        "fields": [],
        "inputs": [_port("issue", "relates_to", "来自事项")],
        "outputs": [_port("task", "implements", "转任务")],
    },
    {
        "key": "risk",
        "name": "风险",
        "icon": "shield",
        "color": "#f59e0b",
        "workflow": "engineering",
        "description": "项目风险跟踪。",
        "layout_x": 260.0,
        "layout_y": 400.0,
        "fields": [],
        "inputs": [_port(PROJECT_TYPE_KEY, "belongs_to", "归属项目")],
        "outputs": [_port("task", "implements", "应对任务")],
    },
    {
        "key": "ticket",
        "name": "工单",
        "icon": "inbox",
        "color": "#fb923c",
        "workflow": "ticket",
        "description": "申请 → 审批 → 处理 → 关闭。",
        "layout_x": 1040.0,
        "layout_y": 400.0,
        "fields": [
            {
                "key": "category",
                "name": "类别",
                "type": "select",
                "options": ["IT", "行政", "采购", "其他"],
            },
        ],
        "inputs": [_port(PROJECT_TYPE_KEY, "belongs_to", "归属项目")],
        "outputs": [_port("task", "implements", "落地任务")],
    },
]


def _state_layout(index: int, key: str, total: int) -> tuple[float, float]:
    if key == "cancelled":
        return (80 + max(total - 2, 0) * 320, 300.0)
    return (80.0 + index * 320.0, 96.0)


def _localize_workflow(wf: Workflow, states: list[WorkflowState]) -> None:
    preset = WORKFLOW_PRESETS.get(wf.key)
    if preset and (wf.name in _EN_WF_NAMES or wf.name == wf.key):
        wf.name = preset.name
    names = {s.key: s.name for s in (preset.states if preset else WORKFLOW_PRESETS["engineering"].states)}
    for st in states:
        if st.key in names and (st.name in _EN_STATE_NAMES or st.name == st.key):
            st.name = names[st.key]


async def bootstrap_workspace(db: AsyncSession, workspace_id: UUID) -> dict[str, Workflow]:
    """Idempotent: create default workflows + types if missing."""
    existing = {
        wf.key: wf
        for wf in await db.scalars(select(Workflow).where(Workflow.workspace_id == workspace_id))
    }
    created: dict[str, Workflow] = dict(existing)

    for key, preset in WORKFLOW_PRESETS.items():
        if key in created:
            wf = created[key]
            states = list(
                await db.scalars(select(WorkflowState).where(WorkflowState.workflow_id == wf.id))
            )
            _localize_workflow(wf, states)
            continue
        wf = Workflow(
            workspace_id=workspace_id,
            key=preset.key,
            name=preset.name,
            description="可在流程图中编辑状态与流转（对标飞书项目）",
            is_default=(key == "engineering"),
        )
        db.add(wf)
        await db.flush()
        visible = [s for s in preset.ordered_states() if s.key != "cancelled"]
        for state in preset.ordered_states():
            idx = state.position
            x, y = _state_layout(
                idx if state.key != "cancelled" else len(visible), state.key, len(visible)
            )
            db.add(
                WorkflowState(
                    workflow_id=wf.id,
                    key=state.key,
                    name=state.name,
                    category=state.category,
                    color=state.color,
                    position=state.position,
                    layout_x=x,
                    layout_y=y,
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
        created[key] = wf

    await db.flush()

    existing_types = {
        row.key: row
        for row in await db.scalars(
            select(WorkItemTypeSchema).where(WorkItemTypeSchema.workspace_id == workspace_id)
        )
    }
    for spec in TYPE_SPECS:
        wf = created.get(spec["workflow"])
        row = existing_types.get(spec["key"])
        if row is None:
            db.add(
                WorkItemTypeSchema(
                    workspace_id=workspace_id,
                    key=spec["key"],
                    name=spec["name"],
                    icon=spec["icon"],
                    color=spec["color"],
                    fields=spec["fields"],
                    workflow_id=wf.id if wf else None,
                    description=spec.get("description"),
                    inputs=spec.get("inputs") or [],
                    outputs=spec.get("outputs") or [],
                    layout_x=spec.get("layout_x"),
                    layout_y=spec.get("layout_y"),
                    detail_layout=default_layout(spec["key"]),
                )
            )
            continue
        if row.name in _EN_TYPE_NAMES:
            row.name = _EN_TYPE_NAMES[row.name]
        if row.inputs is None:
            row.inputs = spec.get("inputs") or []
        if row.outputs is None:
            row.outputs = spec.get("outputs") or []
        if row.layout_x is None and row.layout_y is None:
            row.layout_x = spec.get("layout_x")
            row.layout_y = spec.get("layout_y")
        if not row.description:
            row.description = spec.get("description")
        if spec.get("fields"):
            existing_keys = {str(f.get("key")) for f in (row.fields or [])}
            extras = [f for f in spec["fields"] if f.get("key") not in existing_keys]
            if extras:
                row.fields = list(row.fields or []) + extras
        if not row.detail_layout:
            row.detail_layout = default_layout(spec["key"])
        target = created.get(spec["workflow"])
        eng_wf = created.get("engineering")
        if target:
            if not row.workflow_id:
                row.workflow_id = target.id
            elif spec["workflow"] != "engineering" and eng_wf and row.workflow_id == eng_wf.id:
                row.workflow_id = target.id
    await _remap_legacy_statuses(db, workspace_id)
    await db.flush()
    return created


async def _remap_legacy_statuses(db: AsyncSession, workspace_id: UUID) -> None:
    legacy = {old for mapping in LEGACY_STATUS_MAP.values() for old in mapping}
    if not legacy:
        return
    items = await db.scalars(
        select(WorkItem).where(
            WorkItem.workspace_id == workspace_id,
            WorkItem.status.in_(legacy),
        )
    )
    for item in items:
        mapping = LEGACY_STATUS_MAP.get(item.type)
        if not mapping:
            continue
        nxt = mapping.get(item.status)
        if nxt and nxt != item.status:
            item.status = nxt
