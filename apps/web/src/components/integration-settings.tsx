"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ApiError, authApi, dataApi } from "@/lib/api";

const FIELDS: Record<string, Array<{ key: string; label: string; secret?: boolean }>> = {
  feishu: [
    { key: "app_id", label: "App ID" },
    { key: "app_secret", label: "App Secret", secret: true },
  ],
  dingtalk: [
    { key: "app_id", label: "App Key" },
    { key: "app_secret", label: "App Secret", secret: true },
  ],
  wecom: [
    { key: "app_id", label: "Corp ID" },
    { key: "app_secret", label: "Secret", secret: true },
  ],
  drive: [
    { key: "kind", label: "类型（s3 / webdav）" },
    { key: "endpoint", label: "Endpoint" },
    { key: "bucket", label: "Bucket / 路径" },
    { key: "access_key", label: "Access Key", secret: true },
    { key: "secret_key", label: "Secret Key", secret: true },
  ],
  oa: [{ key: "webhook_url", label: "出站 Webhook URL" }],
  github: [{ key: "token", label: "Token", secret: true }],
  gitlab: [
    { key: "url", label: "GitLab URL" },
    { key: "token", label: "Token", secret: true },
  ],
};

const BIND_PROVIDERS = [
  ["feishu", "飞书"],
  ["dingtalk", "钉钉"],
  ["wecom", "企微"],
] as const;

export function IntegrationSettings() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: authApi.me });
  const rows = useQuery({ queryKey: ["integrations"], queryFn: dataApi.integrations });
  const bindings = useQuery({ queryKey: ["bindings"], queryFn: dataApi.bindings });
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [bindDraft, setBindDraft] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const save = useMutation({
    mutationFn: ({ provider, config }: { provider: string; config: Record<string, string> }) =>
      dataApi.saveIntegration(provider, config, true),
    onSuccess: (res) => {
      setMsg(res.connected ? `${res.provider} 已连通` : `${res.provider} 已保存（尚未连通）`);
      qc.invalidateQueries({ queryKey: ["integrations"] });
    },
    onError: (err: unknown) => setMsg(err instanceof ApiError ? err.message : "保存失败"),
  });
  const bind = useMutation({
    mutationFn: ({ provider, external_id }: { provider: string; external_id: string }) =>
      dataApi.bindIdentity(provider, external_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bindings"] }),
  });
  const oidc = useMutation({
    mutationFn: (provider: string) => dataApi.oidc(provider),
  });

  const isAdmin = me.data?.role === "owner" || me.data?.role === "admin";

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-1 text-[13px] font-medium">办公集成</h2>
        <p className="mb-4 text-[12px] text-[#8b90a0]">
          凭证存服务端 secret 表，不明文进仓库。通知走飞书/钉钉卡片；网盘只引用；OA 只做 Webhook，不内嵌表单。
        </p>
        <div className="space-y-3">
          {(rows.data ?? []).map((row) => {
            const fields = FIELDS[row.key] ?? [{ key: "token", label: "配置", secret: true }];
            const draft = drafts[row.key] ?? {};
            return (
              <div key={row.key} className="rounded-xl border border-[#232633] bg-[#12141a] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-[13px]">{row.name}</div>
                    <div className="text-[11px] text-[#6d7280]">
                      {row.status === "connected" ? "已连通" : row.status === "configured" ? "已配置" : "未配置"}
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {fields.map((f) => (
                      <input
                        key={f.key}
                        type={f.secret ? "password" : "text"}
                        value={draft[f.key] ?? ""}
                        placeholder={f.label}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.key]: { ...(prev[row.key] ?? {}), [f.key]: e.target.value },
                          }))
                        }
                        className="rounded-md border border-[#2a2e3a] bg-[#0b0c0e] px-2 py-1.5 text-[12px] outline-none focus:border-[#ff6a2b]"
                      />
                    ))}
                  </div>
                )}
                {isAdmin && (
                  <button
                    onClick={() => save.mutate({ provider: row.key, config: draft })}
                    disabled={save.isPending}
                    className="mt-3 rounded-md bg-[#ff6a2b] px-3 py-1.5 text-[12px] font-medium text-black disabled:opacity-40"
                  >
                    保存
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {msg && <p className="mt-2 text-[12px] text-[#8b90a0]">{msg}</p>}
      </section>

      <section>
        <h2 className="mb-1 text-[13px] font-medium">绑定 IM 账号</h2>
        <p className="mb-3 text-[12px] text-[#8b90a0]">
          社区版先绑定外部用户 ID，状态变更才能把卡片打到你。扫码 OIDC 为企业版预留。
        </p>
        <div className="space-y-2">
          {BIND_PROVIDERS.map(([key, label]) => {
            const existing = (bindings.data ?? []).find((b) => b.provider === key);
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="w-12 text-[12px] text-[#8b90a0]">{label}</span>
                <input
                  value={bindDraft[key] ?? existing?.external_id ?? ""}
                  onChange={(e) => setBindDraft((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder="外部用户 ID"
                  className="flex-1 rounded-md border border-[#2a2e3a] bg-[#0b0c0e] px-2 py-1.5 text-[12px]"
                />
                <button
                  onClick={() =>
                    bind.mutate({
                      provider: key,
                      external_id: (bindDraft[key] ?? existing?.external_id ?? "").trim(),
                    })
                  }
                  disabled={!(bindDraft[key] ?? existing?.external_id)}
                  className="text-[12px] text-[#ffb088] disabled:opacity-40"
                >
                  绑定
                </button>
                <button
                  onClick={() => oidc.mutate(key)}
                  className="text-[11px] text-[#6d7280]"
                >
                  扫码登录
                </button>
              </div>
            );
          })}
        </div>
        {oidc.data && <p className="mt-2 text-[12px] text-[#8b90a0]">{oidc.data.hint}</p>}
      </section>
    </div>
  );
}
