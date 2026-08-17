"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { IssueDetail } from "@/components/issue-detail";

export function IssuePeek({ issueKey, onClose }: { issueKey: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="关闭" className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative z-10 flex h-full w-[min(960px,94vw)] flex-col border-l border-[#232633] bg-[#0b0c0e] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#232633] px-4 py-2">
          <Link href={`/issues/${issueKey}`} className="text-[12px] text-[#ffb088] hover:text-white">
            在新页打开
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[#8b90a0] hover:bg-[#1a1d26] hover:text-white"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <IssueDetail issueKey={issueKey} variant="peek" />
        </div>
      </div>
    </div>
  );
}
