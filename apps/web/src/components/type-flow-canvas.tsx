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
import { useCallback, useEffect } from "react";

import { LeftRightHandles } from "@/components/flow-handles";
import type { TypeGraphEdge, WorkItemType } from "@/lib/api";
import { uniqueForwardTypeEdges } from "@/lib/flow-diagram";
import {
  asLrEdges,
  connectionLineStyle,
  connectionLineType,
  lrEdgeDefaults,
  lrPositions,
  NODE_GAP_X,
  NODE_GAP_Y,
} from "@/lib/flow-style";
import "@xyflow/react/dist/style.css";

export const PROJECT_NODE_KEY = "__project__";

type TypeNodeData = {
  name: string;
  color: string;
  key: string;
  virtual?: boolean;
};

function TypeNode({ data, selected }: NodeProps<Node<TypeNodeData>>) {
  return (
    <div
      className={`relative min-w-[120px] overflow-visible rounded-md border bg-[#12141a] px-3 py-2 ${
        selected ? "border-[#ff6a2b]" : "border-[#2a2e3a]"
      }`}
    >
      <LeftRightHandles />
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: data.color }} />
        <span className="text-[13px] font-medium">{data.name}</span>
      </div>
      <div className="mt-0.5 font-mono text-[10px] text-[#6d7280]">
        {data.virtual ? "系统" : data.key}
      </div>
    </div>
  );
}

const nodeTypes = { type: TypeNode };

export function edgesFromTypes(types: WorkItemType[]): TypeGraphEdge[] {
  const edges: TypeGraphEdge[] = [];
  for (const t of types) {
    for (const port of t.outputs ?? []) {
      edges.push({
        source_key: t.key,
        target_key: port.type_key,
        relation: port.relation,
        label: port.label ?? null,
      });
    }
  }
  for (const t of types) {
    for (const port of t.inputs ?? []) {
      edges.push({
        source_key: port.type_key,
        target_key: t.key,
        relation: port.relation,
        label: port.label ?? null,
      });
    }
  }
  return uniqueForwardTypeEdges(edges);
}

export function TypeFlowCanvas({
  types,
  edges,
  selectedKey,
  onSelect,
  onChange,
}: {
  types: WorkItemType[];
  edges: TypeGraphEdge[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onChange: (next: { types: WorkItemType[]; edges: TypeGraphEdge[] }) => void;
}) {
  return (
    <ReactFlowProvider>
      <TypeFlowCanvasInner
        types={types}
        edges={edges}
        selectedKey={selectedKey}
        onSelect={onSelect}
        onChange={onChange}
      />
    </ReactFlowProvider>
  );
}

function TypeFlowCanvasInner({
  types,
  edges,
  selectedKey,
  onSelect,
  onChange,
}: {
  types: WorkItemType[];
  edges: TypeGraphEdge[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onChange: (next: { types: WorkItemType[]; edges: TypeGraphEdge[] }) => void;
}) {
  const toNodes = useCallback(
    (rows: WorkItemType[]): Node<TypeNodeData>[] => {
      const project: Node<TypeNodeData> = {
        id: PROJECT_NODE_KEY,
        type: "type",
        position: { x: 48, y: 180 },
        selected: false,
        data: { name: "项目", color: "#ff6a2b", key: PROJECT_NODE_KEY, virtual: true },
        draggable: false,
        ...lrPositions(),
      };
      const rest = rows.map((t, i) => ({
        id: t.key,
        type: "type" as const,
        position: {
          x: t.layout_x ?? 80 + NODE_GAP_X + (i % 4) * NODE_GAP_X,
          y: t.layout_y ?? 48 + Math.floor(i / 4) * NODE_GAP_Y,
        },
        selected: false,
        data: { name: t.name, color: t.color, key: t.key },
        draggable: true,
        ...lrPositions(),
      }));
      return [project, ...rest];
    },
    [],
  );

  const toFlowEdges = useCallback(
    (rels: TypeGraphEdge[], rows: WorkItemType[]): Edge[] => {
      const ids = new Set([PROJECT_NODE_KEY, ...rows.map((t) => t.key)]);
      return asLrEdges(
        uniqueForwardTypeEdges(rels)
          .filter((e) => ids.has(e.source_key) && ids.has(e.target_key))
          .map((e, i) => ({
            id: `${e.source_key}-${e.target_key}-${e.relation}-${i}`,
            source: e.source_key,
            target: e.target_key,
            label: e.label || e.relation,
            data: { relation: e.relation, label: e.label },
          })),
      );
    },
    [],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(toNodes(types));
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(toFlowEdges(edges, types));

  useEffect(() => {
    setNodes((prev) => {
      const selected = new Set(prev.filter((n) => n.selected).map((n) => n.id));
      return toNodes(types).map((n) => ({ ...n, selected: selected.has(n.id) }));
    });
    setFlowEdges(toFlowEdges(edges, types));
  }, [types, edges, setNodes, setFlowEdges, toNodes, toFlowEdges]);

  const emit = useCallback(
    (nextNodes: Node<TypeNodeData>[], nextEdges: Edge[]) => {
      const nextTypes = types.map((t) => {
        const n = nextNodes.find((node) => node.id === t.key);
        return n ? { ...t, layout_x: n.position.x, layout_y: n.position.y } : t;
      });
      onChange({
        types: nextTypes,
        edges: uniqueForwardTypeEdges(
          nextEdges.map((e) => ({
            source_key: e.source,
            target_key: e.target,
            relation: (e.data?.relation as string) || "relates_to",
            label: typeof e.label === "string" ? e.label : ((e.data?.label as string) ?? null),
          })),
        ),
      });
    },
    [onChange, types],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      const relation =
        c.source === PROJECT_NODE_KEY || c.target === PROJECT_NODE_KEY ? "belongs_to" : "relates_to";
      const label = relation === "belongs_to" ? "归属" : "关联";
      const next = addEdge(
        {
          ...c,
          sourceHandle: "out",
          targetHandle: "in",
          label,
          data: { relation, label },
          ...lrEdgeDefaults,
        },
        flowEdges,
      );
      setFlowEdges(asLrEdges(next));
      emit(nodes, asLrEdges(next));
    },
    [emit, flowEdges, nodes, setFlowEdges],
  );

  return (
    <div className="rf-flow h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={(oldEdge, conn) => {
          const next = asLrEdges(reconnectEdge(oldEdge, conn, flowEdges));
          setFlowEdges(next);
          emit(nodes, next);
        }}
        onNodeDragStop={() => emit(nodes, flowEdges)}
        onEdgesDelete={(deleted) => {
          const ids = new Set(deleted.map((e) => e.id));
          emit(
            nodes,
            flowEdges.filter((e) => !ids.has(e.id)),
          );
        }}
        onSelectionChange={({ nodes: selected }) => {
          const key = selected[0]?.id ?? null;
          if (key !== selectedKey) onSelect(key);
        }}
        connectionLineType={connectionLineType}
        connectionLineStyle={connectionLineStyle}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesConnectable
        edgesReconnectable
        connectOnClick
        connectionRadius={28}
        elementsSelectable
        deleteKeyCode={["Backspace", "Delete"]}
        defaultEdgeOptions={lrEdgeDefaults}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#232633" gap={18} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
