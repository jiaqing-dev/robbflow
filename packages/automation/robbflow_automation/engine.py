"""Event-driven rule engine.

Rules subscribe to domain events and fire actions (notify, mutate, create).
V0.1 ships a few built-in rules; custom rules land in V0.2.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

EventHandler = Callable[[dict[str, Any]], Awaitable[None] | None]


@dataclass
class Rule:
    event_type: str
    name: str
    condition: Callable[[dict[str, Any]], bool]
    action: EventHandler


class RuleEngine:
    def __init__(self) -> None:
        self._rules: list[Rule] = []

    def register(self, rule: Rule) -> None:
        self._rules.append(rule)

    async def handle(self, event_type: str, payload: dict[str, Any]) -> list[str]:
        fired: list[str] = []
        for rule in self._rules:
            if rule.event_type != event_type:
                continue
            if not rule.condition(payload):
                continue
            result = rule.action(payload)
            if hasattr(result, "__await__"):
                await result  # type: ignore[misc]
            fired.append(rule.name)
        return fired


def default_engine() -> RuleEngine:
    engine = RuleEngine()

    def p0_bug(payload: dict[str, Any]) -> bool:
        return payload.get("type") == "bug" and payload.get("priority") == "urgent"

    async def escalate(payload: dict[str, Any]) -> None:
        payload.setdefault("tags", []).append("sla")

    engine.register(Rule("WorkItemCreated", "escalate-p0-bug", p0_bug, escalate))
    return engine
