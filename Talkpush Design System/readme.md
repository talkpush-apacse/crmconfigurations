# Talkpush Design System

Talkpush is an AI-powered ATS and recruitment CRM built for high-volume hiring, automating candidate sourcing, screening, interviewing and onboarding over chat and voice channels (WhatsApp, SMS, Messenger and more). This design system does not cover that core recruiter product directly — no code, Figma file, or screenshots of the main CRM app were provided. It covers the three delivery contexts documented in the attached brand guidelines:

- **A. Executive reports & dashboards** — funnel reports, hypercare/status updates, one-pagers for clients and leadership.
- **B. Pricing proposals** — tiered commercial/sales documents.
- **C. Talkpush Sign** — the e-signature product's own UI (the one actual "app" surface described in the source).

## Sources

- `uploads/Talkpush_Brand_Guidelines_for_Claude_Design.md` — the compiled 2026 brand guidelines (colors, type, the three contexts, voice rules). This is the single source of truth for every token in this system; see its own "Known gaps" section (§10) for what it explicitly does not cover.
- `uploads/talkpush logo new.jpeg` — the only logo asset provided (a square brand mark, no wordmark lockup). Copied to `assets/logo-mark.jpg`.
- No codebase, Figma file, or slide deck was attached. Nothing below was reverse-engineered from a live product; it is built strictly from the brand guidelines document. If a Talkpush codebase or Figma file becomes available later, the component inventory and UI kits here should be treated as a starting draft, not ground truth.

## What's in this project

- `styles.css` — root stylesheet, imports everything below.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `fonts.css`, `base.css`.
- `assets/logo-mark.jpg` — the real Talkpush brand mark.
- `guidelines/` — 15 foundation specimen cards (Brand, Colors, Type, Spacing groups) shown in the Design System tab.
- `components/` — 16 reusable React primitives, grouped by concern (see below).
- `ui_kits/` — full-screen recreations: `executive-report/`, `pricing-proposal/`, `sign-app/`.
- `SKILL.md` — portable skill file for using this system in Claude Code.

## Components

No component library, codebase, or Figma file defined an inventory, so this is an author-from-brand-needs standard set per the design system's authoring rules, sized to what the three documented contexts actually use.

- **core/** — `Button`, `Badge`, `Card`, `KpiCard`
- **forms/** — `Input`, `Select`, `Checkbox`, `Switch`
- **feedback/** — `Tooltip`, `Dialog`
- **navigation/** — `Tabs`
- **data/** — `Table` (report and Sign variants)
- **report/** — `InsightNote`, `ChevronFlow`, `AccentSquares`, `TermItem`

### Intentional additions (not literally named in the source, but built directly from its prose)
- `KpiCard` — "KPI cards" described under Section 4 page anatomy.
- `InsightNote` — "Every chart carries a short insight note underneath... in the left-border accent bar style. No exceptions." (Section 4)
- `ChevronFlow` — "Chevron dividers between sequential phase cards to show flow." (Section 4)
- `AccentSquares` — the "floating accent squares" signature decorative motif (Section 4) and its Sign-side twin, "confetti squares" (Section 6).
- `TermItem` — the proposal "Term items" and dashed "Included box" (Section 5).

`Button` variants (`default`, `cta`, `accent`, `sage`, `destructive`, `secondary`, `outline`, `ghost`, `link`) come directly from the Sign context's documented CVA variant list.

## Content fundamentals

Voice rules apply to every output, verbatim from Section 8 of the source:

- **Never use em dashes. Anywhere.** Hard rule, no exceptions.
- **Headlines carry the finding, not the topic**, always with a verb, sentence case (not Title Case). e.g. not "Ticket Trends" but "Resolved tickets have outpaced new ones for four straight weeks."
- **One idea per headline.** Needing "and" means the content needs two pages.
- **Lead with the conclusion**: biggest number on the cover, every page answers "so what?" before "what?".
- **Visual impact over text** — if it can be a KPI card, chart, pill, or chevron flow, it should be. Long paragraphs are almost always wrong.
- **Write like a sharp human**: short sentences, no "it is worth noting that", no "delve", no "leverage" as a verb, no exclamation-point enthusiasm.
- **Human first, warm but professional.** No corporate jargon. The reader is a time-poor executive.
- **Numbers**: thousands separators (23,868), percentages to one decimal or whole numbers, always state the period covered.
- **Client names** are verified and exact (e.g. IQOR always all caps).
- **Name gaps honestly** — an incomplete data source gets a "Data notes" callout, never a hidden gap.
- No emoji anywhere in the source document. None used in this system.
- English by default for all client-facing and executive content.

## Visual foundations

**Color.** One warm beige surface (`#FFFFF5`, never pure white in reports) plus four pastel accents — green, blue, pink, orange — each tied to one meaning and held consistently (green = resolved/growth, blue = in-progress/neutral, pink = second phase/CTA, orange = pending/attention). Two to four colors maximum per layout; never rainbow a page. Pricing proposals swap the surface to pure white with beige moved to card fills; Talkpush Sign swaps two accent hexes (pink, amber) for product-UI-only variants — see the color tokens for exact scoping.

**Type.** Space Grotesk end to end (the approved substitute for the licensed Polymath Display/Text), with Fraunces reserved for editorial marketing covers only — body copy stays Space Grotesk even there. Display headings carry tight negative tracking (-0.015em to -0.04em) for a modern condensed feel; small labels and eyebrows are uppercase with wide tracking (0.1–0.14em); all numeric data uses tabular figures. Headlines are sentence case.

**Backgrounds.** Flat color only — no photography, no illustration, no gradients as page backgrounds, no textures or patterns. The one gradient in the system (green→blue→pink→orange) is reserved for a thin decorative band or strip, never a fill.

**Animation.** Not specified for reports/proposals (static documents). Talkpush Sign specifies subtle, functional motion only: page entry fades up (opacity 0→1, y 20→0, staggered 0.08s), hover scale 1.02, tap/press scale 0.98. No bounce, no elaborate easing described.

**Hover / press states.** Sign buttons scale up slightly on hover (1.02) and down on press (0.98); this system also lightens opacity slightly on hover for non-scale contexts. No documented color-shift hover pattern beyond that.

**Borders & dividers.** Hairline `#E8E4D2` (`#E8E8E0` in proposals) for table borders and section rules. 4px solid accent-color left borders mark insight notes, callouts, and proposal term rows.

**Shadows.** Soft and minimal — cards use a thin hairline border with a soft shadow, not a heavy drop shadow. No inner shadows or glows documented.

**Decoration.** The signature motif is small rotated accent squares (10–18px), 2–4 per page/section, scattered near titles or cover corners — this is the brand's one recurring "flourish," not confetti or pattern-fill. Its Sign-side equivalent is called "confetti squares," same idea, `opacity-30` to `opacity-50`.

**Transparency & blur.** Not used in documents. Confetti squares in Sign use partial opacity (30–50%) but no blur/glassmorphism anywhere in the source.

**Imagery.** None provided or described — no photography direction, no illustration style. Do not invent one; if a screen needs imagery, use a plain placeholder and ask the user for real material.

**Corner radii.** 8–14px on report/proposal cards; Talkpush Sign uses a tighter scale (6px cards, 4px buttons/inputs, full-round pills and avatars).

**Cards.** White fill, hairline border or soft shadow, 8–14px radius, generous internal whitespace, heavy whitespace between blocks. Minimalist and card-based throughout — this is the dominant layout unit across all three contexts.

**Layout rules.** Reports/proposals are fixed print-size documents (A4 for reports, US Letter for proposals) with a strict page anatomy: header → eyebrow → verb-led headline → content → insight notes → footer. Sign is a normal responsive web app (`p-4 md:p-8` page padding, `space-y-4`/`space-y-6` section rhythm).

## Iconography

The source document defines no icon system, icon font, or SVG set for reports and proposals beyond one narrow rule: pricing-proposal module columns use 15×15px black-stroke SVG icons with no fill. For Talkpush Sign, the documented icon library is **Lucide React** (sidebar nav `w-5 h-5`, input prefixes `w-4 h-4`, table actions `w-4 h-4`, empty states `w-12 h-12`). No icon assets were provided to copy in, and no emoji or unicode-glyph icon usage is documented anywhere. Consuming projects building Sign screens should load Lucide from its CDN/package rather than hand-drawing icon glyphs; report/proposal work should stay in plain type, pills, and the components above rather than inventing icons the brand doesn't specify.

## Fonts note

Polymath Display and Polymath Text are licensed and were not supplied as files. Space Grotesk is Talkpush's own documented approved substitute for both (not a decision made here), loaded from Google Fonts in `tokens/fonts.css`. Fraunces is loaded the same way for editorial covers. **If Polymath font files become available, replace `tokens/fonts.css` with local `@font-face` rules** — nothing else in the system needs to change, since every token references the semantic `--font-display`/`--font-body` names, not "Space Grotesk" directly.

## Logo note

Only one logo asset was provided: a square icon mark (`assets/logo-mark.jpg`), not the full horizontal lockup SVG the brand guidelines describe as mandatory. The mark is used as-is everywhere a logo appears in this system; nowhere is a wordmark or lockup drawn or approximated. Where a text lockup is shown next to the mark, it is plain typeset "Talkpush" in Space Grotesk, not a reconstruction of the real lockup. **Ask the user to upload the official horizontal lockup (SVG/PNG, both color and black-and-white) to replace this stand-in**, since the source document itself calls the logo "mandatory on every document."
