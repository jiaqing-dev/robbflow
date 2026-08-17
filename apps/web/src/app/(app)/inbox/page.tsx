"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { IssuePeek } from "@/components/issue-peek";
import { WorkItemList } from "@/components/work-item-list";
import { dataApi, type WorkItem } from "@/lib/api";

export default function InboxPage() {
  const items = useQuery({ queryKey: ["inbox"], queryFn: dataApi.inbox });
  const activity = useQuery({ queryKey: ["activity"], queryFn: dataApi.activity });
  const [peek, setPeek] = useState<WorkItem | null>(null);

  return (
    <div className="flex h-full">
      <section className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 flex items-end justify-between border-b border-[#232633] bg-[#0b0c0e]/90 px-6 py-4 backdrop-blur">
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight">收件箱</h1>
            <p className="text-[12px] text-[#8b90a0]">需要你处理或尚未指派的工作对象</p>
          </div>
        </header>
        {items.isLoading ? (
          <div className="px-6 py-16 text-[13px] text-[#6d7280]">加载中…</div>
        ) : (
          <WorkItemList
            items={items.data ?? []}
            empty="收件箱是空的。去项目里看看，或 ⌘N 新建。"
            onOpen={setPeek}
          />
        )}
      </section>
      <aside className="hidden w-[300px] shrink-0 overflow-y-auto border-l border-[#232633] p-4 xl:block">
        <div className="mb-3 text-[11px] tracking-wide text-[#6d7280]">动态</div>
        <ul className="space-y-3">
          {(activity.data ?? []).map((a) => (
            <li key={a.id} className="text-[12px] text-[#b4b8c5]">
              <span className="text-[#ffb088]">{a.action}</span>{" "}
              <span className="text-[#8b90a0]">{String(a.payload.key ?? a.entity_type)}</span>
              <div className="mt-0.5 text-[11px] text-[#6d7280]">
                {new Date(a.created_at).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      </aside>
      {peek && <IssuePeek issueKey={peek.key} onClose={() => setPeek(null)} />}
    </div>
  );
}
