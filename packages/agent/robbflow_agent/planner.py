"""AI Agent layer — Planner / Dev / Delivery.

V0.1 exposes a structured plan from natural language; tool calling lands in V0.4.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class PlannedItem:
    type: str
    title: str
    priority: str = "medium"


@dataclass
class AgentPlan:
    summary: str
    items: list[PlannedItem] = field(default_factory=list)


def plan_from_prompt(prompt: str) -> AgentPlan:
    text = prompt.strip()
    if not text:
        return AgentPlan(summary="Empty prompt", items=[])

    items = [
        PlannedItem("requirement", text[:200], "high"),
        PlannedItem("task", f"拆解并实现：{text[:80]}", "high"),
        PlannedItem("task", "补充测试与验收标准", "medium"),
        PlannedItem("task", "准备发布与回归", "medium"),
    ]
    return AgentPlan(summary=f"已将「{text[:60]}」拆成需求与任务", items=items)
