from uuid import uuid4

from robbflow_domain.graph import build_trace_graph


def test_trace_follows_both_directions():
    a, b, c = uuid4(), uuid4(), uuid4()
    r1, r2 = uuid4(), uuid4()
    relations = [
        (a, b, "implements", r1),
        (b, c, "tested_by", r2),
    ]
    nodes, edges = build_trace_graph(a, relations, depth=3)
    assert nodes == {a, b, c}
    assert len(edges) == 2


def test_trace_respects_depth():
    a, b, c = uuid4(), uuid4(), uuid4()
    relations = [
        (a, b, "implements", uuid4()),
        (b, c, "tested_by", uuid4()),
    ]
    nodes, _ = build_trace_graph(a, relations, depth=1)
    assert c not in nodes
    assert b in nodes
