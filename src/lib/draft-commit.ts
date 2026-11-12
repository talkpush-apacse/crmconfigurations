/**
 * Getting typed text out of a cell and into the checklist before the person leaves the cell.
 *
 * A table cell keeps what is being typed in its own draft and, until now, only handed it to the page on blur
 * (clicking away, Tab) or Enter. Close or refresh the tab, or background a phone, mid-typing and the draft was lost
 * without a trace: nothing had been sent, no "unsaved" warning appeared, and the header still said "All changes
 * saved". Google Sheets, Figma and Linear all treat the edit as real as soon as it happens, so this does the same:
 * a short pause in typing hands the draft over, and the existing autosave sends it about half a second later.
 *
 * Everything that can discard or replace a draft (Escape, a pasted block, moving to another cell) must go through
 * `cancel()`, so a timer that is already running can never write an old draft over a newer value. Nothing here knows
 * about React or the network: it only owns the timer and a registry so the page can ask "is anything still being
 * typed?" (the leave-page warning, the Save button) and "hand it over now" (leaving, hiding, pressing Save).
 */

/** Pause after the last keystroke before the draft is handed over. Autosave adds ~500ms, so ~1s to the server. */
export const DRAFT_COMMIT_DELAY_MS = 400;

type Listener = () => void;

const active = new Set<DraftCommitter>();
const listeners = new Set<Listener>();

function notify() {
  for (const listener of Array.from(listeners)) listener();
}

export interface DraftCommitterOptions {
  /** Called with the text to hand over. Must be safe to call with a value already handed over. */
  commit: (value: string) => void;
  delayMs?: number;
}

export class DraftCommitter {
  private pending: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private composing = false;
  private commitFn: (value: string) => void;
  private readonly delayMs: number;

  constructor({ commit, delayMs = DRAFT_COMMIT_DELAY_MS }: DraftCommitterOptions) {
    this.commitFn = commit;
    this.delayMs = delayMs;
  }

  /**
   * Swap the function that receives the text. A timer that was started several renders ago always calls the
   * newest one, never the one that existed when the person started typing.
   */
  setCommit(commit: (value: string) => void): void {
    this.commitFn = commit;
  }

  get hasPending(): boolean {
    return this.pending !== null;
  }

  /** The person typed: remember the latest text and (re)start the pause timer. */
  type(value: string): void {
    const wasPending = this.pending !== null;
    this.pending = value;
    if (!wasPending) {
      active.add(this);
      notify();
    }
    this.restartTimer();
  }

  /** Hand over whatever is pending right now. Works during IME composition: leaving beats losing half a word. */
  flush(): void {
    if (this.pending === null) return;
    this.clearTimer();
    const value = this.pending;
    this.pending = null;
    active.delete(this);
    try {
      this.commitFn(value);
    } finally {
      notify();
    }
  }

  /** Throw the pending draft away without handing it over (Escape, a pasted block replaced it, moved cell). */
  cancel(): void {
    this.clearTimer();
    if (this.pending === null) return;
    this.pending = null;
    active.delete(this);
    notify();
  }

  /** IME composition (Chinese, Japanese, Korean, ...) must not be saved half-composed by the timer. */
  compositionStart(): void {
    this.composing = true;
    this.clearTimer();
  }

  compositionEnd(): void {
    this.composing = false;
    if (this.pending !== null) this.restartTimer();
  }

  private restartTimer(): void {
    this.clearTimer();
    if (this.composing) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, this.delayMs);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

/** True while any cell on the page has text typed that has not been handed over yet. */
export function hasPendingDrafts(): boolean {
  return active.size > 0;
}

/** Hand over every pending draft now (leaving the page, tab hidden, Save pressed). */
export function flushAllDrafts(): void {
  for (const committer of Array.from(active)) committer.flush();
}

/** Drop every pending draft (the Discard button). */
export function cancelAllDrafts(): void {
  for (const committer of Array.from(active)) committer.cancel();
}

/** Be told whenever the set of pending drafts changes. Returns the way to stop listening. */
export function subscribeDrafts(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
