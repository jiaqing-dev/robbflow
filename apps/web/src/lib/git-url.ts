export function parseGitUrl(raw: string) {
  const url = raw.trim();
  let host = "";
  let parts: string[] = [];
  try {
    const parsed = new URL(url);
    host = parsed.host.toLowerCase();
    parts = parsed.pathname.split("/").filter(Boolean);
  } catch {
    return null;
  }
  if (parts.length < 2) return null;
  const provider = host.includes("gitlab") ? "gitlab" : host.includes("github") ? "github" : "git";
  const repo = parts.slice(0, 2).join("/");
  let kind = "branch";
  let ref = "";
  if (parts[2] === "pull" || parts[2] === "merge_requests") {
    kind = "pr";
    ref = parts[3] ?? "";
  } else if (parts[2] === "commit" || parts[2] === "commits") {
    kind = "commit";
    ref = parts[3] ?? "";
  } else if (parts[2] === "tree" || parts[2] === "blob" || parts[2] === "-") {
    ref = parts.slice(parts[2] === "-" ? 4 : 3).join("/");
  }
  return { provider, repo, ref, url, kind };
}
