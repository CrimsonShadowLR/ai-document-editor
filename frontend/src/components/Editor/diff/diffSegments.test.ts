import { describe, expect, it } from "vitest";

import { changesOf, diffSegments, resolveText, type Segment } from "./diffSegments";

function acceptAll(segments: Segment[]): Segment[] {
  return segments.map((segment) => (segment.kind === "change" ? { ...segment, status: "accepted" } : segment));
}

function pairs(segments: Segment[]) {
  return changesOf(segments).map((change) => [change.oldText, change.newText]);
}

const CASES: [string, string, string][] = [
  ["word swap", "So basically we have been thinking a lot about remote work.", "We have thought carefully about remote work."],
  ["markdown list", "- one\n- two\n\n**bold** text", "- one\n- three\n\n**bold** words here"],
  ["identical", "same text", "same text"],
  ["pure deletion", "delete me please", "please"],
  ["pure insertion", "", "x"],
  ["emoji", "emoji 🎉 here", "emoji 🚀 there"],
  ["CRLF-free multi-line", "Line one changed.\nLine two old words.", "Line one edited.\nLine two new words."],
];

describe("diffSegments", () => {
  // The original stays in the document while the user reviews, so the
  // non-added parts must rebuild it exactly, and accepting everything must
  // give exactly the AI's text.
  it.each(CASES)("rebuilds both texts exactly: %s", (_name, original, replacement) => {
    const segments = diffSegments(original, replacement);

    expect(resolveText(segments)).toBe(original);
    expect(resolveText(acceptAll(segments))).toBe(replacement);
  });

  it("finds no changes for identical text", () => {
    expect(changesOf(diffSegments("same text", "same text"))).toEqual([]);
  });

  it("starts every change as pending", () => {
    const statuses = changesOf(diffSegments("a b c", "a x c")).map((change) => change.status);

    expect(statuses).toEqual(["pending"]);
  });

  it("merges changes split by one or two unchanged words on the same line", () => {
    const segments = diffSegments(
      "Tell your manager if you want to change you're days",
      "Tell your manager if you want to change your days.",
    );

    expect(pairs(segments)).toEqual([["you're days", "your days."]]);
  });

  it("turns a full paragraph rewrite into one change", () => {
    const segments = diffSegments(
      "So basically we have been thinking a lot about remote work and we think that it is a really good idea for the team.",
      "We've considered remote work extensively and believe it benefits the team.",
    );

    expect(changesOf(segments)).toHaveLength(1);
  });

  it("never merges across a line break", () => {
    const segments = diffSegments("Line one changed.\nLine two old words.", "Line one edited.\nLine two new words.");

    expect(pairs(segments)).toEqual([
      ["changed", "edited"],
      ["old", "new"],
    ]);
  });

  it("keeps changes separate when more than two words sit between them", () => {
    const segments = diffSegments("alpha one two three omega", "ALPHA one two three OMEGA");

    expect(changesOf(segments)).toHaveLength(2);
  });

  it("applies only the accepted changes", () => {
    const segments = diffSegments("Line one changed.\nLine two old words.", "Line one edited.\nLine two new words.");
    const [first] = changesOf(segments);
    const partly = segments.map((segment) =>
      segment.kind === "change" && segment.id === first.id ? { ...segment, status: "accepted" as const } : segment,
    );

    expect(resolveText(partly)).toBe("Line one edited.\nLine two old words.");
  });
});
