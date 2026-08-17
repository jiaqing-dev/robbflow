"use client";

import { useRouter } from "next/navigation";

import type { WorkItem } from "@/lib/api";
import { cn } from "@/lib/cn";
import { PRIORITY_LABEL, STATUS_LABEL, TYPE_LABEL, typeColor } from "@/lib/labels";

export function WorkItemRow({
  item,
  onOpen,
}: {
  item: WorkItem;
  onOpen?: (item: WorkItem) => void;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (onOpen ? onOpen(item) : router.push(`/issues/${item.key}`))}
      className="group grid w-full grid-cols-[88px_1fr_88px_100px_72px] items-center gap-3 border-b border-[#1b1e27] px-4 py-2.5 text-left hover:bg-[#12141a]"
    >
      <span className="font-mono text-[11px] text-[#8b90a0]">{item.key}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className={cn("text-[11px]", typeColor(item.type))}>{TYPE_LABEL[item.type] ?? item.type}</span>
        <span className="truncate text-[13px] text-[#eceef2] group-hover:text-white">{item.title}</span>
      </span>
      <span className="text-[11px] text-[#8b90a0]">{STATUS_LABEL[item.status] ?? item.status}</span>
      <span className="text-[11px] text-[#8b90a0]">{PRIORITY_LABEL[item.priority] ?? item.priority}</span>
      <span className="truncate text-right text-[11px] text-[#6d7280]">
        {item.assignee?.name ?? "未指派"}
      </span>
    </button>
  );
}

export function WorkItemList({
  items,
  empty,
  onOpen,
}: {
  items: WorkItem[];
  empty: string;
  onOpen?: (item: WorkItem) => void;
}) {
  if (!items.length) {
    return <div className="px-6 py-16 text-center text-[13px] text-[#6d7280]">{empty}</div>;
  }
  return (
    <div>
      <div className="grid grid-cols-[88px_1fr_88px_100px_72px] gap-3 border-b border-[#232633] px-4 py-2 text-[11px] tracking-wide text-[#6d7280]">
        <span>编号</span>
        <span>标题</span>
        <span>状态</span>
        <span>优先级</span>
        <span className="text-right">负责人</span>
      </div>
      {items.map((item) => (
        <WorkItemRow key={item.id} item={item} onOpen={onOpen} />
      ))}
    </div>
  );
}
