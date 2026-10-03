/** Strips HTML tags and trims. One copy, used by every workflow route (it used to be pasted into five files). */
export function sanitizeText(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}
