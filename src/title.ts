const combiningMark = /\p{Mark}/u;
const emoji = /\p{Extended_Pictographic}/u;

export function normalizeTitle(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateDisplayWidth(value: string, maxWidth: number, ellipsis = "…"): string {
  const normalized = normalizeTitle(value);
  if (!normalized || maxWidth <= 0) {
    return "";
  }

  const segments = graphemes(normalized);
  const fullWidth = segments.reduce((sum, segment) => sum + graphemeWidth(segment), 0);
  if (fullWidth <= maxWidth) {
    return normalized;
  }

  const safeEllipsis = normalizeTitle(ellipsis);
  const ellipsisWidth = graphemes(safeEllipsis).reduce(
    (sum, segment) => sum + graphemeWidth(segment),
    0
  );
  const contentWidth = Math.max(0, maxWidth - Math.min(maxWidth, ellipsisWidth));
  let used = 0;
  let result = "";

  for (const segment of segments) {
    const width = graphemeWidth(segment);
    if (used + width > contentWidth) {
      break;
    }
    result += segment;
    used += width;
  }

  if (!safeEllipsis || ellipsisWidth > maxWidth) {
    return result;
  }
  return result + safeEllipsis;
}

export function titleForThread(
  name: string | null | undefined,
  preview: string | null | undefined,
  maxPromptWidth: number,
  ellipsis: string
): string {
  const generatedName = normalizeTitle(name);
  if (generatedName) {
    return generatedName;
  }
  return truncateDisplayWidth(preview ?? "", maxPromptWidth, ellipsis) || "Codex";
}

function graphemes(value: string): string[] {
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(value), item => item.segment);
  }
  return Array.from(value);
}

function graphemeWidth(value: string): number {
  if (!value) {
    return 0;
  }
  if (emoji.test(value)) {
    return 2;
  }
  const first = value.codePointAt(0);
  if (first === undefined || combiningMark.test(value[0] ?? "")) {
    return 0;
  }
  return isWide(first) ? 2 : 1;
}

function isWide(codePoint: number): boolean {
  return (
    codePoint >= 0x1100 &&
    (codePoint <= 0x115f ||
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
      (codePoint >= 0xff00 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x20000 && codePoint <= 0x3fffd))
  );
}
