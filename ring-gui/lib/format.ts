import type { AcceptanceCriterion } from "@ring-gui/types/api";

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
});

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateTimeFormatter.format(parsed);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "--";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "--";
  }

  return `${Math.round(value * 100)}%`;
}

export function titleize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function sortByUpdatedAt<T extends { updated_at: string }>(items: T[]): T[] {
  return [...items].sort(
    (left, right) =>
      new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
  );
}

export function sortByCreatedAt<T extends { created_at: string }>(items: T[]): T[] {
  return [...items].sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
}

export function parseLines(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function buildAcceptanceCriteria(value: string): AcceptanceCriterion[] {
  return parseLines(value).map((description, index) => ({
    id: `ac${index + 1}`,
    description,
    satisfied: false,
  }));
}

export function safeJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
