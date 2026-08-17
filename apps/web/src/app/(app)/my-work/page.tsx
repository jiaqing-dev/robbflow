"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { IssuePeek } from "@/components/issue-peek";
import { WorkItemList } from "@/components/work-item-list";
import { dataApi, type WorkItem } from "@/lib/api";

export default function MyWorkPage() {
  const items = useQuery({ queryKey: ["my-work"], queryFn: dataApi.myWork });
  const [peek, setPeek] = useState<WorkItem | null>(null);
  return (
    <div className="h-full overflow-y-auto">
      <header className="sticky top-0 z-10 border-b border-[#232633] bg-[#0b0c0e]/90 px-6 py-4 backdrop-blur">
        <h1 className="text-[18px] font-semibold tracking-tight">我的工作</h1>
        <p className="text-[12px] text-[#8b90a0]">指派给你的全部工作项</p>
      </header>
      {items.isLoading ? (
        <div className="px-6 py-16 text-[13px] text-[#6d7280]">加载中…</div>
      ) : (
        <WorkItemList items={items.data ?? []} empty="还没有指派给你的工作。" onOpen={setPeek} />
      )}
      {peek && <IssuePeek issueKey={peek.key} onClose={() => setPeek(null)} />}
    </div>
  );
}
