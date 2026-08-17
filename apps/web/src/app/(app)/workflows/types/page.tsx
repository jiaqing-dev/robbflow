"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const TypeFlowDesigner = dynamic(
  () => import("@/components/type-flow-designer").then((m) => m.TypeFlowDesigner),
  {
    ssr: false,
    loading: () => <div className="px-6 py-16 text-[13px] text-[#6d7280]">加载类型关系图…</div>,
  },
);

export default function TypeFlowPage() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-[#232633] px-6 py-3">
        <div>
          <div className="mb-0.5 text-[12px] text-[#8b90a0]">
            <Link href="/workflows" className="hover:text-[#ffb088]">
              流程设计
            </Link>
            <span className="mx-1">/</span>
            类型关系
          </div>
          <h1 className="text-[16px] font-semibold">编辑类型关系</h1>
          <p className="text-[12px] text-[#8b90a0]">图上连线；下方表格改名称、字段、输入与输出。</p>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <TypeFlowDesigner />
      </div>
    </div>
  );
}
