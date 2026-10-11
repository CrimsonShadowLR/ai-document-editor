import { diffWordsWithSpace } from "diff";

export type ChangeStatus = "pending" | "accepted" | "rejected";

/** The original text split into unchanged parts and changes the user decides on one by one. */
export type Segment =
  | { kind: "same"; text: string }
  | { kind: "change"; id: number; oldText: string; newText: string; status: ChangeStatus };

export type ChangeSegment = Extract<Segment, { kind: "change" }>;

/**
 * Word-level diff of `original` → `replacement`, grouped into reviewable changes.
 *
 * Uses `diffWordsWithSpace` so whitespace and newlines are real tokens: joining
 * every non-added part gives back `original` exactly, which matters because the
 * old text is still in the document while the user reviews.
 */
export function diffSegments(original: string, replacement: string): Segment[] {
  const segments: Segment[] = [];
  let id = 0;

  for (const part of diffWordsWithSpace(original, replacement)) {
    const last = segments.at(-1);
    if (!part.added && !part.removed) {
      segments.push({ kind: "same", text: part.value });
    } else if (last?.kind === "change") {
      if (part.added) last.newText += part.value;
      else last.oldText += part.value;
    } else {
      segments.push({
        kind: "change",
        id: id++,
        oldText: part.removed ? part.value : "",
        newText: part.added ? part.value : "",
        status: "pending",
      });
    }
  }
  return mergeSmallGaps(segments);
}

/** Most unchanged words a gap between two changes may have and still be merged. */
const MAX_GAP_WORDS = 2;

/**
 * Merge changes separated only by a short unchanged gap on the same line.
 * A rewrite otherwise splits into many tiny changes ("~~is a~~ benefits ✓✕
 * the team ~~in a lot of ways~~ …") that are tedious to review one by one.
 */
function mergeSmallGaps(segments: Segment[]): Segment[] {
  const merged: Segment[] = [];
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    const previous = merged.at(-1);
    const next = segments[index + 1];
    if (
      segment.kind === "same" &&
      isSmallGap(segment.text) &&
      previous?.kind === "change" &&
      next?.kind === "change"
    ) {
      previous.oldText += segment.text + next.oldText;
      previous.newText += segment.text + next.newText;
      index++;
      continue;
    }
    merged.push(segment.kind === "change" ? { ...segment } : segment);
  }
  return merged;
}

function isSmallGap(text: string): boolean {
  if (text.includes("\n")) return false;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return words <= MAX_GAP_WORDS;
}

/** The text the range ends up with, given each change's decision. Pending counts as rejected. */
export function resolveText(segments: Segment[]): string {
  return segments
    .map((segment) =>
      segment.kind === "same" ? segment.text : segment.status === "accepted" ? segment.newText : segment.oldText,
    )
    .join("");
}

export function changesOf(segments: Segment[]): ChangeSegment[] {
  return segments.filter((segment): segment is ChangeSegment => segment.kind === "change");
}
