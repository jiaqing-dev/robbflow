import type { TypeGraphEdge, WorkflowState, WorkflowTransition } from "@/lib/api";

const BACK_LABELS = new Set(["回退", "取消", "重开", "恢复"]);

export function isCancelState(state: Pick<WorkflowState, "key" | "category">): boolean {
  return state.category === "cancelled";
}

export function isDiagramTransition(
  transition: Pick<WorkflowTransition, "from_state" | "to_state" | "name">,
  states: Pick<WorkflowState, "key" | "category" | "position">[],
): boolean {
  const byKey = new Map(states.map((s) => [s.key, s]));
  const from = byKey.get(transition.from_state);
  const to = byKey.get(transition.to_state);
  if (!from || !to) return false;
  if (isCancelState(from) || isCancelState(to)) return false;
  if (transition.name && BACK_LABELS.has(transition.name)) return false;
  if (to.position < from.position) return false;
  return true;
}

export function diagramStates(states: WorkflowState[]): WorkflowState[] {
  return states.filter((s) => !isCancelState(s));
}

export function diagramTransitions(
  transitions: WorkflowTransition[],
  states: WorkflowState[],
): WorkflowTransition[] {
  return transitions.filter((t) => isDiagramTransition(t, states));
}

export function mergeWorkflowCanvas(
  prevStates: WorkflowState[],
  prevTransitions: WorkflowTransition[],
  nextStates: WorkflowState[],
  nextTransitions: WorkflowTransition[],
): { states: WorkflowState[]; transitions: WorkflowTransition[] } {
  const visibleIds = new Set(nextStates.map((s) => s.key));
  const hiddenStates = prevStates.filter((s) => isCancelState(s) && !visibleIds.has(s.key));
  const hiddenTransitions = prevTransitions.filter((t) => !isDiagramTransition(t, prevStates));
  return {
    states: [...nextStates, ...hiddenStates],
    transitions: [...nextTransitions, ...hiddenTransitions],
  };
}

/** Keep one arrow per node pair, preferring the first (usually the output / ownership direction). */
export function uniqueForwardTypeEdges(edges: TypeGraphEdge[]): TypeGraphEdge[] {
  const seen = new Set<string>();
  const out: TypeGraphEdge[] = [];
  for (const edge of edges) {
    const fwd = `${edge.source_key}>${edge.target_key}`;
    const rev = `${edge.target_key}>${edge.source_key}`;
    if (seen.has(fwd) || seen.has(rev)) continue;
    seen.add(fwd);
    out.push(edge);
  }
  return out;
}

export function edgeLabel(name: string | null | undefined): string {
  if (!name || name === "前进") return "";
  return name;
}
