import { parseRich } from "@/lib/workflow/rich-text";

/** Shows a note with its **bold**, *italic* and __underline__ formatting. Line breaks follow the parent's white-space style. */
export function RichText({ text }: { text: string | null | undefined }) {
  return (
    <>
      {parseRich(text).map((s, i) =>
        s.bold || s.italic || s.underline ? (
          <span key={i} className={[s.bold ? "font-bold" : "", s.italic ? "italic" : "", s.underline ? "underline" : ""].filter(Boolean).join(" ")}>
            {s.text}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </>
  );
}
