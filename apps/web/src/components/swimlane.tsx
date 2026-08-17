"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { BoardLane, BoardColumn, WorkItem, WorkflowTransition } from "@/lib/api";
import { ApiError, dataApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { TYPE_LABEL, typeColor } from "@/lib/labels";

export function SwimlaneBoard({
  projectId,
  columns,
  lanes,
  transitions,
  onOpen,
}: {
  projectId: string;
  columns: BoardColumn[];
  lanes: BoardLane[];
  transitions: WorkflowTransition[];
  onOpen?: (item: WorkItem) => void;
}) {
  const qc = useQueryClient();
  const [drag, setDrag] = useState<{ id: string; status: string } | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [dropError, setDropError] = useState("");
  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      dataApi.updateWorkItem(id, { status }),
    onSuccess: () => {
      setDropError("");
      qc.invalidateQueries({ queryKey: ["board", projectId] });
    },
    onError: (err: unknown) => {
      setDropError(err instanceof ApiError ? err.message : "无法改状态");
    },
  });
  const nameByKey = Object.fromEntries(columns.map((c) => [c.key, c.name]));

  function allowedFor(status: string): Set<string> {
    if (!transitions.length) return new Set(columns.map((c) => c.key));
    return new Set([
      status,
      ...transitions.filter((t) => t.from_state === status).map((t) => t.to_state),
    ]);
  }

  function dropOn(colKey: string) {
    if (!drag) return;
    const from = drag.status;
    const id = drag.id;
    setDrag(null);
    setOverKey(null);
    if (from === colKey) return;
    if (!allowedFor(from).has(colKey)) {
      setDropError(`不能从「${nameByKey[from] ?? from}」转到「${nameByKey[colKey] ?? colKey}」`);
      return;
    }
    move.mutate({ id, status: colKey });
  }

  return (
    <div className="h-full overflow-auto px-4 pb-4">
      {dropError && <p className="pb-2 text-[12px] text-rose-400">{dropError}</p>}
      <table className="min-w-full border-separate border-spacing-2">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-[120px] bg-[#0b0c0e] text-left text-[11px] uppercase tracking-wide text-[#6d7280]">
              泳道
            </th>
            {columns.map((col) => (
              <th key={col.key} className="min-w-[220px] text-left text-[12px]">
                <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: col.color }} />
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lanes.map((lane) => (
            <tr key={lane.key}>
              <td className="sticky left-0 z-10 align-top rounded-md border border-[#232633] bg-[#12141a] px-3 py-2 text-[12px]">
                {lane.name}
              </td>
              {columns.map((col) => {
                const cellKey = `${lane.key}:${col.key}`;
                const canDrop = drag ? allowedFor(drag.status).has(col.key) : true;
                const hovering = overKey === cellKey && !!drag;
                return (
                  <td
                    key={col.key}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setOverKey(cellKey);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      dropOn(col.key);
                    }}
                    className={cn(
                      "align-top rounded-md border bg-[#0e1014] p-2",
                      hovering && canDrop && "border-[#ff6a2b]",
                      hovering && !canDrop && "border-rose-500/70",
                      !hovering && "border-[#1e2230]",
                    )}
                  >
                    <div className="flex flex-col gap-2">
                      {(lane.items_by_status[col.key] ?? []).map((item) => (
                        <SwimCard
                          key={item.id}
                          item={item}
                          transitions={transitions}
                          statusNames={nameByKey}
                          onMove={(status) => move.mutate({ id: item.id, status })}
                          onOpen={onOpen}
                          onDragStart={() => setDrag({ id: item.id, status: item.status })}
                          onDragEnd={() => {
                            setDrag(null);
                            setOverKey(null);
                          }}
                        />
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SwimCard({
  item,
  transitions,
  statusNames,
  onMove,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  item: WorkItem;
  transitions: WorkflowTransition[];
  statusNames: Record<string, string>;
  onMove: (status: string) => void;
  onOpen?: (item: WorkItem) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const allowed = [
    item.status,
    ...transitions.filter((t) => t.from_state === item.status).map((t) => t.to_state),
  ];
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="cursor-grab rounded-md border border-[#232633] bg-[#12141a] p-2 active:cursor-grabbing"
    >
      <button
        type="button"
        onClick={() => onOpen?.(item)}
        className="font-mono text-[10px] text-[#8b90a0] hover:text-[#ffb088]"
      >
        {item.key}
      </button>
      <button
        type="button"
        onClick={() => onOpen?.(item)}
        className="mt-1 block w-full text-left text-[12px] leading-snug"
      >
        {item.title}
      </button>
      <div className="mt-2 flex items-center justify-between">
        <span className={cn("text-[10px]", typeColor(item.type))}>{TYPE_LABEL[item.type]}</span>
        <select
          value={item.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onMove(e.target.value)}
          className="bg-transparent text-[10px] text-[#8b90a0]"
        >
          {allowed.map((s) => (
            <option key={s} value={s}>
              {statusNames[s] ?? s}
            </option>
          ))}
        </select>
      </div>
    </article>
  );
}
