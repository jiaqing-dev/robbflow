"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { dataApi, type WorkItem } from "@/lib/api";
import { TYPE_LABEL } from "@/lib/labels";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<WorkItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setHits([]);
  }, [open]);

  useEffect(() => {
    if (!open || q.trim().length < 1) return;
    const t = setTimeout(() => {
      dataApi.search(q.trim()).then(setHits).catch(() => setHits([]));
    }, 180);
    return () => clearTimeout(t);
  }, [q, open]);

  const commands = useMemo(
    () => [
      { label: "收件箱", run: () => router.push("/inbox") },
      { label: "我的工作", run: () => router.push("/my-work") },
      { label: "项目", run: () => router.push("/projects") },
      { label: "规划", run: () => router.push("/roadmap") },
      { label: "设置", run: () => router.push("/settings") },
      { label: "迭代", run: () => router.push("/cycles") },
      { label: "流程设计", run: () => router.push("/workflows") },
      { label: "类型关系图", run: () => router.push("/workflows/types") },
      { label: "操作演示", run: () => router.push("/demo") },
    ],
    [router],
  );

  if (!open) return null;

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[18vh]" onClick={onClose}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[#2a2e3a] bg-[#12141a] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索工作项，或跳转页面…"
          className="w-full border-b border-[#232633] bg-transparent px-4 py-3 text-[14px] outline-none placeholder:text-[#6d7280]"
        />
        <div className="max-h-[360px] overflow-y-auto py-2">
          {filtered.map((c) => (
            <button
              key={c.label}
              className="flex w-full px-4 py-2 text-left text-[13px] text-[#d5d8e0] hover:bg-[#1a1d26]"
              onClick={() => {
                c.run();
                onClose();
              }}
            >
              {c.label}
            </button>
          ))}
          {hits.map((item) => (
            <button
              key={item.id}
              className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-[#1a1d26]"
              onClick={() => {
                router.push(`/issues/${item.key}`);
                onClose();
              }}
            >
              <span className="w-16 shrink-0 font-mono text-[11px] text-[#8b90a0]">{item.key}</span>
              <span className="flex-1 truncate text-[13px]">{item.title}</span>
              <span className="text-[11px] text-[#6d7280]">{TYPE_LABEL[item.type] ?? item.type}</span>
            </button>
          ))}
          {q && filtered.length === 0 && hits.length === 0 && (
            <div className="px-4 py-6 text-center text-[12px] text-[#6d7280]">没有匹配结果</div>
          )}
        </div>
      </div>
    </div>
  );
}
