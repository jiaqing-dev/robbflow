"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ApiError, type BoardColumn, type WorkItem } from "@/lib/api";
import { dataApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { dueLabel, isOverdue, PRIORITY_LABEL, TYPE_LABEL, typeColor } from "@/lib/labels";

export function Kanban({
  projectId,
  columns,
  transitions = [],
  onOpen,
}: {
  projectId: string;
  columns: BoardColumn[];
  transitions?: { from_state: string; to_state: string }[];
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
    <div className="flex h-full flex-col">
      {dropError && (
        <p className="px-4 pb-2 text-[12px] text-rose-400">{dropError}</p>
      )}
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 pb-4">
        {columns.map((col) => {
          const canDrop = drag ? allowedFor(drag.status).has(col.key) : true;
          const hovering = overKey === col.key && !!drag;
          return (
            <section
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setOverKey(col.key);
              }}
              onDragLeave={() => {
                if (overKey === col.key) setOverKey(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                dropOn(col.key);
              }}
              className={cn(
                "flex w-[280px] shrink-0 flex-col rounded-lg border bg-[#0e1014]",
                hovering && canDrop && "border-[#ff6a2b]",
                hovering && !canDrop && "border-rose-500/70",
                !hovering && "border-[#1e2230]",
              )}
            >
              <header className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: col.color }} />
                  <span className="text-[12px] font-medium">{col.name}</span>
                </div>
                <span className="text-[11px] text-[#6d7280]">{col.items.length}</span>
              </header>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
                {col.items.map((item) => (
                  <KanbanCard
                    key={item.id}
                    item={item}
                    statuses={
                      transitions.length
                        ? [
                            item.status,
                            ...transitions
                              .filter((t) => t.from_state === item.status)
                              .map((t) => t.to_state),
                          ]
                        : columns.map((c) => c.key)
                    }
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
            </section>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({
  item,
  statuses,
  statusNames,
  onMove,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  item: WorkItem;
  statuses: string[];
  statusNames: Record<string, string>;
  onMove: (status: string) => void;
  onOpen?: (item: WorkItem) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "cursor-grab rounded-md border bg-[#12141a] p-3 hover:border-[#3a3f52] active:cursor-grabbing",
        isOverdue(item) ? "border-rose-500/50" : "border-[#232633]",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onOpen?.(item)}
          className="font-mono text-[11px] text-[#8b90a0] hover:text-[#ffb088]"
        >
          {item.key}
        </button>
        <span className={cn("text-[10px] uppercase", typeColor(item.type))}>
          {TYPE_LABEL[item.type] ?? item.type}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onOpen?.(item)}
        className="block w-full text-left text-[13px] leading-snug text-[#eceef2]"
      >
        {item.title}
      </button>
      <div className="mt-3 flex items-center justify-between">
        <span className={cn("text-[10px] tracking-wide", isOverdue(item) ? "text-rose-400" : "text-[#6d7280]")}>
          {isOverdue(item) ? `逾期 ${dueLabel(item.due_at)}` : PRIORITY_LABEL[item.priority] ?? item.priority}
        </span>
        <select
          value={item.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onMove(e.target.value)}
          className="rounded border border-[#2a2e3a] bg-transparent px-1 py-0.5 text-[10px] text-[#8b90a0]"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusNames[s] ?? s}
            </option>
          ))}
        </select>
      </div>
    </article>
  );
}
