from robbflow_workflow.engine import (
    DEFAULT_WORKFLOW,
    InvalidTransitionError,
    bug_workflow,
    diagram_transitions,
    engineering_workflow,
    product_workflow,
    sequential_transitions,
    ticket_workflow,
)
from robbflow_workflow.engine import (
    test_case_workflow as case_workflow,
)
from robbflow_workflow.engine import (
    test_task_workflow as task_workflow,
)


def test_default_initial_state():
    wf = engineering_workflow()
    assert wf.initial_state() == "backlog"


def test_valid_transition():
    wf = DEFAULT_WORKFLOW
    wf.validate_transition("todo", "in_progress")


def test_invalid_unknown_state():
    wf = DEFAULT_WORKFLOW
    try:
        wf.validate_transition("todo", "does_not_exist")
        raise AssertionError("expected InvalidTransitionError")
    except InvalidTransitionError:
        pass


def test_invalid_skip_ahead():
    wf = DEFAULT_WORKFLOW
    assert not wf.can_transition("todo", "done")


def test_legacy_status_can_escape():
    DEFAULT_WORKFLOW.validate_transition("legacy_status", "todo")


def test_same_state_is_allowed():
    assert DEFAULT_WORKFLOW.can_transition("todo", "todo")


def test_back_and_cancel_are_allowed():
    wf = engineering_workflow()
    wf.validate_transition("in_progress", "todo")
    wf.validate_transition("in_progress", "cancelled")


def test_bug_cannot_skip_verify():
    wf = bug_workflow()
    assert wf.initial_state() == "open"
    assert not wf.can_transition("open", "done")
    wf.validate_transition("in_progress", "to_verify")
    wf.validate_transition("done", "open")


def test_test_case_is_asset_lifecycle():
    wf = case_workflow()
    assert wf.initial_state() == "draft"
    assert wf.can_transition("in_review", "active")
    assert not wf.can_transition("draft", "active")


def test_test_task_can_block():
    wf = task_workflow()
    assert wf.initial_state() == "pending"
    wf.validate_transition("in_progress", "blocked")
    wf.validate_transition("blocked", "in_progress")


def test_product_is_sequential():
    wf = product_workflow()
    assert wf.can_transition("idea", "discovery")
    assert not wf.can_transition("idea", "launch")


def test_sequential_helper_has_forward_back_cancel():
    trans = sequential_transitions(["a", "b", "c"], cancellable="x")
    names = {(t.from_state, t.to_state, t.name) for t in trans}
    assert ("a", "b", "前进") in names
    assert ("b", "a", "回退") in names
    assert ("a", "x", "取消") in names


def test_engineering_diagram_is_forward_only():
    wf = engineering_workflow()
    pairs = {(t.from_state, t.to_state) for t in diagram_transitions(wf)}
    assert ("todo", "in_progress") in pairs
    assert ("in_progress", "todo") not in pairs
    assert ("todo", "cancelled") not in pairs
    assert all(t.name != "取消" for t in diagram_transitions(wf))
    assert all(t.name != "回退" for t in diagram_transitions(wf))


def test_bug_diagram_hides_reopen_and_wontfix():
    wf = bug_workflow()
    pairs = {(t.from_state, t.to_state) for t in diagram_transitions(wf)}
    assert ("open", "in_progress") in pairs
    assert ("in_progress", "to_verify") in pairs
    assert ("done", "open") not in pairs
    assert ("open", "wontfix") not in pairs


def test_test_task_diagram_keeps_block_branch():
    wf = task_workflow()
    pairs = {(t.from_state, t.to_state) for t in diagram_transitions(wf)}
    assert ("pending", "in_progress") in pairs
    assert ("in_progress", "blocked") in pairs
    assert ("blocked", "in_progress") not in pairs
    assert ("pending", "cancelled") not in pairs


def test_ticket_approval_edges():
    wf = ticket_workflow()
    assert wf.initial_state() == "submitted"
    edge = wf.find_transition("pending_approval", "processing")
    assert edge is not None
    assert edge.require_role == "admin"
    close = wf.find_transition("processing", "done")
    assert close is not None
    assert close.require_approver is True

