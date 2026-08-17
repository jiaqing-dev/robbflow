from robbflow_domain.templates import resolve_templates, type_keys_for


def test_qa_loop_tables():
    picked = resolve_templates(["qa_loop"])
    assert [row["key"] for row in picked] == ["qa_loop"]
    assert [t["type_key"] for t in picked[0]["tables"]] == ["bug", "test_case", "test_task"]


def test_union_type_keys_keeps_order():
    keys = type_keys_for(["engineering", "qa_loop"])
    assert keys == ["requirement", "feature", "task", "bug", "test_case", "test_task"]


def test_ops_ticket_template():
    picked = resolve_templates(["ops_ticket"])
    assert picked[0]["key"] == "ops_ticket"
    assert [t["type_key"] for t in picked[0]["tables"]] == ["ticket", "task"]
