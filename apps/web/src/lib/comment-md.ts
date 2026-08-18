export function renderCommentHtml(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/`([^`]+)`/g, "<code class='rounded bg-[#1a1d26] px-1'>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/@([\u4e00-\u9fa5A-Za-z0-9_.-]+)/g, '<span class="text-[#ffb088]">@$1</span>')
    .replace(/\n/g, "<br/>");
}
