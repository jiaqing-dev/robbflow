"use client";

import {
  blockLabel,
  editorLayout,
  unusedBlocks,
  type DetailLayout,
  type LayoutBlock,
  type TypeField,
} from "@/lib/detail-layout";

function move(list: LayoutBlock[], index: number, dir: -1 | 1): LayoutBlock[] {
  const next = [...list];
  const j = index + dir;
  if (j < 0 || j >= next.length) return list;
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

export function DetailLayoutEditor({
  typeKey,
  stored,
  fields,
  onChange,
}: {
  typeKey: string;
  stored: DetailLayout | null | undefined;
  fields: TypeField[];
  onChange: (layout: DetailLayout) => void;
}) {
  const layout = editorLayout(typeKey, stored);
  const unused = unusedBlocks(layout, fields);

  function set(next: DetailLayout) {
    onChange(next);
  }

  function remove(slot: "main" | "sidebar", index: number) {
    set({ ...layout, [slot]: layout[slot].filter((_, i) => i !== index) });
  }

  function add(slot: "main" | "sidebar", block: LayoutBlock) {
    set({ ...layout, [slot]: [...layout[slot], block] });
  }

  function transfer(from: "main" | "sidebar", index: number) {
    const to = from === "main" ? "sidebar" : "main";
    const block = layout[from][index];
    set({
      ...layout,
      [from]: layout[from].filter((_, i) => i !== index),
      [to]: [...layout[to], block],
    });
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_1fr_160px] gap-0 text-[12px]">
      <Column
        title="主栏（描述区）"
        items={layout.main}
        fields={fields}
        onUp={(i) => set({ ...layout, main: move(layout.main, i, -1) })}
        onDown={(i) => set({ ...layout, main: move(layout.main, i, 1) })}
        onMove={(i) => transfer("main", i)}
        onRemove={(i) => remove("main", i)}
        moveLabel="→ 侧栏"
      />
      <Column
        title="侧栏（详细信息）"
        items={layout.sidebar}
        fields={fields}
        onUp={(i) => set({ ...layout, sidebar: move(layout.sidebar, i, -1) })}
        onDown={(i) => set({ ...layout, sidebar: move(layout.sidebar, i, 1) })}
        onMove={(i) => transfer("sidebar", i)}
        onRemove={(i) => remove("sidebar", i)}
        moveLabel="← 主栏"
      />
      <div className="overflow-auto border-l border-[#1b1e27] p-3">
        <div className="mb-2 text-[#6d7280]">未放置</div>
        {unused.length === 0 && <p className="text-[#6d7280]">都已放到页面上</p>}
        {unused.map((b) => (
          <div key={`${b.kind}:${b.key}`} className="mb-1.5">
            <div className="text-[#c4c8d4]">{blockLabel(b, fields)}</div>
            <div className="mt-0.5 flex gap-2 text-[11px]">
              <button onClick={() => add("main", b)} className="text-[#ffb088]">
                + 主栏
              </button>
              <button onClick={() => add("sidebar", b)} className="text-[#ffb088]">
                + 侧栏
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Column({
  title,
  items,
  fields,
  onUp,
  onDown,
  onMove,
  onRemove,
  moveLabel,
}: {
  title: string;
  items: LayoutBlock[];
  fields: TypeField[];
  onUp: (i: number) => void;
  onDown: (i: number) => void;
  onMove: (i: number) => void;
  onRemove: (i: number) => void;
  moveLabel: string;
}) {
  return (
    <div className="min-h-0 overflow-auto border-r border-[#1b1e27]">
      <div className="sticky top-0 bg-[#0e1014] px-3 py-2 text-[#6d7280]">{title}</div>
      {items.map((b, i) => (
        <div key={`${b.kind}:${b.key}-${i}`} className="flex items-center gap-2 border-t border-[#1b1e27] px-3 py-1.5">
          <span className="min-w-0 flex-1 truncate">
            {blockLabel(b, fields)}
            <span className="ml-1 text-[10px] text-[#6d7280]">{b.kind === "system" ? "系统" : "字段"}</span>
          </span>
          <button onClick={() => onUp(i)} className="text-[#6d7280]" title="上移">
            ↑
          </button>
          <button onClick={() => onDown(i)} className="text-[#6d7280]" title="下移">
            ↓
          </button>
          <button onClick={() => onMove(i)} className="text-[#8b90a0]">
            {moveLabel}
          </button>
          <button onClick={() => onRemove(i)} className="text-[#6d7280]">
            移除
          </button>
        </div>
      ))}
      {items.length === 0 && <div className="px-3 py-8 text-center text-[#6d7280]">从右侧加入区块</div>}
    </div>
  );
}
