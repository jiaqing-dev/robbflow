import type { WorkflowState } from "@/lib/api";

export function MiniFlow({ states }: { states: WorkflowState[] }) {
  const main = [...states]
    .filter((s) => s.category !== "cancelled")
    .sort((a, b) => a.position - b.position);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {main.map((s, i) => (
        <span key={s.key} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-[10px] text-[#6d7280]">→</span>}
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium text-black"
            style={{ background: s.color }}
          >
            {s.name}
          </span>
        </span>
      ))}
    </div>
  );
}
