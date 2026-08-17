"""Project work templates: bundles of work-item tables (需求表 / 缺陷表 / …)."""

from __future__ import annotations

from typing import Any

WORK_TEMPLATES: list[dict[str, Any]] = [
    {
        "key": "engineering",
        "name": "研发协作",
        "description": "需求拆到功能点与任务，缺陷挂回研发。",
        "tables": [
            {"type_key": "requirement", "name": "需求表"},
            {"type_key": "feature", "name": "功能点表"},
            {"type_key": "task", "name": "任务表"},
            {"type_key": "bug", "name": "缺陷表"},
        ],
    },
    {
        "key": "qa_loop",
        "name": "测试闭环",
        "description": "测试任务执行用例、验证缺陷，形成提测—执行—回归闭环。",
        "tables": [
            {"type_key": "bug", "name": "缺陷表"},
            {"type_key": "test_case", "name": "测试用例表"},
            {"type_key": "test_task", "name": "测试任务表"},
        ],
    },
    {
        "key": "product",
        "name": "产品规划",
        "description": "需求、功能点与通用事项。",
        "tables": [
            {"type_key": "requirement", "name": "需求表"},
            {"type_key": "feature", "name": "功能点表"},
            {"type_key": "issue", "name": "事项表"},
        ],
    },
    {
        "key": "ops_ticket",
        "name": "事务工单",
        "description": "申请 → 审批 → 处理 → 关闭，适合中小企业简易事务，不替代 OA。",
        "tables": [
            {"type_key": "ticket", "name": "工单表"},
            {"type_key": "task", "name": "任务表"},
        ],
    },
]


def template_by_key(key: str) -> dict[str, Any] | None:
    return next((t for t in WORK_TEMPLATES if t["key"] == key), None)


def resolve_templates(keys: list[str] | None) -> list[dict[str, Any]]:
    picked = []
    seen: set[str] = set()
    for key in keys or ["engineering"]:
        row = template_by_key(key)
        if row and row["key"] not in seen:
            picked.append(row)
            seen.add(row["key"])
    return picked


def type_keys_for(keys: list[str] | None) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for tpl in resolve_templates(keys):
        for table in tpl["tables"]:
            tk = table["type_key"]
            if tk not in seen:
                out.append(tk)
                seen.add(tk)
    return out
