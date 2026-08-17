import { RELATION_DEMO } from "@/lib/flow-catalog";

const NODE_COLOR: Record<string, string> = {
  项目: "#ff6a2b",
  需求: "#8b5cf6",
  功能点: "#a78bfa",
  任务: "#38bdf8",
  测试任务: "#fbbf24",
  用例: "#eab308",
  事项: "#94a3b8",
  缺陷: "#fb7185",
};

export function TypeRelationPreview() {
  return (
    <div className="flex flex-wrap gap-2">
      {RELATION_DEMO.map((row) => (
        <div
          key={`${row.from}-${row.rel}-${row.to}`}
          className="flex items-center gap-1.5 rounded-full border border-[#2a2e3a] bg-[#0e1014] px-2 py-1 text-[11px]"
        >
          <Dot label={row.from} />
          <span className="text-[#6d7280]">{row.rel}</span>
          <Dot label={row.to} />
        </div>
      ))}
    </div>
  );
}

function Dot({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1 text-[#eceef2]">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: NODE_COLOR[label] ?? "#8b90a0" }}
      />
      {label}
    </span>
  );
}
