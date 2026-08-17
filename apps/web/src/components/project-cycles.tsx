"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import type { WorkItem } from "@/lib/api";
import { dataApi } from "@/lib/api";
import { SPRINT_STATUS_LABEL, STATUS_LABEL } from "@/lib/labels";

export function ProjectCycles({
  projectId,
  onOpen,
}: {
  projectId: string;
  onOpen?: (item: WorkItem) => void;
}) {
  const qc = useQueryClient();
  const sprints = useQuery({
    queryKey: ["sprints", projectId],
    queryFn: () => dataApi.sprints(projectId),
    enabled: !!projectId,
  });
  const milestones = useQuery({
    queryKey: ["milestones", projectId],
    queryFn: () => dataApi.milestones(projectId),
    enabled: !!projectId,
  });
  const items = useQuery({
    queryKey: ["sprint-items", projectId],
    queryFn: () => dataApi.workItems({ project_id: projectId }),
    enabled: !!projectId,
  });

  const active = (sprints.data ?? []).find((s) => s.status === "active");
  const inSprint = useMemo(
    () => (items.data ?? []).filter((i) => i.sprint_id && i.sprint_id === active?.id),
    [items.data, active?.id],
  );

  const createSprint = useMutation({
    mutationFn: () =>
      dataApi.createSprint({
        project_id: projectId,
        name: `Sprint ${(sprints.data?.length ?? 0) + 1}`,
        status: "planned",
        goal: "",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sprints"] }),
  });
  const createMilestone = useMutation({
    mutationFn: () =>
      dataApi.createMilestone({
        project_id: projectId,
        name: "新里程碑",
        status: "planned",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["milestones"] }),
  });
  const activate = useMutation({
    mutationFn: (s: {
      id: string;
      name: string;
      project_id: string;
      goal: string | null;
      start_at: string | null;
      end_at: string | null;
    }) =>
      dataApi.updateSprint(s.id, {
        project_id: s.project_id,
        name: s.name,
        goal: s.goal,
        start_at: s.start_at,
        end_at: s.end_at,
        status: "active",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sprints"] }),
  });

  return (
    <div className="h-full overflow-y-auto px-6 pb-10">
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-medium">迭代</h2>
          <button onClick={() => createSprint.mutate()} className="text-[12px] text-[#ffb088]">
            + 新建
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(sprints.data ?? []).map((s) => (
            <div key={s.id} className="rounded-xl border border-[#232633] bg-[#12141a] p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[14px]">{s.name}</span>
                <span className="text-[11px] text-[#8b90a0]">{SPRINT_STATUS_LABEL[s.status] ?? s.status}</span>
              </div>
              <p className="mb-2 text-[12px] text-[#8b90a0]">{s.goal || "暂无目标"}</p>
              <div className="flex items-center justify-between text-[11px] text-[#6d7280]">
                <span>{s.item_count} 项</span>
                {s.status !== "active" && (
                  <button onClick={() => activate.mutate(s)} className="text-[#ffb088]">
                    设为进行中
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {active && (
        <section className="mb-8">
          <h2 className="mb-3 text-[13px] font-medium">当前迭代工作项</h2>
          <div className="divide-y divide-[#1b1e27] rounded-xl border border-[#232633]">
            {inSprint.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => (onOpen ? onOpen(item) : undefined)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] hover:bg-[#12141a]"
              >
                <span className="w-16 font-mono text-[11px] text-[#8b90a0]">{item.key}</span>
                <span className="flex-1 truncate">{item.title}</span>
                <span className="text-[11px] text-[#6d7280]">{STATUS_LABEL[item.status] ?? item.status}</span>
              </button>
            ))}
            {inSprint.length === 0 && (
              <div className="px-4 py-8 text-center text-[12px] text-[#6d7280]">还没有工作项挂到这个迭代</div>
            )}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-medium">里程碑</h2>
          <button onClick={() => createMilestone.mutate()} className="text-[12px] text-[#ffb088]">
            + 新建
          </button>
        </div>
        <div className="space-y-2">
          {(milestones.data ?? []).map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-[#232633] px-4 py-3">
              <div>
                <div className="text-[13px]">{m.name}</div>
                <div className="text-[11px] text-[#6d7280]">
                  {m.due_at ? new Date(m.due_at).toLocaleDateString() : "无截止日期"} · {m.item_count} 项
                </div>
              </div>
              <span className="text-[11px] text-[#8b90a0]">{SPRINT_STATUS_LABEL[m.status] ?? m.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
