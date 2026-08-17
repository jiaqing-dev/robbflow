"""AI Agent layer — Planner / Dev / Delivery.

Heuristic planner is always available. Optional LLM via ROBBFLOW_LLM_* env.
"""

from __future__ import annotations

import json
import os
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
    source: str = "heuristic"


def plan_from_prompt(prompt: str) -> AgentPlan:
    text = prompt.strip()
    if not text:
        return AgentPlan(summary="Empty prompt", items=[])
    llm = _try_llm(text)
    if llm is not None:
        return llm
    items = [
        PlannedItem("requirement", text[:200], "high"),
        PlannedItem("task", f"拆解并实现：{text[:80]}", "high"),
        PlannedItem("task", "补充测试与验收标准", "medium"),
        PlannedItem("task", "准备发布与回归", "medium"),
    ]
    return AgentPlan(summary=f"已将「{text[:60]}」拆成需求与任务", items=items, source="heuristic")


def _try_llm(text: str) -> AgentPlan | None:
    url = os.environ.get("ROBBFLOW_LLM_URL")
    key = os.environ.get("ROBBFLOW_LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not url or not key:
        return None
    try:
        import httpx

        payload = {
            "model": os.environ.get("ROBBFLOW_LLM_MODEL", "gpt-4o-mini"),
            "messages": [
                {
                    "role": "system",
                    "content": "把用户需求拆成 JSON：{summary, items:[{type,title,priority}]}。"
                    "type 只能是 requirement/task/bug/ticket。只输出 JSON。",
                },
                {"role": "user", "content": text},
            ],
            "temperature": 0.2,
        }
        with httpx.Client(timeout=12) as client:
            res = client.post(
                url.rstrip("/") + "/chat/completions",
                headers={"Authorization": f"Bearer {key}"},
                json=payload,
            )
            res.raise_for_status()
            content = res.json()["choices"][0]["message"]["content"]
        data = json.loads(content)
        items = [
            PlannedItem(str(i.get("type", "task")), str(i.get("title", ""))[:200], str(i.get("priority", "medium")))
            for i in data.get("items", [])
            if i.get("title")
        ]
        if not items:
            return None
        return AgentPlan(summary=str(data.get("summary") or "LLM 拆解"), items=items, source="llm")
    except Exception:
        return None
