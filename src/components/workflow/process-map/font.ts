/**
 * The diagram's font. On screen the diagram uses the Inter that the page already loaded (through the CSS variable
 * next/font sets). A downloaded SVG or PNG, or the PDF print window, is a separate document that cannot see the page's
 * fonts, so those carry a copy of Inter inside them. Without that they would fall back to whatever font the reader's
 * computer has, and the picture would not look like the screen.
 */
export const DIAGRAM_FONT = `var(--font-inter), "Inter", system-ui, -apple-system, "Segoe UI", sans-serif`;
const EXPORT_FAMILY = "Inter";
const EXPORT_STACK = `${EXPORT_FAMILY}, system-ui, -apple-system, "Segoe UI", sans-serif`;

let cached: string | null = null;
let loading: Promise<string> | null = null;

function toBase64(bytes: ArrayBuffer): string {
  let binary = "";
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 0x8000) binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Finds the page's Inter font files in its stylesheets, fetches them and returns @font-face CSS with the data inside. "" if it cannot. */
async function buildFontCss(): Promise<string> {
  const urls = new Set<string>();
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // a stylesheet from another site cannot be read
    }
    for (const rule of Array.from(rules)) {
      if (rule.type !== CSSRule.FONT_FACE_RULE) continue;
      const style = (rule as CSSFontFaceRule).style;
      if (!/inter/i.test(style.getPropertyValue("font-family")) || /fallback/i.test(style.getPropertyValue("font-family"))) continue;
      // The page lists one file per alphabet. Only the Latin one is carried, to keep downloads small. Browsers write its
      // range as "U+0-FF", so both spellings are accepted.
      if (!/U\+0+-0*FF\b/i.test(style.getPropertyValue("unicode-range"))) continue;
      const match = style.getPropertyValue("src").match(/url\(["']?([^"')]+)["']?\)/);
      // A font address in a stylesheet is relative to that stylesheet, not to the page.
      if (match) urls.add(new URL(match[1], sheet.href ?? document.baseURI).href);
    }
  }
  const faces: string[] = [];
  for (const href of urls) {
    const res = await fetch(href);
    if (!res.ok) continue;
    const data = toBase64(await res.arrayBuffer());
    faces.push(`@font-face{font-family:${EXPORT_FAMILY};font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,${data}) format("woff2")}`);
  }
  return faces.join("\n");
}

/** Starts loading the font copy (once). Call it early, for example when the download menu opens, so a later sync export can use it. */
export function preloadExportFont(): Promise<string> {
  if (cached !== null) return Promise.resolve(cached);
  loading ??= buildFontCss()
    .catch(() => "")
    .then((css) => {
      cached = css;
      return css;
    });
  return loading;
}

/** The font copy if it has finished loading, otherwise "" (the export then uses the reader's own font). */
export function exportFontCss(): string {
  return cached ?? "";
}

export const EXPORT_FONT_STACK = EXPORT_STACK;

/** Makes an SVG string stand on its own: the font name is spelled out and the font itself is embedded when available. */
export function embedFont(svg: string): string {
  const css = exportFontCss();
  const withFamily = svg.split(DIAGRAM_FONT).join(EXPORT_STACK);
  if (!css) return withFamily;
  return withFamily.replace(/<svg\b[^>]*>/, (open) => `${open}<defs><style>${css}</style></defs>`);
}
