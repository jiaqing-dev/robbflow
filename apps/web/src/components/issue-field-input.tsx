"use client";

import { useEffect, useState } from "react";

import type { TypeField } from "@/lib/detail-layout";

const inputClass =
  "w-full rounded-md border border-[#2a2e3a] bg-[#0b0c0e] px-2 py-1.5 text-[13px] outline-none focus:border-[#ff6a2b]";

export function IssueFieldInput({
  field,
  value,
  onChange,
  members,
  multiline,
}: {
  field: TypeField;
  value: unknown;
  onChange: (next: string | number | null) => void;
  members?: Array<{ id: string; name: string }>;
  multiline?: boolean;
}) {
  const str = value == null ? "" : String(value);
  const kind = field.type;
  const tall = multiline || kind === "textarea";
  const [draft, setDraft] = useState(str);

  useEffect(() => {
    setDraft(str);
  }, [str]);

  if (kind === "select") {
    return (
      <select value={str} onChange={(e) => onChange(e.target.value || null)} className={inputClass}>
        <option value="">未填写</option>
        {(field.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  if (kind === "user") {
    return (
      <select value={str} onChange={(e) => onChange(e.target.value || null)} className={inputClass}>
        <option value="">未指派</option>
        {(members ?? []).map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    );
  }
  if (kind === "number") {
    return (
      <input
        type="number"
        value={str}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className={inputClass}
      />
    );
  }
  if (kind === "date") {
    return (
      <input type="date" value={str.slice(0, 10)} onChange={(e) => onChange(e.target.value || null)} className={inputClass} />
    );
  }
  if (tall) {
    return (
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== str) onChange(draft || null);
        }}
        rows={5}
        placeholder={`填写${field.name}…`}
        className={`${inputClass} min-h-[96px] resize-y leading-6`}
      />
    );
  }
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== str) onChange(draft || null);
      }}
      placeholder={`填写${field.name}`}
      className={inputClass}
    />
  );
}
