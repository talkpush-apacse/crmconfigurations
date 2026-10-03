import { createElement, Fragment, type ReactElement, type ReactNode } from "react";
import { SceneSvg } from "@/components/workflow/process-map/shapes";
import type { Scene } from "@/lib/workflow/process-map/scene";

/**
 * Draws the diagram to an SVG string on the server (for render_preview).
 *
 * Next.js does not allow server code to import React's own server renderer, and the diagram does not need it: its
 * drawing components use only plain SVG elements and simple function components. This small serializer walks those
 * and writes the markup. A test checks that its output is identical to React's own renderer for real diagrams, so the
 * server preview is exactly what the screen and the downloads show.
 */

type Props = Record<string, unknown> & { children?: ReactNode };

// SVG attributes whose real name is camelCase; everything else camelCase becomes kebab-case (strokeWidth -> stroke-width).
const KEEP_CAMEL = new Set(["viewBox", "refX", "refY", "markerWidth", "markerHeight", "preserveAspectRatio"]);
const RENAME: Record<string, string> = { className: "class", htmlFor: "for" };

const escapeText = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" })[c]!);

function attrName(key: string): string {
  if (RENAME[key]) return RENAME[key];
  if (KEEP_CAMEL.has(key) || key.startsWith("aria-") || key.startsWith("data-")) return key;
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function serializeAttrs(props: Props): string {
  let out = "";
  for (const [key, value] of Object.entries(props)) {
    if (key === "children" || key === "key" || key === "ref" || value === undefined || value === null || value === false) continue;
    out += ` ${attrName(key)}="${escapeText(value === true ? "true" : String(value))}"`;
  }
  return out;
}

function render(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string") return escapeText(node);
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(render).join("");
  const el = node as ReactElement<Props>;
  const type = el.type as unknown;
  if (type === Fragment) return render(el.props.children);
  if (typeof type === "string") {
    return `<${type}${serializeAttrs(el.props)}>${render(el.props.children)}</${type}>`;
  }
  if (typeof type === "function") return render((type as (p: Props) => ReactNode)(el.props));
  throw new Error("The diagram uses a component this simple renderer does not support.");
}

/** Renders any element built from plain SVG elements and plain function components. */
export function renderElementToString(element: ReactNode): string {
  return render(element);
}

export function renderSceneSvg(scene: Scene): string {
  return renderElementToString(createElement(SceneSvg, { scene }));
}
