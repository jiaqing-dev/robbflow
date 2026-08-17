"""Rules for which work-item types may connect to each other."""

from __future__ import annotations

from typing import Any

PROJECT_TYPE_KEY = "__project__"


def _keys(ports: list[dict[str, Any]] | None) -> set[str]:
    return {str(p.get("type_key")) for p in (ports or []) if p.get("type_key")}


def association_allowed(
    source_type: str,
    target_type: str,
    source_outputs: list[dict[str, Any]] | None,
    target_inputs: list[dict[str, Any]] | None,
    relation: str | None = None,
) -> bool:
    """Empty ports on both sides mean unrestricted. Generic 关联 is always allowed."""
    if relation == "relates_to":
        return True
    outs = source_outputs or []
    ins = target_inputs or []
    if not outs and not ins:
        return True
    if target_type in _keys(outs):
        return True
    if source_type in _keys(ins):
        return True
    return False
