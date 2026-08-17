"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { dataApi } from "@/lib/api";
import { TYPE_LABEL } from "@/lib/labels";

export function WorkItemPicker({
  excludeId,
  value,
  onChange,
  preferredTypes,
}: {
  excludeId?: string;
  value: string;
  onChange: (id: string) => void;
  preferredTypes?: Set<string>;
}) {
  const [q, setQ] = useState("");
  const catalog = useQuery({
    queryKey: ["all-items"],
    queryFn: () => dataApi.workItems({ limit: "200" }),
  });
  const search = useQuery({
    queryKey: ["search-picker", q],
    queryFn: () => dataApi.search(q.trim()),
    enabled: q.trim().length >= 1,
  });

  const items = useMemo(() => {
    const source = (q.trim() ? search.data : catalog.data) ?? [];
    return source.filter((i) => i.id !== excludeId);
  }, [catalog.data, excludeId, q, search.data]);

  const selected = [...(catalog.data ?? []), ...(search.data ?? [])].find((i) => i.id === value);

  return (
    <div className="min-w-0 flex-1">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜索编号或标题，如 ENG-2、状态机"
        className="mb-1.5 w-full rounded-md border border-[#232633] bg-[#0e1014] px-2 py-1.5 text-[12px] outline-none focus:border-[#ff6a2b]"
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[#232633] bg-[#0e1014] px-2 py-1.5 text-[12px]"
      >
        <option value="">{selected ? `${selected.key} ${selected.title}` : "选择目标工作项"}</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {preferredTypes?.size && preferredTypes.has(i.type) ? "★ " : ""}
            {TYPE_LABEL[i.type] ?? i.type} · {i.key} {i.title}
          </option>
        ))}
      </select>
      <PickerHint
        loading={q.trim() ? search.isLoading : catalog.isLoading}
        error={q.trim() ? search.isError : catalog.isError}
        count={items.length}
        query={q}
      />
    </div>
  );
}

function PickerHint({
  loading,
  error,
  count,
  query,
}: {
  loading: boolean;
  error: boolean;
  count: number;
  query: string;
}) {
  if (loading) return <p className="mt-1 text-[11px] text-[#6d7280]">正在查找工作项…</p>;
  if (error) return <p className="mt-1 text-[11px] text-rose-400">加载失败，请确认 API 已启动</p>;
  if (count === 0) {
    return (
      <p className="mt-1 text-[11px] text-[#6d7280]">
        {query.trim() ? `没有匹配「${query.trim()}」的工作项` : "工作区里还没有可关联的工作项"}
      </p>
    );
  }
  return <p className="mt-1 text-[11px] text-[#6d7280]">共 {count} 条，★ 为推荐关联类型</p>;
}

