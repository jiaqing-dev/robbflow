from robbflow_domain.association import association_allowed


def test_unrestricted_when_ports_empty():
    assert association_allowed("requirement", "task", None, None)
    assert association_allowed("requirement", "task", [], [])


def test_output_allows_target():
    outs = [{"type_key": "feature", "relation": "parent_of"}]
    assert association_allowed("requirement", "feature", outs, None)
    assert not association_allowed("requirement", "bug", outs, None)


def test_relates_to_is_always_allowed():
    outs = [{"type_key": "feature", "relation": "parent_of"}]
    assert association_allowed("requirement", "bug", outs, None, "relates_to")
    assert not association_allowed("requirement", "bug", outs, None, "implements")


def test_input_allows_source():
    ins = [{"type_key": "requirement", "relation": "belongs_to"}]
    assert association_allowed("requirement", "feature", None, ins)
    assert not association_allowed("task", "feature", None, ins)
