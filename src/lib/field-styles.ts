/**
 * The single source of truth for how a form control looks.
 *
 * Before this existed there were four separate recipes — the shadcn
 * primitives, the multi-select trigger in EditableCell, the click-to-edit cell
 * beside it, and a global `input:not([data-slot])` stylesheet override — each
 * with its own radius, its own shadow and its own hardcoded grey. Fields that
 * sat next to each other in the same row did not match.
 *
 * Colours come from the `--field-*` tokens in globals.css, so there are no
 * hexes here and the palette can move in one place. These are plain Tailwind
 * class strings rather than a CSS component class, so `cn()` (tailwind-merge)
 * can still dedupe against whatever a caller passes in `className` — a caller
 * overriding the height or the background keeps working.
 */

/**
 * Colour, border, radius, shadow and interaction states — everything except
 * sizing. Compose this when a control needs its own dimensions (a textarea, a
 * trigger with variant heights).
 */
export const fieldSurface = [
  "rounded-lg border-[1.5px] border-field-border bg-field text-foreground",
  "shadow-[var(--field-shadow)]",
  "transition-[color,border-color,box-shadow] duration-200 ease-in-out outline-none",
  "placeholder:text-field-placeholder",
  "hover:border-field-border-hover",
  "focus-visible:border-field-border-focus focus-visible:ring-[3px] focus-visible:ring-field-ring",
  "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

/**
 * Height and horizontal rhythm shared by every single-line control.
 *
 * The type size stays responsive: 16px below `md` keeps iOS Safari from
 * zooming the page when a field takes focus, 14px from `md` up is the density
 * this tool is actually used at.
 */
export const fieldSizing = "h-9 w-full px-3 text-base md:text-sm";

/** The common case: a single-line control at the standard 36px height. */
export const fieldControl = `${fieldSurface} ${fieldSizing}`;

/**
 * Applied to a control whose value is empty, so an unanswered field reads as
 * unanswered rather than looking answered by its own placeholder.
 */
export const fieldEmpty = "bg-field-empty";

/**
 * A control living inside a spreadsheet grid.
 *
 * Transparent and borderless at rest: the table's own rules already separate
 * one cell from the next, and drawing a bordered box inside each of them
 * produced the box-in-a-box density that made these tabs hard to scan. The
 * affordance arrives on approach instead — a hairline border on hover, a
 * lavender ring and an opaque background on focus — which is how every
 * spreadsheet-shaped tool behaves.
 *
 * 32px rather than 36px, so a grid row lands at 40px and roughly three more
 * rows fit on screen.
 */
export const fieldGridCell = [
  // `data-[size=default]:h-8` is needed as well as `h-8`: SelectTrigger sets
  // its height through that same variant, which a plain `h-8` cannot outrank,
  // and a 36px dropdown among 32px inputs pushed its whole row to 45px.
  "h-8 data-[size=default]:h-8 w-full rounded-[4px] border border-transparent bg-transparent px-2 text-sm text-foreground shadow-none",
  "transition-[color,border-color,box-shadow,background-color] duration-150 ease-in-out outline-none",
  "placeholder:text-field-placeholder",
  "hover:border-field-border",
  // `focus:`, not `focus-visible:`. In a data grid you always want to see
  // which cell you are editing, whether you arrived by click, Tab or arrow
  // key — and browsers do not reliably treat a mouse click on a text input as
  // focus-visible, so the ring would come and go depending on how you got there.
  "focus:border-field-border-focus focus:bg-field focus:ring-[3px] focus:ring-field-ring",
  "focus-within:border-field-border-focus focus-within:bg-field",
  "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");
