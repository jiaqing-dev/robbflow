import {
  ConnectionLineType,
  MarkerType,
  Position,
  type DefaultEdgeOptions,
  type Edge,
} from "@xyflow/react";

export const NODE_GAP_X = 320;
export const NODE_GAP_Y = 160;

export const lrEdgeDefaults: DefaultEdgeOptions = {
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#9aa0b4" },
  style: { stroke: "#9aa0b4", strokeWidth: 1.6 },
  labelStyle: { fill: "#e8eaf0", fontSize: 12, fontWeight: 500 },
  labelBgStyle: { fill: "#12141a", fillOpacity: 0.96 },
  labelBgPadding: [8, 10],
  labelBgBorderRadius: 6,
};

export const connectionLineStyle = { stroke: "#ff6a2b", strokeWidth: 1.6 };
export const connectionLineType = ConnectionLineType.SmoothStep;

export function lrPositions() {
  return {
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  };
}

export function asLrEdges<T extends Edge>(edges: T[]): T[] {
  const seen = new Map<string, number>();
  return edges.map((e) => {
    const pair = `${e.source}->${e.target}`;
    const n = seen.get(pair) ?? 0;
    seen.set(pair, n + 1);
    return {
      ...lrEdgeDefaults,
      ...e,
      type: "smoothstep",
      sourceHandle: "out",
      targetHandle: "in",
      pathOptions: { offset: n * 14, borderRadius: 12 },
    };
  });
}
