export const STATUS_LABEL: Record<string, string> = {
  backlog: "待规划",
  todo: "待处理",
  in_progress: "进行中",
  in_review: "评审中",
  testing: "测试中",
  done: "已完成",
  cancelled: "已取消",
  idea: "想法",
  discovery: "调研",
  prd: "方案",
  development: "研发",
  launch: "上线",
  open: "待处理",
  to_verify: "待验证",
  wontfix: "非问题",
  draft: "草稿",
  active: "已生效",
  deprecated: "已废弃",
  pending: "待提测",
  blocked: "阻塞",
};

export const TYPE_LABEL: Record<string, string> = {
  requirement: "需求",
  feature: "功能点",
  task: "任务",
  bug: "缺陷",
  issue: "事项",
  risk: "风险",
  improvement: "改进",
  incident: "事故",
  test_case: "用例",
  test_task: "测试任务",
  action: "行动项",
};

export const PRIORITY_LABEL: Record<string, string> = {
  urgent: "紧急",
  high: "高",
  medium: "中",
  low: "低",
  none: "—",
};

export const RELATION_LABEL: Record<string, string> = {
  blocks: "阻塞",
  depends_on: "依赖",
  relates_to: "关联",
  duplicates: "重复",
  implements: "实现",
  tested_by: "被测试",
  fixed_by: "被修复",
  parent_of: "分解",
  belongs_to: "归属",
  covers: "覆盖",
  derived_from: "派生",
};

export const CATEGORY_LABEL: Record<string, string> = {
  unstarted: "未开始",
  started: "进行中",
  completed: "已完成",
  cancelled: "已取消",
};

export const SPRINT_STATUS_LABEL: Record<string, string> = {
  planned: "已规划",
  active: "进行中",
  completed: "已完成",
};

export function typeColor(type: string) {
  switch (type) {
    case "bug":
    case "incident":
      return "text-rose-400";
    case "requirement":
    case "feature":
      return "text-violet-400";
    case "task":
      return "text-sky-400";
    case "test_task":
    case "test_case":
      return "text-amber-400";
    case "improvement":
      return "text-emerald-400";
    default:
      return "text-zinc-400";
  }
}
