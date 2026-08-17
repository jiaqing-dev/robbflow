import type { WorkItemType, Workflow } from "@/lib/api";

export const TYPE_GROUPS = [
  {
    id: "product",
    title: "产品与需求",
    hint: "需求可关联项目；功能点挂在需求下；事项可转为缺陷 / 需求 / 任务。",
    keys: ["requirement", "feature", "issue"],
  },
  {
    id: "eng",
    title: "研发执行",
    hint: "任务实现需求与功能点，缺陷可挂修复任务。",
    keys: ["task", "bug", "improvement", "action"],
  },
  {
    id: "qa",
    title: "测试与质量",
    hint: "测试任务可关联需求、功能点、缺陷，并覆盖用例。",
    keys: ["test_task", "test_case"],
  },
  {
    id: "ops",
    title: "风险与事故",
    hint: "可归属项目，并拆出应对或止血任务。",
    keys: ["incident", "risk"],
  },
] as const;

export const RELATION_DEMO: Array<{ from: string; rel: string; to: string }> = [
  { from: "项目", rel: "归属", to: "需求" },
  { from: "需求", rel: "分解", to: "功能点" },
  { from: "功能点", rel: "实现", to: "任务" },
  { from: "需求", rel: "提测", to: "测试任务" },
  { from: "测试任务", rel: "覆盖", to: "用例" },
  { from: "事项", rel: "转缺陷", to: "缺陷" },
  { from: "缺陷", rel: "修复", to: "任务" },
];

export function groupedTypes(types: WorkItemType[]) {
  const used = new Set<string>();
  const groups: Array<{
    id: string;
    title: string;
    hint: string;
    keys: readonly string[];
    items: WorkItemType[];
  }> = TYPE_GROUPS.map((g) => {
    const items = g.keys
      .map((key) => types.find((t) => t.key === key))
      .filter((t): t is WorkItemType => Boolean(t));
    items.forEach((t) => used.add(t.key));
    return { ...g, items };
  });
  const rest = types.filter((t) => !used.has(t.key));
  if (rest.length) {
    groups.push({
      id: "other",
      title: "自定义类型",
      hint: "在类型关系图中新建的工作项类型。",
      keys: rest.map((t) => t.key),
      items: rest,
    });
  }
  return groups.filter((g) => g.items.length > 0);
}

export function groupedWorkflows(workflows: Workflow[]) {
  const buckets: Record<string, Workflow[]> = {
    engineering: [],
    product: [],
    bug: [],
    qa: [],
    custom: [],
  };
  for (const w of workflows) {
    if (w.key === "engineering") buckets.engineering.push(w);
    else if (w.key === "product") buckets.product.push(w);
    else if (w.key === "bug") buckets.bug.push(w);
    else if (w.key === "test_case" || w.key === "test_task") buckets.qa.push(w);
    else buckets.custom.push(w);
  }
  return [
    {
      id: "engineering",
      title: "任务状态流",
      hint: "待规划 → 进行中 → 评审 → 测试 → 完成。绑定任务、改进、行动项。",
      items: buckets.engineering,
    },
    {
      id: "product",
      title: "需求状态流",
      hint: "想法 → 调研 → 方案 → 研发 → 上线。绑定需求与功能点。",
      items: buckets.product,
    },
    {
      id: "bug",
      title: "缺陷状态流",
      hint: "待处理 → 修复中 → 待验证 → 已关闭，可标为非问题并重开。",
      items: buckets.bug,
    },
    {
      id: "qa",
      title: "测试状态流",
      hint: "用例是草稿→生效的资产流；测试任务是待提测→测试中→完成的执行流。",
      items: buckets.qa,
    },
    {
      id: "custom",
      title: "自定义状态流",
      hint: "从模板复制后可自行改节点与流转。",
      items: buckets.custom,
    },
  ].filter((g) => g.items.length > 0);
}
