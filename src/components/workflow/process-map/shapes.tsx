import type { ReactElement } from "react";
import { createElement } from "react";
import { BADGE_ICONS } from "./icon-data";
import { tokensFor, type Tokens } from "@/lib/workflow/process-map/tokens";
import { pathFromPoints } from "@/lib/workflow/process-map/route";
import type { LegendRow, Scene, SceneContainer, SceneEdge, SceneShape, SceneTable } from "@/lib/workflow/process-map/scene";
import type { Run, TextLine } from "@/lib/workflow/process-map/text-fit";

/**
 * The ONLY place a Process Map diagram is drawn. The editor canvas, the client page and the SVG / PNG / PDF exports
 * all render these components, so what a client sees on screen is what ends up in the file.
 */

function Runs({ runs, fill, T }: { runs: Run[]; fill: string; T: Tokens }) {
  return (
    <>
      {runs.map((r, i) => (
        <tspan key={i} fontWeight={r.bold ? 700 : 400} fontStyle={r.italic ? "italic" : "normal"} textDecoration={r.underline ? "underline" : undefined} fontSize={r.size ?? T.type.body} fill={r.muted ? T.colors.muted : fill}>
          {r.text}
        </tspan>
      ))}
    </>
  );
}

function Lines({ lines, w, h, align, fill, anchor, T }: { lines: TextLine[]; w: number; h: number; align: "top" | "center"; fill: string; anchor: "start" | "middle"; T: Tokens }) {
  const startY = align === "center" ? (h - lines.length * T.type.lineH) / 2 + 13 : 22;
  const x = anchor === "middle" ? w / 2 : T.type.pad;
  return (
    <g fontFamily={T.font} textAnchor={anchor}>
      {lines.map((l, i) => (
        <text key={i} x={x} y={startY + i * T.type.lineH} fontSize={T.type.body} fill={fill}>
          <Runs runs={l.runs} fill={fill} T={T} />
        </text>
      ))}
    </g>
  );
}

function Badge({ icon, color, T }: { icon: string; color: string; T: Tokens }) {
  const size = T.size.badgeH;
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
export function ShapeBody({ shape, look }: { shape: SceneShape; look?: string | null }): ReactElement {
  const T = tokensFor(look);
  const { w, h } = shape.rect;
  const { fill, stroke, dashed, textColor, kind, box } = shape;
  const dash = dashed ? "6 4" : undefined;
  const common = { fill, stroke, strokeWidth: 1.25, strokeDasharray: dash } as const;
  switch (kind) {
    case "decision":
      return (
        <g>
          <polygon points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`} {...common} />
          <Lines T={T} lines={box.lines} w={w} h={h} align="center" fill={textColor} anchor="middle" />
        </g>
      );
    case "start":
    case "end":
      return (
        <g>
          <rect width={w} height={h} rx={h / 2} {...common} />
          <Lines T={T} lines={box.lines} w={w} h={h} align="center" fill={textColor} anchor="middle" />
        </g>
      );
    case "jump":
      return (
        <g>
          <circle cx={w / 2} cy={h / 2} r={w / 2} {...common} />
          <Lines T={T} lines={box.lines} w={w} h={h} align="center" fill={textColor} anchor="middle" />
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
          <Lines T={T} lines={box.lines} w={w} h={h} align={box.align} fill={textColor} anchor="middle" />
          {box.badge && <Badge T={T} icon={box.badge.icon} color={box.badge.color} />}
        </g>
      );
    }
  }
}

export function ArrowDefs({ look }: { look?: string | null }) {
  const T = tokensFor(look);
  return (
    <defs>
      <marker id="pm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill={T.colors.line} />
      </marker>
      <marker id="pm-arrow-ext" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill={T.colors.externalLine} />
      </marker>
      {/* The main path is drawn thicker, and an arrowhead scales with the line, so its marker is smaller. */}
      <marker id="pm-arrow-main" viewBox="0 0 10 10" refX="9" refY="5" markerWidth={T.edge.mainMarker} markerHeight={T.edge.mainMarker} orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill={T.colors.accent} />
      </marker>
      <marker id="pm-arrow-branch" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill={T.colors.branchLine} />
      </marker>
    </defs>
  );
}

/** The main (happy) path of the diagram: the connectors the eye should follow first. */
export function isMainPath(edge: SceneEdge): boolean {
  const d = edge.edge?.data ?? {};
  return d.isPrimary === true || d.isHappyPath === true || d.pathSemantic === "happy";
}

export function EdgeBody({ edge, look }: { edge: SceneEdge; look?: string | null }): ReactElement {
  const T = tokensFor(look);
  const main = !edge.external && isMainPath(edge);
  const color = edge.external ? T.colors.externalLine : main ? T.colors.accent : T.colors.branchLine;
  return (
    <g>
      {[edge.points, ...(edge.extra ?? [])].map((pts, i) => (
        <path
          key={i}
          d={pathFromPoints(pts, 0)}
          fill="none"
          stroke={color}
          strokeWidth={edge.external ? T.edge.externalWidth : main ? T.edge.mainWidth : T.edge.branchWidth}
          strokeDasharray={edge.external ? "7 5" : undefined}
          markerEnd={edge.external ? "url(#pm-arrow-ext)" : main ? "url(#pm-arrow-main)" : "url(#pm-arrow-branch)"}
        />
      ))}
      {edge.label && edge.labelRect && (
        <g fontFamily={T.font}>
          <rect x={edge.labelRect.x} y={edge.labelRect.y} width={edge.labelRect.w} height={edge.labelRect.h} rx={3} fill="#FFFFFF" fillOpacity={0.92} />
          <text x={edge.labelRect.x + edge.labelRect.w / 2} y={edge.labelRect.y + T.edge.labelBaseline} fontSize={T.type.edgeLabel} fontWeight={main && T.edge.mainLabelBold ? 700 : 400} textAnchor="middle" fill={main && T.edge.mainLabelAccent ? T.colors.accent : T.colors.text}>
            {edge.label}
          </text>
        </g>
      )}
    </g>
  );
}

export function ContainerBody({ container, look }: { container: SceneContainer; look?: string | null }): ReactElement {
  const T = tokensFor(look);
  const { w, h } = container.rect;
  if (container.kind === "stage") {
    return (
      <g fontFamily={T.font}>
        <rect width={w} height={38} rx={4} fill={T.colors.stageHead} />
        <text x={w / 2} y={24} fontSize={T.ui.containerTitle} fontWeight={700} fill="#FFFFFF" textAnchor="middle">
          {container.title}
        </text>
      </g>
    );
  }
  if (container.kind === "lane") {
    const ext = Boolean(container.external);
    const fit = Math.max(8, Math.floor((h - 24) / T.ui.laneFit));
    const name = container.title.length > fit ? `${container.title.slice(0, fit - 1).trimEnd()}…` : container.title;
    return (
      <g fontFamily={T.font}>
        <rect width={w} height={h} fill={ext ? T.colors.laneExternal : (container.index ?? 0) % 2 === 0 ? T.colors.laneA : T.colors.laneB} stroke={T.colors.containerBorder} strokeWidth={1.2} />
        <rect width={T.lane.labelW} height={h} fill={ext ? T.colors.laneLabelExternal : T.colors.laneLabel} />
        <text transform={`translate(${ext ? 22 : 28} ${h / 2}) rotate(-90)`} fontSize={T.ui.laneName} fontWeight={700} fill="#FFFFFF" textAnchor="middle">
          {name}
        </text>
        {ext && (
          <text transform={`translate(42 ${h / 2}) rotate(-90)`} fontSize={T.ui.laneSub} fill={T.ui.laneSubColor} textAnchor="middle">
            another system
          </text>
        )}
      </g>
    );
  }
  if (container.kind === "marker") {
    const lines = container.title.split("|");
    return (
      <g fontFamily={T.font} textAnchor="middle">
        <circle cx={w / 2} cy={h / 2} r={w / 2} fill={T.colors.jump} stroke={T.colors.jumpStroke} strokeWidth={1.25} />
        {lines.map((l, i) => (
          <text key={i} x={w / 2} y={h / 2 + 4 - ((lines.length - 1) * 16) / 2 + i * 16} fontSize={T.ui.marker} fill={T.colors.text}>
            {l}
          </text>
        ))}
      </g>
    );
  }
  const tabW = Math.min(w - 20, Math.max(120, container.title.length * T.ui.tabCharW + 24));
  return (
    <g fontFamily={T.font}>
      <rect width={w} height={h} rx={18} fill="none" stroke={T.colors.containerBorder} strokeWidth={1.5} />
      <rect x={0} y={-T.size.tabH} width={tabW} height={T.size.tabH} rx={4} fill={T.colors.containerTab} />
      <text x={10} y={-T.size.tabH + T.ui.tabTextY} fontSize={T.ui.tabText} fill="#FFFFFF" fontWeight={600}>
        {container.title}
      </text>
    </g>
  );
}

export function TitleBody({ scene }: { scene: Scene }): ReactElement {
  const T = tokensFor(scene.look);
  const { w } = scene.title.rect;
  return (
    <g fontFamily={T.font} textAnchor="middle">
      {scene.title.lines.map((l, i) => (
        <text key={i} x={w / 2} y={i === 0 ? 18 : 36} fontSize={l.size} fontWeight={l.bold ? 700 : 400} fill={i === 0 ? T.colors.text : T.colors.muted}>
          {l.text}
        </text>
      ))}
    </g>
  );
}

function Swatch({ row, T }: { row: LegendRow; T: Tokens }) {
  const { fill, stroke, dashed, shape } = row.swatch;
  const common = { fill, stroke, strokeWidth: 1.2, strokeDasharray: dashed ? "4 3" : undefined } as const;
  if (shape === "diamond") return <polygon points="13,2 25,13 13,24 1,13" {...common} />;
  if (shape === "circle") {
    return (
      <>
        <circle cx={13} cy={13} r={11} {...common} />
        {row.swatch.glyph && (
          <text x={13} y={18} fontSize={13} fontWeight={700} textAnchor="middle" fill={T.colors.text}>
            {row.swatch.glyph}
          </text>
        )}
      </>
    );
  }
  if (shape === "pill") return <rect x={1} y={5} width={24} height={16} rx={8} {...common} />;
  if (shape === "dashed-line") return <line x1={1} y1={13} x2={25} y2={13} stroke={stroke} strokeWidth={2.2} strokeDasharray="6 4" />;
  if (shape === "display") return <path d="M6 3 H20 Q25 3 25 13 Q25 23 20 23 H6 L1 13 Z" {...common} />;
  return <rect x={1} y={4} width={24} height={18} rx={2} {...common} />;
}

export function LegendBody({ scene }: { scene: Scene }): ReactElement | null {
  const T = tokensFor(scene.look);
  const { rect, rows } = scene.legend;
  if (rows.length === 0) return null;
  return (
    <g fontFamily={T.font}>
      <rect width={rect.w} height={rect.h} rx={14} fill="none" stroke={T.colors.containerBorder} strokeWidth={1.5} />
      <rect x={0} y={-T.size.tabH} width={T.ui.keyTabW} height={T.size.tabH} rx={4} fill={T.colors.containerTab} />
      <text x={10} y={-T.size.tabH + T.ui.tabTextY} fontSize={T.ui.tabText} fill="#FFFFFF" fontWeight={600}>Diagram key</text>
      {rows.map((r, i) => (
        <g key={r.key} transform={`translate(16 ${22 + i * 32})`}>
          <Swatch T={T} row={r} />
          <text x={38} y={17} fontSize={T.ui.legendText} fill={T.colors.text}>{r.label}</text>
        </g>
      ))}
    </g>
  );
}

/** A table in the diagram, drawn with its top-left corner at (0, 0). */
export function TableBody({ table, look }: { table: SceneTable; look?: string | null }): ReactElement {
  const T = tokensFor(look);
  const captionH = (table.caption ? 22 : 0) + (table.subtitle ? 18 : 0);
  const colX: number[] = [];
  table.columns.reduce((x, c) => (colX.push(x), x + c.w), 0);
  const rowY: number[] = [];
  table.rows.reduce((y, r) => (rowY.push(y), y + r.h), captionH + table.headerH);
  return (
    <g fontFamily={T.font}>
      {table.caption && <text x={0} y={15} fontSize={T.ui.tableCaption} fontWeight={700} fill={T.colors.text}>{table.caption}</text>}
      {table.subtitle && <text x={0} y={(table.caption ? 22 : 0) + 13} fontSize={T.ui.tableSub} fill={T.colors.muted}>{table.subtitle}</text>}
      {table.columns.map((c, ci) => (
        <g key={c.id} transform={`translate(${colX[ci]} ${captionH})`}>
          <rect width={c.w} height={table.headerH} fill={T.colors.tableHeader} stroke={T.colors.stroke} strokeWidth={1} />
          <text x={c.w / 2} y={table.headerH / 2 + 4} fontSize={T.ui.tableHead} fontWeight={700} textAnchor="middle" fill={T.colors.text}>{c.label}</text>
        </g>
      ))}
      {table.rows.map((row, ri) =>
        table.columns.map((c, ci) => (
          <g key={`${ri}:${c.id}`} transform={`translate(${colX[ci]} ${rowY[ri]})`}>
            <rect width={c.w} height={row.h} fill={row.highlight[ci] ? T.colors.tableHighlight : "#FFFFFF"} stroke={T.colors.stroke} strokeWidth={1} />
            {row.cells[ci].map((t, li) => (
              <text key={li} x={c.w / 2} y={T.ui.tableCellY + li * T.ui.tableLineH} fontSize={T.ui.tableCell} textAnchor="middle" fill={T.colors.text}>{t}</text>
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
        <ArrowDefs look={scene.look} />
        <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={background} />
        <g transform={`translate(${scene.title.rect.x} ${scene.title.rect.y})`}><TitleBody scene={scene} /></g>
        {scene.containers.map((c) => (
          <g key={c.id} transform={`translate(${c.rect.x} ${c.rect.y})`}><ContainerBody container={c} look={scene.look} /></g>
        ))}
        <g transform={`translate(${scene.legend.rect.x} ${scene.legend.rect.y})`}><LegendBody scene={scene} /></g>
        {scene.tables.map((t) => (
          <g key={t.id} transform={`translate(${t.rect.x} ${t.rect.y})`}><TableBody table={t} look={scene.look} /></g>
        ))}
        {scene.edges.map((e) => <EdgeBody key={e.id} edge={e} look={scene.look} />)}
        {shapes.map((s) => (
          <g key={s.id} transform={`translate(${s.rect.x} ${s.rect.y})`}><ShapeBody shape={s} look={scene.look} /></g>
        ))}
    </svg>
  );
}
