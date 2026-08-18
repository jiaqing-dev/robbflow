"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { dataApi } from "@/lib/api";

export function NotificationBell() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const notes = useQuery({
    queryKey: ["notifications"],
    queryFn: () => dataApi.notifications(),
    refetchInterval: 30_000,
  });
  const unread = (notes.data ?? []).filter((n) => !n.read_at).length;
  const readOne = useMutation({
    mutationFn: (id: string) => dataApi.readNotification(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const readAll = useMutation({
    mutationFn: () => dataApi.readAllNotifications(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative text-[#8b90a0] hover:text-white"
        aria-label="通知"
      >
        <Bell size={13} />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#ff6a2b] px-0.5 text-[9px] text-black">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute bottom-7 left-0 z-40 w-[320px] overflow-hidden rounded-lg border border-[#232633] bg-[#12141a] shadow-xl">
          <div className="flex items-center justify-between border-b border-[#232633] px-3 py-2">
            <span className="text-[12px] font-medium">通知</span>
            <button
              type="button"
              onClick={() => readAll.mutate()}
              className="text-[11px] text-[#ffb088] disabled:opacity-40"
              disabled={!unread}
            >
              全部已读
            </button>
          </div>
          <ul className="max-h-[360px] overflow-y-auto">
            {(notes.data ?? []).length === 0 && (
              <li className="px-3 py-8 text-center text-[12px] text-[#6d7280]">还没有通知</li>
            )}
            {(notes.data ?? []).map((n) => {
              const key = typeof n.payload.key === "string" ? n.payload.key : null;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.read_at) readOne.mutate(n.id);
                      setOpen(false);
                      if (key) router.push(`/issues/${key}`);
                    }}
                    className={`block w-full px-3 py-2.5 text-left hover:bg-[#1a1d26] ${n.read_at ? "opacity-60" : ""}`}
                  >
                    <div className="text-[12px] text-[#eceef2]">{n.title}</div>
                    {n.body && <div className="mt-0.5 line-clamp-2 text-[11px] text-[#8b90a0]">{n.body}</div>}
                    <div className="mt-1 text-[10px] text-[#6d7280]">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
