/** House style: no em dashes, including in text that comes from Wikipedia or the AI. */
export function tidy(s: string): string;
export function tidy(s: string | undefined): string | undefined;
export function tidy(s: string | undefined) {
  if (!s || !s.includes("\u2014")) return s;
  return s
    .replace(/\s*\u2014\s*/g, ", ")
    .replace(/,\s*([,.;:!?])/g, "$1")
    .replace(/^,\s*/, "");
}
