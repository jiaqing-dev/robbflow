"""Traceability graph over work_item_relation."""

from __future__ import annotations

from collections import defaultdict, deque
from typing import Any
from uuid import UUID


def build_trace_graph(
    origin_id: UUID,
    relations: list[tuple[UUID, UUID, str, UUID]],
    *,
    depth: int = 4,
) -> tuple[set[UUID], list[tuple[UUID, UUID, str, UUID]]]:
    """Return (node_ids, edge tuples) reachable from origin within `depth`.

    Each relation is (source_id, target_id, relation_type, relation_id).
    Graph is undirected for traversal so REQ → Task → Test still connects both ways.
    """
    adj: dict[UUID, list[tuple[UUID, UUID, str, UUID]]] = defaultdict(list)
    for source, target, kind, rid in relations:
        edge = (source, target, kind, rid)
        adj[source].append(edge)
        adj[target].append(edge)

    seen: set[UUID] = {origin_id}
    kept: list[tuple[UUID, UUID, str, UUID]] = []
    queue: deque[tuple[UUID, int]] = deque([(origin_id, 0)])
    while queue:
        node, dist = queue.popleft()
        if dist >= depth:
            continue
        for source, target, kind, rid in adj.get(node, []):
            other = target if source == node else source
            edge = (source, target, kind, rid)
            if edge not in kept and (target, source, kind, rid) not in kept:
                kept.append(edge)
            if other not in seen:
                seen.add(other)
                queue.append((other, dist + 1))
    return seen, kept


def serialize_graph(
    origin_id: UUID,
    nodes: dict[UUID, Any],
    edges: list[tuple[UUID, UUID, str, UUID]],
) -> dict[str, Any]:
    return {
        "origin_id": str(origin_id),
        "nodes": list(nodes.values()),
        "edges": [
            {
                "id": str(rid),
                "source": str(source),
                "target": str(target),
                "relation_type": kind,
            }
            for source, target, kind, rid in edges
        ],
    }
