"use client";

import { useMemo, useState } from "react";
import { CircleHelp, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { filterOutline, type OutlineItem } from "@/lib/workflow/outline";
import { PM } from "@/lib/workflow/process-map/tokens";

// The reading list uses the diagram's one accent colour; open questions use the one warm call-out colour.
const ACCENT = PM.colors.accent;
const QUESTION = "#9A4A00"; // dark enough for text on white (about 6:1)
const QUESTION_DOT = PM.colors.noteOrangeStroke;

const isQuestion = (item: OutlineItem) => item.noteKind === "needs_input";

/**
 * The diagram as a step-by-step list: a dot for each step on a line down the left, the step number and who does it in
 * small muted text, then the step's name in bold. Names wrap instead of being cut off. Open questions for the reader are
 * counted at the top and marked in the list. This is the way to read a map on a phone or with a screen reader.
 */
export default function OutlinePanel({
  items,
  selectedId,
  commentCounts,
  onSelect,
}: {
  items: OutlineItem[];
  selectedId: string | null;
  commentCounts: Map<string, number>;
  onSelect: (nodeId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [nextQuestion, setNextQuestion] = useState(0);
  const shown = useMemo(() => filterOutline(items, query), [items, query]);
  const questions = useMemo(() => items.filter(isQuestion), [items]);

  function goToQuestion() {
    if (questions.length === 0) return;
    const i = nextQuestion % questions.length;
    const id = questions[i].nodeId;
    setQuery(""); // a search could be hiding the question
    onSelect(id);
    setNextQuestion(i + 1);
    // Bring the question into view in the list once it has been drawn.
    requestAnimationFrame(() => document.getElementById(`outline-step-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {questions.length > 0 && (
        <button
          type="button"
          onClick={goToQuestion}
          className="flex min-h-12 w-full items-center gap-3 border-b border-border px-4 py-3 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/70"
          style={{ background: PM.colors.noteOrange }}
        >
          <CircleHelp className="h-5 w-5 shrink-0" style={{ color: QUESTION }} aria-hidden />
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold leading-snug" style={{ color: QUESTION }}>
              {questions.length === 1 ? "1 question is waiting for your answer" : `${questions.length} questions are waiting for your answer`}
            </span>
            <span className="block text-[13px] text-foreground/80">{questions.length === 1 ? "Select to jump to it" : "Select to jump to the next one"}</span>
          </span>
        </button>
      )}
      <div className="relative border-b border-border p-3">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a step" aria-label="Find a step" className="pl-8" />
      </div>
      <nav aria-label="Steps" className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {shown.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">No step matches “{query}”.</p>
        ) : (
          <ol className="relative">
            {/* the line the dots sit on */}
            <span aria-hidden className="absolute bottom-2 left-[13px] top-2 w-0.5 rounded bg-border" />
            {shown.map((item) => {
              const comments = commentCounts.get(item.nodeId) ?? 0;
              const selected = selectedId === item.nodeId;
              const question = isQuestion(item);
              // For a question the question itself (the note's text) is the headline, and "To confirm with ..." is the small line.
              const headline = question ? item.notes || item.label : item.label;
              const small = question ? item.label : [item.number ? `Step ${item.number}` : "", item.actorLabel].filter(Boolean).join(" · ");
              return (
                <li key={item.nodeId} id={`outline-step-${item.nodeId}`} className="relative">
                  <button
                    type="button"
                    onClick={() => onSelect(item.nodeId)}
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "relative flex min-h-11 w-full items-start gap-3 rounded-lg py-2.5 pr-2 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/70",
                      selected ? "bg-primary/10" : "hover:bg-muted"
                    )}
                    style={{ paddingLeft: 4 + Math.min(item.depth, 3) * 14 }}
                  >
                    <span className="relative z-10 mt-1.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-card" aria-hidden>
                      <span className="h-3 w-3 rounded-full" style={{ background: question ? QUESTION_DOT : ACCENT }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      {small && (
                        <span className="block text-[13px] leading-snug" style={question ? { color: QUESTION, fontWeight: 600 } : { color: "var(--muted-foreground)" }}>
                          {question ? <span className="sr-only">Question for you. </span> : null}
                          {small}
                        </span>
                      )}
                      <span className="block break-words text-[15px] font-semibold leading-snug text-foreground">{headline || "Untitled step"}</span>
                    </span>
                    {comments > 0 && (
                      <span className="mt-1 shrink-0 rounded-full bg-secondary px-2 text-xs font-medium text-foreground" aria-label={`${comments} comments`}>
                        {comments}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </nav>
    </div>
  );
}
