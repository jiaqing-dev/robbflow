"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { dataApi } from "@/lib/api";
import { STATUS_LABEL } from "@/lib/labels";

export default function RoadmapPage() {
  const items = useQuery({ queryKey: ["roadmap"], queryFn: () => dataApi.workItems() });
  const milestones = useQuery({ queryKey: ["milestones"], queryFn: () => dataApi.milestones() });
  const grouped = (items.data ?? []).reduce<Record<string, NonNullable<typeof items.data>>>(
    (acc, item) => {
      const bucket = item.status;
      acc[bucket] = [...(acc[bucket] ?? []), item];
      return acc;
    },
    {},
  );
  const order = ["backlog", "todo", "in_progress", "in_review", "testing", "done"];

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <h1 className="mb-1 text-[18px] font-semibold tracking-tight">规划</h1>
      <p className="mb-6 text-[12px] text-[#8b90a0]">里程碑时间线 + 按状态展开</p>

      <section className="mb-8">
        <h2 className="mb-3 text-[12px] tracking-wide text-[#6d7280]">里程碑</h2>
        <div className="space-y-2">
          {(milestones.data ?? []).map((m) => (
            <div key={m.id} className="rounded-lg border border-[#232633] bg-[#12141a] px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px]">{m.name}</span>
                <span className="text-[11px] text-[#8b90a0]">
                  {m.due_at ? new Date(m.due_at).toLocaleDateString() : "—"}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#1a1d26]">
                <div className="h-full w-1/3 bg-[#ff6a2b]" />
              </div>
              <div className="mt-2 text-[11px] text-[#6d7280]">{m.item_count} 个工作项</div>
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-6">
        {order.map((status) => (
          <section key={status}>
            <h2 className="mb-2 text-[12px] tracking-wide text-[#6d7280]">{STATUS_LABEL[status] ?? status}</h2>
            <div className="space-y-1">
              {(grouped[status] ?? []).map((item) => (
                <Link
                  key={item.id}
                  href={`/issues/${item.key}`}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-[#12141a]"
                >
                  <span className="w-16 font-mono text-[11px] text-[#8b90a0]">{item.key}</span>
                  <span className="flex-1 truncate text-[13px]">{item.title}</span>
                  <span className="text-[11px] text-[#6d7280]">{item.project_name}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
