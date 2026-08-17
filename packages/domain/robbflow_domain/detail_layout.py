"""Per-type detail page layout (Jira-like main + sidebar, configurable)."""

from __future__ import annotations

from typing import Any


def _sys(key: str) -> dict[str, str]:
    return {"kind": "system", "key": key}


def _fld(key: str) -> dict[str, str]:
    return {"kind": "field", "key": key}


GENERIC_LAYOUT: dict[str, list[dict[str, str]]] = {
    "main": [_sys("description"), _sys("docs"), _sys("relations"), _sys("activity")],
    "sidebar": [
        _sys("status"),
        _sys("assignee"),
        _sys("reporter"),
        _sys("priority"),
        _sys("sprint"),
        _sys("milestone"),
        _sys("dates"),
    ],
}

LAYOUT_PRESETS: dict[str, dict[str, list[dict[str, str]]]] = {
    "bug": {
        "main": [
            _sys("description"),
            _fld("steps"),
            _fld("expected"),
            _fld("actual"),
            _sys("relations"),
            _sys("activity"),
        ],
        "sidebar": [
            _sys("status"),
            _sys("assignee"),
            _sys("reporter"),
            _sys("priority"),
            _fld("severity"),
            _fld("environment"),
            _fld("version"),
            _sys("sprint"),
            _sys("milestone"),
            _sys("dates"),
        ],
    },
    "requirement": {
        "main": [_sys("description"), _sys("graph"), _sys("relations"), _sys("activity")],
        "sidebar": [
            _sys("status"),
            _sys("assignee"),
            _sys("reporter"),
            _sys("priority"),
            _fld("source"),
            _fld("value"),
            _sys("sprint"),
            _sys("milestone"),
            _sys("dates"),
        ],
    },
    "feature": {
        "main": [_sys("description"), _sys("graph"), _sys("relations"), _sys("activity")],
        "sidebar": [
            _sys("status"),
            _sys("assignee"),
            _sys("priority"),
            _fld("module"),
            _sys("sprint"),
            _sys("milestone"),
            _sys("dates"),
        ],
    },
    "task": {
        "main": [_sys("description"), _sys("relations"), _sys("activity")],
        "sidebar": [
            _sys("status"),
            _sys("assignee"),
            _sys("reporter"),
            _sys("priority"),
            _fld("estimate"),
            _sys("sprint"),
            _sys("milestone"),
            _sys("dates"),
        ],
    },
    "test_case": {
        "main": [
            _sys("description"),
            _fld("precondition"),
            _fld("steps"),
            _fld("expected"),
            _sys("relations"),
            _sys("activity"),
        ],
        "sidebar": [_sys("status"), _sys("assignee"), _fld("result"), _sys("dates")],
    },
    "test_task": {
        "main": [_sys("description"), _sys("relations"), _sys("activity")],
        "sidebar": [
            _sys("status"),
            _sys("assignee"),
            _fld("stage"),
            _fld("env"),
            _sys("sprint"),
            _sys("dates"),
        ],
    },
    "incident": {
        "main": [_sys("description"), _sys("relations"), _sys("activity")],
        "sidebar": [
            _sys("status"),
            _sys("assignee"),
            _sys("reporter"),
            _sys("priority"),
            _fld("severity"),
            _sys("dates"),
        ],
    },
    "issue": {
        "main": [_sys("description"), _sys("relations"), _sys("activity")],
        "sidebar": [
            _sys("status"),
            _sys("assignee"),
            _sys("priority"),
            _fld("kind"),
            _sys("sprint"),
            _sys("dates"),
        ],
    },
}


def _ensure_docs(layout: dict[str, list[dict[str, str]]]) -> dict[str, list[dict[str, str]]]:
    main = [dict(b) for b in layout["main"]]
    if not any(b.get("kind") == "system" and b.get("key") == "docs" for b in main):
        idx = next((i for i, b in enumerate(main) if b.get("key") == "description"), -1)
        main.insert(idx + 1, _sys("docs"))
    return {"main": main, "sidebar": [dict(b) for b in layout["sidebar"]]}


def default_layout(type_key: str) -> dict[str, list[dict[str, str]]]:
    preset = LAYOUT_PRESETS.get(type_key, GENERIC_LAYOUT)
    return _ensure_docs(
        {"main": [dict(b) for b in preset["main"]], "sidebar": [dict(b) for b in preset["sidebar"]]}
    )


def resolve_layout(
    type_key: str,
    stored: dict[str, Any] | None,
    field_keys: list[str],
) -> dict[str, list[dict[str, str]]]:
    """Use saved layout, or the type preset. Append custom fields that are not placed yet."""
    if stored and (stored.get("main") or stored.get("sidebar")):
        main = [dict(b) for b in stored.get("main") or []]
        sidebar = [dict(b) for b in stored.get("sidebar") or []]
    else:
        fallback = default_layout(type_key)
        main = fallback["main"]
        sidebar = fallback["sidebar"]

    field_set = set(field_keys)
    placed = {b["key"] for b in main + sidebar if b.get("kind") == "field"}
    for key in field_keys:
        if key not in placed:
            sidebar.append(_fld(key))

    def keep(block: dict[str, str]) -> bool:
        if block.get("kind") == "field":
            return block.get("key", "") in field_set
        return bool(block.get("key"))

    return _ensure_docs({"main": [b for b in main if keep(b)], "sidebar": [b for b in sidebar if keep(b)]})
