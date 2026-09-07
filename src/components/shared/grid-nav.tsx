"use client";

import { createContext, useCallback, useContext, useMemo, useRef } from "react";

/**
 * Keyboard + clipboard plumbing that makes an EditableTable behave like a
 * spreadsheet.
 *
 * Cells register themselves by (row, column) so navigation can move focus
 * between them, and a multi-cell paste can be applied as one batched edit
 * rather than one write per cell.
 *
 * Only the main grid participates — expanded detail fields are a form, not a
 * grid, so they register nothing and keep ordinary browser behaviour.
 */

export type MoveDirection = "up" | "down" | "left" | "right";

export interface GridNavValue {
  registerCell: (row: number, col: number, el: HTMLElement | null) => void;
  /** Focuses a cell and selects its contents. Returns false if it isn't there. */
  focusCell: (row: number, col: number) => boolean;
  /** Moves relative to a cell. Returns false when there's nowhere to go. */
  moveFocus: (row: number, col: number, direction: MoveDirection) => boolean;
  /**
   * Applies a pasted block with its top-left corner at (row, col).
   * Returns false when the table can't accept batched edits, so the caller
   * lets the browser paste into the single focused cell instead.
   */
  pasteGrid: (row: number, col: number, grid: string[][]) => boolean;
  /** Whether this table can accept a multi-cell paste at all. */
  canPasteGrid: boolean;
}

const GridNavContext = createContext<GridNavValue | null>(null);

export function useGridNav(): GridNavValue | null {
  return useContext(GridNavContext);
}

interface GridNavProviderProps {
  rowCount: number;
  columnCount: number;
  onPasteGrid?: (row: number, col: number, grid: string[][]) => void;
  children: React.ReactNode;
}

export function GridNavProvider({
  rowCount,
  columnCount,
  onPasteGrid,
  children,
}: GridNavProviderProps) {
  const cellsRef = useRef(new Map<string, HTMLElement>());

  const registerCell = useCallback(
    (row: number, col: number, el: HTMLElement | null) => {
      const key = `${row}:${col}`;
      if (el) cellsRef.current.set(key, el);
      else cellsRef.current.delete(key);
    },
    []
  );

  const focusCell = useCallback((row: number, col: number) => {
    const el = cellsRef.current.get(`${row}:${col}`);
    if (!el) return false;
    el.focus();
    // Select the contents so typing replaces, the way a spreadsheet does.
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.select();
    }
    return true;
  }, []);

  const moveFocus = useCallback(
    (row: number, col: number, direction: MoveDirection) => {
      switch (direction) {
        case "up":
          return row > 0 && focusCell(row - 1, col);
        case "down":
          return row < rowCount - 1 && focusCell(row + 1, col);
        case "left":
          // Wrap to the end of the previous row, like Shift+Tab.
          if (col > 0) return focusCell(row, col - 1);
          return row > 0 && focusCell(row - 1, columnCount - 1);
        case "right":
          if (col < columnCount - 1) return focusCell(row, col + 1);
          return row < rowCount - 1 && focusCell(row + 1, 0);
        default:
          return false;
      }
    },
    [focusCell, rowCount, columnCount]
  );

  const pasteGrid = useCallback(
    (row: number, col: number, grid: string[][]) => {
      if (!onPasteGrid) return false;
      onPasteGrid(row, col, grid);
      return true;
    },
    [onPasteGrid]
  );

  const value = useMemo<GridNavValue>(
    () => ({
      registerCell,
      focusCell,
      moveFocus,
      pasteGrid,
      canPasteGrid: !!onPasteGrid,
    }),
    [registerCell, focusCell, moveFocus, pasteGrid, onPasteGrid]
  );

  return <GridNavContext.Provider value={value}>{children}</GridNavContext.Provider>;
}

/**
 * Parses clipboard text copied from a spreadsheet.
 *
 * Excel and Sheets emit tab-separated columns and newline-separated rows, with
 * any cell containing a tab, newline or quote wrapped in double quotes and its
 * own quotes doubled. Returns null when the text is a single plain value, so
 * the caller can fall back to a normal paste.
 */
export function parseClipboardGrid(text: string): string[][] | null {
  if (!text) return null;
  // Nothing to spread across cells.
  if (!text.includes("\t") && !text.includes("\n") && !text.includes("\r")) {
    return null;
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === "\t") {
      row.push(field);
      field = "";
    } else if (ch === "\r" && next === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i++;
    } else if (ch === "\n" || ch === "\r") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  row.push(field);
  // Spreadsheets append a trailing newline; don't turn that into an empty row.
  if (!(row.length === 1 && row[0] === "")) rows.push(row);

  const meaningful = rows.filter((r) => r.some((cell) => cell !== ""));
  if (meaningful.length === 0) return null;
  // A single value that merely had a trailing newline is not a grid.
  if (rows.length === 1 && rows[0].length === 1) return null;

  return rows;
}
