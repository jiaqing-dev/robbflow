import type { Project, WorkTemplate } from "@/lib/api";

export function projectTemplates(project: Project | undefined, catalog: WorkTemplate[]): WorkTemplate[] {
  const keys = project?.templates?.length ? project.templates : ["engineering"];
  return keys
    .map((key) => catalog.find((row) => row.key === key))
    .filter((row): row is WorkTemplate => Boolean(row));
}

export function projectTypeKeys(project: Project | undefined, catalog: WorkTemplate[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tpl of projectTemplates(project, catalog)) {
    for (const table of tpl.tables) {
      if (!seen.has(table.type_key)) {
        seen.add(table.type_key);
        out.push(table.type_key);
      }
    }
  }
  return out;
}
