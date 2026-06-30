import type { Channel } from "@/lib/campaign-packages";

export type OrderableContentRow = {
  id: string;
  platform: string;
  locale: string;
  adapted_from_id: string | null;
  scheduled_date: string | null;
  copy: string | null;
};

/**
 * Order: post slot → language (ar then en) → channel (plan order).
 * Each row is one locale × channel variant (no AR/EN toggle grouping).
 */
export function orderContentItemsForDisplay<T extends OrderableContentRow>(
  items: T[],
  channels: Channel[],
): T[] {
  const originals = items.filter((i) => !i.adapted_from_id);
  const adaptationByParent = new Map<string, T>();
  for (const item of items) {
    if (item.adapted_from_id) adaptationByParent.set(item.adapted_from_id, item);
  }

  const localesPresent: Array<"ar" | "en"> = [];
  if (items.some((i) => i.locale === "ar")) localesPresent.push("ar");
  if (items.some((i) => i.locale === "en")) localesPresent.push("en");

  const byChannel: Record<string, T[]> = {};
  for (const c of channels) byChannel[c] = [];
  for (const item of originals) {
    if (byChannel[item.platform]) byChannel[item.platform].push(item);
  }
  for (const c of channels) {
    byChannel[c].sort(
      (a, b) =>
        (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? "") ||
        a.id.localeCompare(b.id),
    );
  }

  const maxSlots = Math.max(0, ...channels.map((c) => byChannel[c]?.length ?? 0));
  const ordered: T[] = [];
  const seen = new Set<string>();

  for (let slot = 0; slot < maxSlots; slot++) {
    for (const locale of localesPresent) {
      for (const c of channels) {
        const original = byChannel[c]?.[slot];
        if (!original) continue;

        let row: T | undefined;
        if (locale === "ar") {
          row = original.locale === "ar" ? original : undefined;
        } else {
          row =
            original.locale === "en"
              ? original
              : adaptationByParent.get(original.id);
        }

        if (row && !seen.has(row.id)) {
          ordered.push(row);
          seen.add(row.id);
        }
      }
    }
  }

  for (const item of items) {
    if (!seen.has(item.id) && item.copy) {
      ordered.push(item);
    }
  }

  return ordered;
}

export function postSlotLabel(slotIndex: number): number {
  return slotIndex + 1;
}

/** Map content item id → 1-based post slot number. */
export function buildPostSlotIndexMap(
  items: OrderableContentRow[],
  channels: Channel[],
): Map<string, number> {
  const originals = items.filter((i) => !i.adapted_from_id);
  const byChannel: Record<string, OrderableContentRow[]> = {};
  for (const c of channels) byChannel[c] = [];
  for (const item of originals) {
    if (byChannel[item.platform]) byChannel[item.platform].push(item);
  }
  for (const c of channels) {
    byChannel[c].sort(
      (a, b) =>
        (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? "") ||
        a.id.localeCompare(b.id),
    );
  }

  const maxSlots = Math.max(0, ...channels.map((c) => byChannel[c]?.length ?? 0));
  const slotByOriginalId = new Map<string, number>();
  for (let slot = 0; slot < maxSlots; slot++) {
    for (const c of channels) {
      const original = byChannel[c]?.[slot];
      if (original && !slotByOriginalId.has(original.id)) {
        slotByOriginalId.set(original.id, slot);
      }
    }
  }

  const adaptationByParent = new Map<string, OrderableContentRow>();
  for (const item of items) {
    if (item.adapted_from_id) adaptationByParent.set(item.adapted_from_id, item);
  }

  const result = new Map<string, number>();
  for (const item of items) {
    const rootId = item.adapted_from_id ?? item.id;
    const slot = slotByOriginalId.get(rootId);
    if (slot !== undefined) result.set(item.id, slot);
  }
  return result;
}
