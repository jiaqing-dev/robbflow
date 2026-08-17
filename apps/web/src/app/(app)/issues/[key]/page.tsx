"use client";

import { useParams } from "next/navigation";

import { IssueDetail } from "@/components/issue-detail";

export default function IssuePage() {
  const { key } = useParams<{ key: string }>();
  return <IssueDetail issueKey={key} />;
}
