"use client";

import {
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeProps,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import Link from "next/link";
import { useMemo } from "react";

import { LeftRightHandles } from "@/components/flow-handles";
import type { GraphPayload } from "@/lib/api";
import {
  asLrEdges,
  connectionLineStyle,
  connectionLineType,
  lrEdgeDefaults,
  lrPositions,
  NODE_GAP_X,
  NODE_GAP_Y,
} from "@/lib/flow-style";
import { RELATION_LABEL, TYPE_LABEL, typeColor } from "@/lib/labels";
import "@xyflow/react/dist/style.css";

type TraceData = {
  key: string;
  title: string;
  type: string;
  origin: boolean;
};

function TraceNode({ data, selected }: NodeProps<Node<TraceData>>) {
  return (
    <div
      className={`w-[200px] rounded-md border bg-[#12141a] px-3 py-2.5 ${
        data.origin || selected ? "border-[#ff6a2b]" : "border-[#2a2e3a]"
      }`}
    >
      <LeftRightHandles />
      <Link href={`/issues/${data.key}`} className="block text-left">
        <div className="mb-1 font-mono text-[11px] text-[#8b90a0]">{data.key}</div>
        <div className={`mb-1 text-[11px] ${typeColor(data.type)}`}>
          {TYPE_LABEL[data.type] ?? data.type}
        </div>
        <div className="line-clamp-2 text-[12px] leading-5">{data.title}</div>
      </Link>
    </div>
  );
}

const nodeTypes = { trace: TraceNode };

export function RelationGraph({ graph }: { graph: GraphPayload }) {
  return (
    <ReactFlowProvider>
      <RelationGraphInner graph={graph} />
    </ReactFlowProvider>
  );
}

function RelationGraphInner({ graph }: { graph: GraphPayload }) {
  const { nodes, edges } = useMemo(() => layout(graph), [graph]);
  return (
    <div className="rf-flow h-full min-h-[360px] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.24 }}
        nodesDraggable
        nodesConnectable={false}
        connectionLineType={connectionLineType}
        connectionLineStyle={connectionLineStyle}
        defaultEdgeOptions={lrEdgeDefaults}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#232633" gap={18} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

function layout(graph: GraphPayload): { nodes: Node<TraceData>[]; edges: Edge[] } {
  const outAdj = new Map<string, string[]>();
  const inAdj = new Map<string, string[]>();
  for (const e of graph.edges) {
    outAdj.set(e.source, [...(outAdj.get(e.source) ?? []), e.target]);
    inAdj.set(e.target, [...(inAdj.get(e.target) ?? []), e.source]);
  }

  const levels = new Map<string, number>();
  levels.set(graph.origin_id, 0);

  const walk = (adj: Map<string, string[]>, dir: 1 | -1) => {
    const q = [graph.origin_id];
    while (q.length) {
      const cur = q.shift()!;
      for (const nxt of adj.get(cur) ?? []) {
        if (levels.has(nxt)) continue;
        levels.set(nxt, (levels.get(cur) ?? 0) + dir);
        q.push(nxt);
      }
    }
  };
  walk(outAdj, 1);
  walk(inAdj, -1);

  const minLv = Math.min(0, ...levels.values());
  for (const [id, lv] of levels) levels.set(id, lv - minLv);

  const byLevel = new Map<number, string[]>();
  for (const node of graph.nodes) {
    const lv = levels.get(node.id) ?? 0;
    byLevel.set(lv, [...(byLevel.get(lv) ?? []), node.id]);
  }
  const nodes: Node<TraceData>[] = graph.nodes.map((n) => {
    const lv = levels.get(n.id) ?? 0;
    const row = (byLevel.get(lv) ?? []).indexOf(n.id);
    return {
      id: n.id,
      type: "trace",
      position: { x: 48 + lv * NODE_GAP_X, y: 48 + row * NODE_GAP_Y },
      data: {
        key: n.key,
        title: n.title,
        type: n.type,
        origin: n.id === graph.origin_id,
      },
      ...lrPositions(),
    };
  });
  const undirected = new Set<string>();
  const edges = asLrEdges(
    graph.edges.flatMap((e) => {
      const ls = levels.get(e.source) ?? 0;
      const lt = levels.get(e.target) ?? 0;
      if (lt < ls) return [];
      const pair = [e.source, e.target].sort().join("|");
      if (lt === ls) {
        if (undirected.has(pair)) return [];
        undirected.add(pair);
      }
      return [
        {
          id: e.id,
          source: e.source,
          target: e.target,
          label: RELATION_LABEL[e.relation_type] ?? e.relation_type,
        },
      ];
    }),
  );
  return { nodes, edges };
}
