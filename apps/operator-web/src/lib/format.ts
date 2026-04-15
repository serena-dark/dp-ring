export function titleize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return "—";
  }
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function initials(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("")
    .slice(0, 2);
}
