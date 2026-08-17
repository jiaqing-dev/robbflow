from robbflow_domain.detail_layout import default_layout, resolve_layout


def test_bug_layout_has_repro_in_main():
    layout = default_layout("bug")
    main_keys = [b["key"] for b in layout["main"]]
    assert main_keys[:5] == ["description", "docs", "steps", "expected", "actual"]
    side_keys = [b["key"] for b in layout["sidebar"]]
    assert "severity" in side_keys
    assert "status" in side_keys


def test_resolve_appends_new_custom_field():
    stored = default_layout("task")
    resolved = resolve_layout("task", stored, ["estimate", "module"])
    keys = [b["key"] for b in resolved["sidebar"]]
    assert "module" in keys
    assert keys.count("estimate") == 1


def test_resolve_drops_removed_field():
    stored = default_layout("bug")
    resolved = resolve_layout("bug", stored, ["severity"])
    keys = [b["key"] for b in resolved["main"] + resolved["sidebar"] if b["kind"] == "field"]
    assert keys == ["severity"]
