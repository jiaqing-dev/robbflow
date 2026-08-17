"""In-memory / persisted workflow engine.

Workflows are data, not hardcoded if/else. Teams define their own states.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from robbflow_domain.enums import StateCategory


class InvalidTransitionError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class State:
    key: str
    name: str
    category: StateCategory = StateCategory.UNSTARTED
    color: str = "#64748b"
    position: int = 0


@dataclass(frozen=True, slots=True)
class Transition:
    from_state: str
    to_state: str
    name: str | None = None
    require_role: str | None = None
    require_approver: bool = False


@dataclass
class WorkflowDefinition:
    key: str
    name: str
    states: list[State] = field(default_factory=list)
    transitions: list[Transition] = field(default_factory=list)

    def state_map(self) -> dict[str, State]:
        return {s.key: s for s in self.states}

    def find_transition(self, from_state: str, to_state: str) -> Transition | None:
        return next(
            (t for t in self.transitions if t.from_state == from_state and t.to_state == to_state),
            None,
        )

    def can_transition(self, from_state: str, to_state: str) -> bool:
        if from_state == to_state:
            return True
        return any(t.from_state == from_state and t.to_state == to_state for t in self.transitions)

    def validate_transition(self, from_state: str, to_state: str) -> None:
        keys = self.state_map()
        if to_state not in keys:
            raise InvalidTransitionError(f"Unknown state: {to_state}")
        if from_state not in keys:
            # Allow escaping a deleted / legacy status after the workflow was edited.
            return
        if not self.can_transition(from_state, to_state):
            raise InvalidTransitionError(
                f"Cannot move {from_state} → {to_state} in workflow {self.key}"
            )

    def initial_state(self) -> str:
        unstarted = [s for s in self.states if s.category == StateCategory.UNSTARTED]
        return (unstarted or self.states)[0].key

    def ordered_states(self) -> list[State]:
        return sorted(self.states, key=lambda s: s.position)

    def allowed_targets(self, from_state: str) -> list[str]:
        return [t.to_state for t in self.transitions if t.from_state == from_state]


def definition_from_records(
    key: str,
    name: str,
    states: list[dict],
    transitions: list[dict],
) -> WorkflowDefinition:
    parsed_states = [
        State(
            key=s["key"],
            name=s["name"],
            category=StateCategory(s.get("category", "unstarted")),
            color=s.get("color", "#64748b"),
            position=int(s.get("position", i)),
        )
        for i, s in enumerate(states)
    ]
    parsed_transitions = [
        Transition(
            from_state=t["from_state"],
            to_state=t["to_state"],
            name=t.get("name"),
            require_role=t.get("require_role"),
            require_approver=bool(t.get("require_approver")),
        )
        for t in transitions
    ]
    return WorkflowDefinition(
        key=key, name=name, states=parsed_states, transitions=parsed_transitions
    )


def sequential_transitions(
    keys: list[str], *, cancellable: str | None = "cancelled"
) -> list[Transition]:
    """Feishu-style process: forward, one-step back, optional cancel — not a complete graph."""
    out: list[Transition] = []
    for i, src in enumerate(keys):
        if i + 1 < len(keys):
            out.append(Transition(src, keys[i + 1], "前进"))
        if i > 0:
            out.append(Transition(src, keys[i - 1], "回退"))
        if cancellable and src != cancellable:
            out.append(Transition(src, cancellable, "取消"))
    return out


_BACK_LABELS = frozenset({"回退", "取消", "重开", "恢复"})


def is_diagram_transition(transition: Transition, states: list[State]) -> bool:
    """True when the edge belongs on the flowchart (forward / side-branch, not back or cancel)."""
    by_key = {s.key: s for s in states}
    src = by_key.get(transition.from_state)
    dst = by_key.get(transition.to_state)
    if src is None or dst is None:
        return False
    if src.category == StateCategory.CANCELLED or dst.category == StateCategory.CANCELLED:
        return False
    if transition.name in _BACK_LABELS:
        return False
    if dst.position < src.position:
        return False
    return True


def diagram_transitions(wf: WorkflowDefinition) -> list[Transition]:
    return [t for t in wf.transitions if is_diagram_transition(t, wf.states)]


def engineering_workflow() -> WorkflowDefinition:
    states = [
        State("backlog", "待规划", StateCategory.UNSTARTED, "#64748b", 0),
        State("todo", "待处理", StateCategory.UNSTARTED, "#94a3b8", 1),
        State("in_progress", "进行中", StateCategory.STARTED, "#3b82f6", 2),
        State("in_review", "评审中", StateCategory.STARTED, "#8b5cf6", 3),
        State("testing", "测试中", StateCategory.STARTED, "#eab308", 4),
        State("done", "已完成", StateCategory.COMPLETED, "#22c55e", 5),
        State("cancelled", "已取消", StateCategory.CANCELLED, "#78716c", 6),
    ]
    keys = [s.key for s in states if s.key != "cancelled"]
    return WorkflowDefinition("engineering", "研发流程", states, sequential_transitions(keys))


def product_workflow() -> WorkflowDefinition:
    states = [
        State("idea", "想法", StateCategory.UNSTARTED, "#64748b", 0),
        State("discovery", "调研", StateCategory.STARTED, "#06b6d4", 1),
        State("prd", "方案", StateCategory.STARTED, "#8b5cf6", 2),
        State("development", "研发", StateCategory.STARTED, "#3b82f6", 3),
        State("launch", "上线", StateCategory.COMPLETED, "#22c55e", 4),
        State("cancelled", "已取消", StateCategory.CANCELLED, "#78716c", 5),
    ]
    seq = ["idea", "discovery", "prd", "development", "launch"]
    return WorkflowDefinition("product", "产品流程", states, sequential_transitions(seq))


def bug_workflow() -> WorkflowDefinition:
    states = [
        State("open", "待处理", StateCategory.UNSTARTED, "#fb7185", 0),
        State("in_progress", "修复中", StateCategory.STARTED, "#3b82f6", 1),
        State("to_verify", "待验证", StateCategory.STARTED, "#eab308", 2),
        State("done", "已关闭", StateCategory.COMPLETED, "#22c55e", 3),
        State("wontfix", "非问题", StateCategory.CANCELLED, "#78716c", 4),
    ]
    trans = sequential_transitions(["open", "in_progress", "to_verify", "done"], cancellable="wontfix")
    trans.append(Transition("done", "open", "重开"))
    trans.append(Transition("wontfix", "open", "重开"))
    return WorkflowDefinition("bug", "缺陷流程", states, trans)


def test_case_workflow() -> WorkflowDefinition:
    states = [
        State("draft", "草稿", StateCategory.UNSTARTED, "#64748b", 0),
        State("in_review", "评审中", StateCategory.STARTED, "#8b5cf6", 1),
        State("active", "已生效", StateCategory.COMPLETED, "#22c55e", 2),
        State("deprecated", "已废弃", StateCategory.CANCELLED, "#78716c", 3),
    ]
    trans = sequential_transitions(["draft", "in_review", "active"], cancellable="deprecated")
    trans.append(Transition("deprecated", "draft", "恢复"))
    return WorkflowDefinition("test_case", "用例流程", states, trans)


def test_task_workflow() -> WorkflowDefinition:
    states = [
        State("pending", "待提测", StateCategory.UNSTARTED, "#94a3b8", 0),
        State("in_progress", "测试中", StateCategory.STARTED, "#eab308", 1),
        State("blocked", "阻塞", StateCategory.STARTED, "#f43f5e", 2),
        State("done", "已完成", StateCategory.COMPLETED, "#22c55e", 3),
        State("cancelled", "已取消", StateCategory.CANCELLED, "#78716c", 4),
    ]
    trans = sequential_transitions(["pending", "in_progress", "done"], cancellable="cancelled")
    trans.extend(
        [
            Transition("pending", "blocked", "阻塞"),
            Transition("in_progress", "blocked", "阻塞"),
            Transition("blocked", "in_progress", "恢复"),
            Transition("blocked", "cancelled", "取消"),
        ]
    )
    return WorkflowDefinition("test_task", "测试任务流程", states, trans)


def ticket_workflow() -> WorkflowDefinition:
    states = [
        State("submitted", "已申请", StateCategory.UNSTARTED, "#94a3b8", 0),
        State("pending_approval", "待审批", StateCategory.STARTED, "#f59e0b", 1),
        State("processing", "处理中", StateCategory.STARTED, "#3b82f6", 2),
        State("done", "已关闭", StateCategory.COMPLETED, "#22c55e", 3),
        State("cancelled", "已拒绝", StateCategory.CANCELLED, "#78716c", 4),
    ]
    trans = [
        Transition("submitted", "pending_approval", "提交审批"),
        Transition("pending_approval", "processing", "通过", require_role="admin"),
        Transition("pending_approval", "cancelled", "拒绝", require_role="admin"),
        Transition("pending_approval", "submitted", "退回", require_role="admin"),
        Transition("processing", "done", "关闭", require_approver=True),
        Transition("processing", "cancelled", "取消"),
        Transition("cancelled", "submitted", "重开"),
    ]
    return WorkflowDefinition("ticket", "事务/工单", states, trans)


WORKFLOW_PRESETS: dict[str, WorkflowDefinition] = {
    "engineering": engineering_workflow(),
    "product": product_workflow(),
    "bug": bug_workflow(),
    "test_case": test_case_workflow(),
    "test_task": test_task_workflow(),
    "ticket": ticket_workflow(),
}

DEFAULT_WORKFLOW = engineering_workflow()

# Old engineering-board statuses → type-specific keys (idempotent).
LEGACY_STATUS_MAP: dict[str, dict[str, str]] = {
    "bug": {
        "backlog": "open",
        "todo": "open",
        "testing": "to_verify",
        "cancelled": "wontfix",
    },
    "requirement": {
        "backlog": "idea",
        "todo": "idea",
        "in_progress": "development",
        "in_review": "prd",
        "testing": "development",
        "done": "launch",
    },
    "feature": {
        "backlog": "idea",
        "todo": "idea",
        "in_progress": "development",
        "in_review": "prd",
        "testing": "development",
        "done": "launch",
    },
    "test_case": {
        "backlog": "draft",
        "todo": "draft",
        "in_progress": "in_review",
        "testing": "active",
        "done": "active",
        "cancelled": "deprecated",
    },
    "test_task": {
        "backlog": "pending",
        "todo": "pending",
        "in_review": "in_progress",
        "testing": "in_progress",
    },
}
