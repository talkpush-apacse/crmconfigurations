import type { ReactElement } from "react";
import { createElement } from "react";
import { BADGE_ICONS } from "./icon-data";
import { pathFromPoints } from "@/lib/workflow/process-map/route";
import type { LegendRow, Scene, SceneContainer, SceneEdge, SceneShape, SceneTable } from "@/lib/workflow/process-map/scene";
import type { Run, TextLine } from "@/lib/workflow/process-map/text-fit";
import { PM } from "@/lib/workflow/process-map/tokens";

/**
 * The ONLY place a Process Map diagram is drawn. The editor canvas, the client page and the SVG / PNG / PDF exports
 * all render these components, so what a client sees on screen is what ends up in the file.
 */

const FONT = `"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif`;
const BODY = 11;
const LINE = PM.type.lineH;

function Runs({ runs, fill }: { runs: Run[]; fill: string }) {
  return (
    <>
      {runs.map((r, i) => (
        <tspan key={i} fontWeight={r.bold ? 700 : 400} fontStyle={r.italic ? "italic" : "normal"} fontSize={r.size ?? BODY} fill={r.muted ? PM.colors.muted : fill}>
          {r.text}
        </tspan>
      ))}
    </>
  );
}

function Lines({ lines, w, h, align, fill, anchor }: { lines: TextLine[]; w: number; h: number; align: "top" | "center"; fill: string; anchor: "start" | "middle" }) {
  const startY = align === "center" ? (h - lines.length * LINE) / 2 + 13 : 22;
  const x = anchor === "middle" ? w / 2 : PM.type.pad;
  return (
    <g fontFamily={FONT} textAnchor={anchor}>
      {lines.map((l, i) => (
        <text key={i} x={x} y={startY + i * LINE} fontSize={BODY} fill={fill}>
          <Runs runs={l.runs} fill={fill} />
        </text>
      ))}
    </g>
  );
}

function Badge({ icon, color }: { icon: string; color: string }) {
  const size = PM.size.badgeH;
  const nodes = BADGE_ICONS[icon] ?? BADGE_ICONS.Cog;
  return (
    <g transform={`translate(0 ${-size - 6})`} aria-hidden>
      <rect width={size} height={size} rx={9} fill={color} />
      <svg x={9} y={9} width={size - 18} height={size - 18} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {nodes.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
      </svg>
    </g>
  );
}

/** One step, drawn with its top-left corner at (0, 0). */
export function ShapeBody({ shape }: { shape: SceneShape }): ReactElement {
  const { w, h } = shape.rect;
  const { fill, stroke, dashed, textColor, kind, box } = shape;
  const dash = dashed ? "6 4" : undefined;
  const common = { fill, stroke, strokeWidth: 1.25, strokeDasharray: dash } as const;
  switch (kind) {
    case "decision":
      return (
        <g>
          <polygon points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`} {...common} />
          <Lines lines={box.lines} w={w} h={h} align="center" fill={textColor} anchor="middle" />
        </g>
      );
    case "start":
    case "end":
      return (
        <g>
          <rect width={w} height={h} rx={h / 2} {...common} />
          <Lines lines={box.lines} w={w} h={h} align="center" fill={textColor} anchor="middle" />
        </g>
      );
    case "jump":
      return (
        <g>
          <circle cx={w / 2} cy={h / 2} r={w / 2} {...common} />
          <Lines lines={box.lines} w={w} h={h} align="center" fill={textColor} anchor="middle" />
        </g>
      );
    default: {
      const shapeKind = shape.node?.data?.shapeKind;
      const body =
        shapeKind === "display" ? (
          <path d={`M${h / 3} 0 H${w - h / 3} Q${w} 0 ${w} ${h / 2} Q${w} ${h} ${w - h / 3} ${h} H${h / 3} L0 ${h / 2} Z`} {...common} />
        ) : shapeKind === "document" ? (
          <path d={`M0 0 H${w} V${h - 14} Q${w * 0.75} ${h - 28} ${w / 2} ${h - 14} T0 ${h - 14} Z`} {...common} />
        ) : (
          <rect width={w} height={h} rx={2} {...common} />
        );
      return (
        <g>
          {body}
          <Lines lines={box.lines} w={w} h={h} align={box.align} fill={textColor} anchor="middle" />
          {box.badge && <Badge icon={box.badge.icon} color={box.badge.color} />}
        </g>
      );
    }
  }
}

export function ArrowDefs() {
  return (
    <defs>
      <marker id="pm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill={PM.colors.line} />
      </marker>
    </defs>
  );
}

export function EdgeBody({ edge }: { edge: SceneEdge }): ReactElement {
  return (
    <g>
      <path d={pathFromPoints(edge.points, 0)} fill="none" stroke={PM.colors.line} strokeWidth={1.25} markerEnd="url(#pm-arrow)" />
      {edge.label && edge.labelRect && (
        <g fontFamily={FONT}>
          <rect x={edge.labelRect.x} y={edge.labelRect.y} width={edge.labelRect.w} height={edge.labelRect.h} rx={3} fill="#FFFFFF" fillOpacity={0.92} />
          <text x={edge.labelRect.x + edge.labelRect.w / 2} y={edge.labelRect.y + 15} fontSize={13} textAnchor="middle" fill={PM.colors.text}>
            {edge.label}
          </text>
        </g>
      )}
    </g>
  );
}

export function ContainerBody({ container }: { container: SceneContainer }): ReactElement {
  const { w, h } = container.rect;
  const tabW = Math.min(w - 20, Math.max(120, container.title.length * 7.6 + 24));
  return (
    <g fontFamily={FONT}>
      <rect width={w} height={h} rx={18} fill="none" stroke={PM.colors.containerBorder} strokeWidth={1.5} />
      <rect x={0} y={-PM.size.tabH} width={tabW} height={PM.size.tabH} rx={4} fill={PM.colors.containerTab} />
      <text x={10} y={-PM.size.tabH + 16} fontSize={12} fill="#FFFFFF" fontWeight={600}>
        {container.title}
      </text>
    </g>
  );
}

export function TitleBody({ scene }: { scene: Scene }): ReactElement {
  const { w } = scene.title.rect;
  return (
    <g fontFamily={FONT} textAnchor="middle">
      {scene.title.lines.map((l, i) => (
        <text key={i} x={w / 2} y={i === 0 ? 18 : 36} fontSize={l.size} fontWeight={l.bold ? 700 : 400} fill={i === 0 ? PM.colors.text : PM.colors.muted}>
          {l.text}
        </text>
      ))}
    </g>
  );
}

function Swatch({ row }: { row: LegendRow }) {
  const { fill, stroke, dashed, shape } = row.swatch;
  const common = { fill, stroke, strokeWidth: 1.2, strokeDasharray: dashed ? "4 3" : undefined } as const;
  if (shape === "diamond") return <polygon points="13,2 25,13 13,24 1,13" {...common} />;
  if (shape === "circle") {
    return (
      <>
        <circle cx={13} cy={13} r={11} {...common} />
        {row.swatch.glyph && (
          <text x={13} y={18} fontSize={13} fontWeight={700} textAnchor="middle" fill={PM.colors.text}>
            {row.swatch.glyph}
          </text>
        )}
      </>
    );
  }
  if (shape === "pill") return <rect x={1} y={5} width={24} height={16} rx={8} {...common} />;
  if (shape === "display") return <path d="M6 3 H20 Q25 3 25 13 Q25 23 20 23 H6 L1 13 Z" {...common} />;
  return <rect x={1} y={4} width={24} height={18} rx={2} {...common} />;
}

export function LegendBody({ scene }: { scene: Scene }): ReactElement | null {
  const { rect, rows } = scene.legend;
  if (rows.length === 0) return null;
  return (
    <g fontFamily={FONT}>
      <rect width={rect.w} height={rect.h} rx={14} fill="none" stroke={PM.colors.containerBorder} strokeWidth={1.5} />
      <rect x={0} y={-PM.size.tabH} width={92} height={PM.size.tabH} rx={4} fill={PM.colors.containerTab} />
      <text x={10} y={-PM.size.tabH + 16} fontSize={12} fill="#FFFFFF" fontWeight={600}>Diagram key</text>
      {rows.map((r, i) => (
        <g key={r.key} transform={`translate(16 ${22 + i * 32})`}>
          <Swatch row={r} />
          <text x={38} y={17} fontSize={11} fill={PM.colors.text}>{r.label}</text>
        </g>
      ))}
    </g>
  );
}

/** A table in the diagram, drawn with its top-left corner at (0, 0). */
export function TableBody({ table }: { table: SceneTable }): ReactElement {
  const captionH = (table.caption ? 22 : 0) + (table.subtitle ? 18 : 0);
  const colX: number[] = [];
  table.columns.reduce((x, c) => (colX.push(x), x + c.w), 0);
  const rowY: number[] = [];
  table.rows.reduce((y, r) => (rowY.push(y), y + r.h), captionH + table.headerH);
  return (
    <g fontFamily={FONT}>
      {table.caption && <text x={0} y={15} fontSize={13} fontWeight={700} fill={PM.colors.text}>{table.caption}</text>}
      {table.subtitle && <text x={0} y={(table.caption ? 22 : 0) + 13} fontSize={10} fill={PM.colors.muted}>{table.subtitle}</text>}
      {table.columns.map((c, ci) => (
        <g key={c.id} transform={`translate(${colX[ci]} ${captionH})`}>
          <rect width={c.w} height={table.headerH} fill={PM.colors.tableHeader} stroke={PM.colors.stroke} strokeWidth={1} />
          <text x={c.w / 2} y={table.headerH / 2 + 4} fontSize={11} fontWeight={700} textAnchor="middle" fill={PM.colors.text}>{c.label}</text>
        </g>
      ))}
      {table.rows.map((row, ri) =>
        table.columns.map((c, ci) => (
          <g key={`${ri}:${c.id}`} transform={`translate(${colX[ci]} ${rowY[ri]})`}>
            <rect width={c.w} height={row.h} fill={row.highlight[ci] ? PM.colors.tableHighlight : "#FFFFFF"} stroke={PM.colors.stroke} strokeWidth={1} />
            {row.cells[ci].map((t, li) => (
              <text key={li} x={c.w / 2} y={19 + li * 17} fontSize={10.5} textAnchor="middle" fill={PM.colors.text}>{t}</text>
            ))}
          </g>
        ))
      )}
    </g>
  );
}

/** The whole diagram as one SVG document (used for SVG / PNG / print export). */
export function SceneSvg({ scene, background = "#FFFFFF" }: { scene: Scene; background?: string }): ReactElement {
  const b = scene.bounds;
  const order: Record<string, number> = { note: 0, process: 1, decision: 1, start: 1, end: 1, jump: 1, table: 1, container: 0, none: 0 };
  const shapes = [...scene.shapes].sort((x, y) => (order[x.kind] ?? 1) - (order[y.kind] ?? 1));
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={b.w} height={b.h} viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} role="img" aria-label={`${scene.title.lines[0]?.text ?? "Workflow"} diagram`}>
      <ArrowDefs />
      <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={background} />
      <g transform={`translate(${scene.title.rect.x} ${scene.title.rect.y})`}><TitleBody scene={scene} /></g>
      {scene.containers.map((c) => (
        <g key={c.id} transform={`translate(${c.rect.x} ${c.rect.y})`}><ContainerBody container={c} /></g>
      ))}
      <g transform={`translate(${scene.legend.rect.x} ${scene.legend.rect.y})`}><LegendBody scene={scene} /></g>
      {scene.tables.map((t) => (
        <g key={t.id} transform={`translate(${t.rect.x} ${t.rect.y})`}><TableBody table={t} /></g>
      ))}
      {scene.edges.map((e) => <EdgeBody key={e.id} edge={e} />)}
      {shapes.map((s) => (
        <g key={s.id} transform={`translate(${s.rect.x} ${s.rect.y})`}><ShapeBody shape={s} /></g>
      ))}
    </svg>
  );
}
