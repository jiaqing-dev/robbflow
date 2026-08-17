"use client";

import { useState } from "react";

import type { Project, WorkTemplate } from "@/lib/api";
import { cn } from "@/lib/cn";

const COLORS = ["#f97316", "#8b5cf6", "#0ea5e9", "#22c55e", "#ef4444", "#eab308", "#ec4899"];

export type ProjectFormValue = {
  name: string;
  description: string;
  key_prefix: string;
  color: string;
  status: string;
  templates: string[];
};

export function ProjectForm({
  initial,
  catalog,
  submitting,
  submitLabel,
  onSubmit,
  showStatus = true,
}: {
  initial?: Partial<Project>;
  catalog: WorkTemplate[];
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (value: ProjectFormValue) => void;
  showStatus?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [prefix, setPrefix] = useState(initial?.key_prefix ?? "PRJ");
  const [color, setColor] = useState(initial?.color ?? "#f97316");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [selected, setSelected] = useState<string[]>(
    initial?.templates?.length ? initial.templates : ["engineering"],
  );

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSubmit({
          name: name.trim(),
          description: description.trim(),
          key_prefix: prefix.trim().toUpperCase() || "PRJ",
          color,
          status,
          templates: selected,
        });
      }}
    >
      <label className="block">
        <span className="mb-1.5 block text-[12px] text-[#8b90a0]">名称</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-[#2a2e3a] bg-[#0b0c0e] px-3 py-2 text-[13px] outline-none focus:border-[#ff6a2b]"
          placeholder="例如：支付中台"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[12px] text-[#8b90a0]">描述</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-md border border-[#2a2e3a] bg-[#0b0c0e] px-3 py-2 text-[13px] outline-none focus:border-[#ff6a2b]"
          placeholder="这个项目做什么"
        />
      </label>
      <div className={showStatus ? "grid grid-cols-2 gap-3" : ""}>
        <label className="block">
          <span className="mb-1.5 block text-[12px] text-[#8b90a0]">编号前缀</span>
          <input
            value={prefix}
            onChange={(e) => setPrefix(e.target.value.toUpperCase().slice(0, 8))}
            className="w-full rounded-md border border-[#2a2e3a] bg-[#0b0c0e] px-3 py-2 font-mono text-[13px] outline-none focus:border-[#ff6a2b]"
          />
        </label>
        {showStatus && (
          <label className="block">
            <span className="mb-1.5 block text-[12px] text-[#8b90a0]">状态</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-[#2a2e3a] bg-[#0b0c0e] px-2 py-2 text-[13px]"
            >
              <option value="active">进行中</option>
              <option value="paused">暂停</option>
              <option value="archived">已归档</option>
            </select>
          </label>
        )}
      </div>
      <div>
        <span className="mb-1.5 block text-[12px] text-[#8b90a0]">颜色</span>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "h-6 w-6 rounded-full border-2",
                color === c ? "border-white" : "border-transparent",
              )}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-[12px] text-[#8b90a0]">工作模板</div>
        <p className="mb-3 text-[12px] leading-5 text-[#6d7280]">
          模板决定项目里出现哪些工作表。例如启用「测试闭环」后，会多出缺陷表、测试用例表、测试任务表。
        </p>
        <div className="space-y-2">
          {catalog.map((tpl) => {
            const on = selected.includes(tpl.key);
            return (
              <button
                key={tpl.key}
                type="button"
                onClick={() => toggle(tpl.key)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left",
                  on ? "border-[#ff6a2b]/60 bg-[#1a120e]" : "border-[#2a2e3a] bg-[#0e1014]",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border text-[10px]",
                      on ? "border-[#ff6a2b] bg-[#ff6a2b] text-black" : "border-[#3a3f52] text-transparent",
                    )}
                  >
                    ✓
                  </span>
                  <span className="text-[13px] font-medium">{tpl.name}</span>
                </div>
                <p className="mt-1.5 pl-6 text-[12px] leading-5 text-[#8b90a0]">{tpl.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
                  {tpl.tables.map((table) => (
                    <span
                      key={table.type_key}
                      className="rounded-md border border-[#2a2e3a] px-1.5 py-0.5 text-[11px] text-[#b4b8c5]"
                    >
                      {table.name}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!name.trim() || submitting}
          className="rounded-md bg-[#ff6a2b] px-3 py-1.5 text-[12px] font-medium text-black disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
