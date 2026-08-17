"use client";

import {
  addEdge,
  Background,
  ConnectionMode,
  Controls,
  reconnectEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo } from "react";

import { LeftRightHandles } from "@/components/flow-handles";
import type { Workflow, WorkflowState, WorkflowTransition } from "@/lib/api";
import {
  diagramStates,
  diagramTransitions,
  edgeLabel,
  mergeWorkflowCanvas,
} from "@/lib/flow-diagram";
import {
  asLrEdges,
  connectionLineStyle,
  connectionLineType,
  lrEdgeDefaults,
  lrPositions,
  NODE_GAP_X,
} from "@/lib/flow-style";
import "@xyflow/react/dist/style.css";

type StateData = WorkflowState;

function StateNode({ data, selected }: NodeProps<Node<StateData>>) {
  return (
    <div
      className={`relative min-w-[120px] overflow-visible rounded-md border bg-[#12141a] px-3.5 py-2.5 ${
        selected ? "border-[#ff6a2b]" : "border-[#2a2e3a]"
      }`}
    >
      <LeftRightHandles />
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: data.color }} />
        <span className="text-[13px] font-medium">{data.name}</span>
      </div>
    </div>
  );
}

const nodeTypes = { state: StateNode };

export function WorkflowCanvas({
  workflow,
  onChange,
  readOnly = false,
  selectedKey,
  onSelect,
}: {
  workflow: Workflow;
  onChange?: (next: { states: WorkflowState[]; transitions: WorkflowTransition[] }) => void;
  readOnly?: boolean;
  selectedKey?: string | null;
  onSelect?: (key: string | null) => void;
}) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner
        workflow={workflow}
        onChange={onChange}
        readOnly={readOnly}
        selectedKey={selectedKey}
        onSelect={onSelect}
      />
    </ReactFlowProvider>
  );
}

function WorkflowCanvasInner({
  workflow,
  onChange,
  readOnly,
  selectedKey,
  onSelect,
}: {
  workflow: Workflow;
  onChange?: (next: { states: WorkflowState[]; transitions: WorkflowTransition[] }) => void;
  readOnly?: boolean;
  selectedKey?: string | null;
  onSelect?: (key: string | null) => void;
}) {
  const toNodes = useCallback(
    (states: WorkflowState[]): Node<StateData>[] =>
      diagramStates(states).map((s, i) => ({
        id: s.key,
        type: "state",
        position: {
          x: s.layout_x || 80 + i * NODE_GAP_X,
          y: s.layout_y || 96,
        },
        selected: false,
        data: { ...s },
        draggable: !readOnly,
        ...lrPositions(),
      })),
    [readOnly],
  );

  const toEdges = useCallback(
    (transitions: WorkflowTransition[], states: WorkflowState[]): Edge[] =>
      diagramTransitions(transitions, states).map((t, i) => ({
        id: `${t.from_state}-${t.to_state}-${i}`,
        source: t.from_state,
        target: t.to_state,
        label: edgeLabel(t.name),
      })),
    [],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(toNodes(workflow.states));
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    asLrEdges(toEdges(workflow.transitions, workflow.states)),
  );

  useEffect(() => {
    setNodes((prev) => {
      const selected = new Set(prev.filter((n) => n.selected).map((n) => n.id));
      return toNodes(workflow.states).map((n) => ({ ...n, selected: selected.has(n.id) }));
    });
    setEdges(asLrEdges(toEdges(workflow.transitions, workflow.states)));
  }, [workflow.states, workflow.transitions, setNodes, setEdges, toNodes, toEdges]);

  const emit = useCallback(
    (nextNodes: Node<StateData>[], nextEdges: Edge[]) => {
      const nextStates = nextNodes.map((n, i) => ({
        key: n.id,
        name: n.data.name,
        category: n.data.category,
        color: n.data.color,
        position: n.data.position ?? i,
        layout_x: n.position.x,
        layout_y: n.position.y,
      }));
      const nextTransitions = nextEdges.map((e) => {
        const prev = workflow.transitions.find((t) => t.from_state === e.source && t.to_state === e.target);
        return {
          from_state: e.source,
          to_state: e.target,
          name: typeof e.label === "string" && e.label ? e.label : prev?.name ?? "前进",
          require_role: prev?.require_role ?? null,
          require_approver: prev?.require_approver ?? false,
        };
      });
      onChange?.(
        mergeWorkflowCanvas(workflow.states, workflow.transitions, nextStates, nextTransitions),
      );
    },
    [onChange, workflow.states, workflow.transitions],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (readOnly || !c.source || !c.target) return;
      const next = addEdge(
        {
          ...c,
          sourceHandle: "out",
          targetHandle: "in",
          ...lrEdgeDefaults,
        },
        edges,
      );
      setEdges(asLrEdges(next));
      emit(nodes, asLrEdges(next));
    },
    [edges, emit, nodes, readOnly, setEdges],
  );

  const onNodeDragStop = useCallback(() => {
    emit(nodes, edges);
  }, [emit, nodes, edges]);

  const defaultEdgeOptions = useMemo(() => lrEdgeDefaults, []);

  return (
    <div className="rf-flow h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={
          readOnly
            ? undefined
            : (changes) => {
                onEdgesChange(changes);
              }
        }
        onConnect={onConnect}
        onReconnect={
          readOnly
            ? undefined
            : (oldEdge, conn) => {
                const next = asLrEdges(reconnectEdge(oldEdge, conn, edges));
                setEdges(next);
                emit(nodes, next);
              }
        }
        onNodeDragStop={onNodeDragStop}
        onEdgesDelete={
          readOnly
            ? undefined
            : (deleted) => {
                const ids = new Set(deleted.map((e) => e.id));
                const next = edges.filter((e) => !ids.has(e.id));
                emit(nodes, next);
              }
        }
        onSelectionChange={({ nodes: selected }) => {
          const key = selected[0]?.id ?? null;
          if (key !== selectedKey) onSelect?.(key);
        }}
        connectionLineType={connectionLineType}
        connectionLineStyle={connectionLineStyle}
        connectionMode={readOnly ? ConnectionMode.Strict : ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesConnectable={!readOnly}
        edgesReconnectable={!readOnly}
        connectOnClick={!readOnly}
        connectionRadius={28}
        elementsSelectable
        deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
        defaultEdgeOptions={defaultEdgeOptions}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#232633" gap={18} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
