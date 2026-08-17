export type LayoutBlock = { kind: "system" | "field"; key: string };

export type DetailLayout = {
  main: LayoutBlock[];
  sidebar: LayoutBlock[];
};

export type TypeField = {
  key: string;
  name: string;
  type: string;
  options?: string[];
};

export const SYSTEM_BLOCKS: Record<string, { name: string; slot: "main" | "sidebar" }> = {
  description: { name: "描述", slot: "main" },
  docs: { name: "飞书文档", slot: "main" },
  relations: { name: "关联", slot: "main" },
  graph: { name: "追溯图", slot: "main" },
  activity: { name: "活动", slot: "main" },
  type: { name: "类型", slot: "sidebar" },
  status: { name: "状态", slot: "sidebar" },
  assignee: { name: "负责人", slot: "sidebar" },
  reporter: { name: "报告人", slot: "sidebar" },
  priority: { name: "优先级", slot: "sidebar" },
  sprint: { name: "迭代", slot: "sidebar" },
  milestone: { name: "里程碑", slot: "sidebar" },
  dates: { name: "时间", slot: "sidebar" },
};

const sys = (key: string): LayoutBlock => ({ kind: "system", key });
const fld = (key: string): LayoutBlock => ({ kind: "field", key });

function ensureDocs(layout: DetailLayout): DetailLayout {
  const main = layout.main.map((b) => ({ ...b }));
  if (!main.some((b) => b.kind === "system" && b.key === "docs")) {
    const idx = main.findIndex((b) => b.key === "description");
    main.splice(idx < 0 ? 0 : idx + 1, 0, sys("docs"));
  }
  return { main, sidebar: layout.sidebar.map((b) => ({ ...b })) };
}

const GENERIC: DetailLayout = {
  main: [sys("description"), sys("docs"), sys("relations"), sys("activity")],
  sidebar: [
    sys("status"),
    sys("assignee"),
    sys("reporter"),
    sys("priority"),
    sys("sprint"),
    sys("milestone"),
    sys("dates"),
  ],
};

const PRESETS: Record<string, DetailLayout> = {
  bug: {
    main: [sys("description"), fld("steps"), fld("expected"), fld("actual"), sys("relations"), sys("activity")],
    sidebar: [
      sys("status"),
      sys("assignee"),
      sys("reporter"),
      sys("priority"),
      fld("severity"),
      fld("environment"),
      fld("version"),
      sys("sprint"),
      sys("milestone"),
      sys("dates"),
    ],
  },
  requirement: {
    main: [sys("description"), sys("graph"), sys("relations"), sys("activity")],
    sidebar: [
      sys("status"),
      sys("assignee"),
      sys("reporter"),
      sys("priority"),
      fld("source"),
      fld("value"),
      sys("sprint"),
      sys("milestone"),
      sys("dates"),
    ],
  },
  feature: {
    main: [sys("description"), sys("graph"), sys("relations"), sys("activity")],
    sidebar: [
      sys("status"),
      sys("assignee"),
      sys("priority"),
      fld("module"),
      sys("sprint"),
      sys("milestone"),
      sys("dates"),
    ],
  },
  task: {
    main: [sys("description"), sys("relations"), sys("activity")],
    sidebar: [
      sys("status"),
      sys("assignee"),
      sys("reporter"),
      sys("priority"),
      fld("estimate"),
      sys("sprint"),
      sys("milestone"),
      sys("dates"),
    ],
  },
  test_case: {
    main: [
      sys("description"),
      fld("precondition"),
      fld("steps"),
      fld("expected"),
      sys("relations"),
      sys("activity"),
    ],
    sidebar: [sys("status"), sys("assignee"), fld("result"), sys("dates")],
  },
  test_task: {
    main: [sys("description"), sys("relations"), sys("activity")],
    sidebar: [sys("status"), sys("assignee"), fld("stage"), fld("env"), sys("sprint"), sys("dates")],
  },
  incident: {
    main: [sys("description"), sys("relations"), sys("activity")],
    sidebar: [
      sys("status"),
      sys("assignee"),
      sys("reporter"),
      sys("priority"),
      fld("severity"),
      sys("dates"),
    ],
  },
  issue: {
    main: [sys("description"), sys("relations"), sys("activity")],
    sidebar: [sys("status"), sys("assignee"), sys("priority"), fld("kind"), sys("sprint"), sys("dates")],
  },
};

export function typeFields(raw: Array<Record<string, unknown>> | undefined): TypeField[] {
  return (raw ?? [])
    .map((f) => ({
      key: String(f.key ?? ""),
      name: String(f.name ?? ""),
      type: String(f.type ?? "text"),
      options: Array.isArray(f.options) ? f.options.map(String) : undefined,
    }))
    .filter((f) => f.key);
}

export function defaultLayout(typeKey: string): DetailLayout {
  const preset = PRESETS[typeKey] ?? GENERIC;
  return ensureDocs({
    main: preset.main.map((b) => ({ ...b })),
    sidebar: preset.sidebar.map((b) => ({ ...b })),
  });
}

export function resolveLayout(
  typeKey: string,
  stored: DetailLayout | null | undefined,
  fields: TypeField[],
): DetailLayout {
  const fieldKeys = fields.map((f) => f.key);
  const fieldSet = new Set(fieldKeys);
  const source =
    stored && (stored.main?.length || stored.sidebar?.length) ? stored : defaultLayout(typeKey);
  const main = [...(source.main ?? [])];
  const sidebar = [...(source.sidebar ?? [])];
  const placed = new Set(
    [...main, ...sidebar].filter((b) => b.kind === "field").map((b) => b.key),
  );
  for (const key of fieldKeys) {
    if (!placed.has(key)) sidebar.push(fld(key));
  }
  const keep = (b: LayoutBlock) => (b.kind === "field" ? fieldSet.has(b.key) : Boolean(b.key));
  return ensureDocs({ main: main.filter(keep), sidebar: sidebar.filter(keep) });
}

export function blockLabel(block: LayoutBlock, fields: TypeField[]): string {
  if (block.kind === "system") return SYSTEM_BLOCKS[block.key]?.name ?? block.key;
  return fields.find((f) => f.key === block.key)?.name ?? block.key;
}

export function editorLayout(
  typeKey: string,
  stored: DetailLayout | null | undefined,
): DetailLayout {
  if (stored && (stored.main?.length || stored.sidebar?.length)) {
    return {
      main: [...(stored.main ?? [])],
      sidebar: [...(stored.sidebar ?? [])],
    };
  }
  return defaultLayout(typeKey);
}

export function unusedBlocks(layout: DetailLayout, fields: TypeField[]): LayoutBlock[] {
  const used = new Set([...layout.main, ...layout.sidebar].map((b) => `${b.kind}:${b.key}`));
  const out: LayoutBlock[] = [];
  for (const key of Object.keys(SYSTEM_BLOCKS)) {
    const id = `system:${key}`;
    if (!used.has(id)) out.push(sys(key));
  }
  for (const f of fields) {
    const id = `field:${f.key}`;
    if (!used.has(id)) out.push(fld(f.key));
  }
  return out;
}
