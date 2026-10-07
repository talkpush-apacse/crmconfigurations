---
name: Talkpush Implementation Hub (CRM Config Checklist and Project Tracker)
description: Warm beige, near-black ink, four pastel accents. The Talkpush Sign design system applied to an internal operations tool with client-safe views.
colors:
  sign-background: "#FFFFF6"
  sign-foreground: "#141414"
  sign-card: "#FFFFFF"
  sign-secondary: "#F7F6E9"
  sign-muted: "#EDECDE"
  sign-muted-foreground: "#6B6B70"
  sign-border: "#DCDBCF"
  sign-destructive: "#D1483D"
  sign-sage: "#ACCDB5"
  sign-lavender: "#BBCAF0"
  sign-pink: "#F1C1F3"
  sign-amber: "#F2B457"
  report-beige: "#FFFFF5"
  report-ink: "#1A1A1A"
  report-muted: "#6B6B6B"
  report-line: "#E8E4D2"
  report-row-stripe: "#F8F8EE"
  report-green: "#ACCDB5"
  report-green-soft: "#DCEAE0"
  report-blue: "#BBCAF0"
  report-blue-soft: "#DFE5F7"
  report-pink: "#E8C2EF"
  report-pink-soft: "#F4E0F7"
  report-orange: "#E8B766"
  report-orange-soft: "#F4DBB2"
  report-accent-ink: "#7A4F1E"
typography:
  display:
    fontFamily: "Space Grotesk, system-ui, -apple-system, sans-serif"
    fontSize: "29px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Space Grotesk, system-ui, -apple-system, sans-serif"
    fontSize: "19px"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "DM Sans, system-ui, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  body:
    fontFamily: "DM Sans, system-ui, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  body-dense:
    fontFamily: "DM Sans, system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Space Grotesk, ui-monospace, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.12em"
  kpi:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
rounded:
  control: "4px"
  card: "6px"
  report-card: "10px"
  report-card-lg: "14px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.sign-foreground}"
    textColor: "{colors.sign-background}"
    rounded: "{rounded.control}"
    padding: "12px 24px"
    height: "48px"
  button-cta:
    backgroundColor: "{colors.sign-pink}"
    textColor: "{colors.sign-foreground}"
    rounded: "{rounded.control}"
    padding: "12px 24px"
    height: "48px"
  button-outline:
    backgroundColor: "{colors.sign-card}"
    textColor: "{colors.sign-foreground}"
    rounded: "{rounded.control}"
    padding: "12px 24px"
  input:
    backgroundColor: "{colors.sign-card}"
    textColor: "{colors.sign-foreground}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.sign-card}"
    textColor: "{colors.sign-foreground}"
    rounded: "{rounded.card}"
    padding: "24px"
  report-card:
    backgroundColor: "{colors.sign-card}"
    textColor: "{colors.report-ink}"
    rounded: "{rounded.report-card}"
    padding: "24px"
  status-pill:
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  insight-note:
    backgroundColor: "{colors.report-beige}"
    textColor: "{colors.report-ink}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
---

# Design System: Talkpush Implementation Hub (CRM Config Checklist and Project Tracker)

> Source of truth: the Talkpush Design System in `Talkpush Design System/` (readme, `tokens/`, and `uploads/Talkpush_Brand_Guidelines_for_Claude_Design.md`). This file applies that system to this app. When this file and the brand guidelines disagree, the guidelines win.
> Status: drafted from the design system sources and the current `src/app/globals.css`. The Creative North Star and the tracker-specific components are provisional until confirmed.

## Overview

**Creative North Star: "The Calm Status Board"**

The app is a shared board that tells the truth about a client project, plainly and warmly. Surfaces are warm beige paper, text is near-black, and four pastel accents carry meaning rather than decoration. The brand character is warm, approachable and playful-professional, so the tool should feel like a well-kept project room, not an enterprise console.

The app has two faces and they must never share a page. The **staff face** is Talkpush Sign product UI: the checklist editor, the tracker portfolio, the board, the timeline, the item sheet. The **client face** is the executive report system: the client-safe Exec Summary, the viewer link page, anything printed or exported. The staff face uses the Sign accents. The client face uses the canonical report accents. Same warmth, slightly different hexes, and the difference is a brand rule, not drift.

Density follows the task. Data entry and boards are compact and quiet. The Exec Summary is spacious, finding-first and readable on a phone.

**Key Characteristics:**
- Warm beige page, white cards, hairline borders, near-black ink.
- Four accents, each tied to one meaning and held consistently.
- Two to four colors per layout. Never rainbow a page.
- Headlines carry the finding, in sentence case, with a verb.
- Status is always text or an icon as well as color.
- Flat at rest. Depth is a hairline plus a soft shadow, never a heavy drop.

## Colors

A warm neutral ground with four pastel accents: sage, lavender, pink, amber (orange in reports).

### Primary
- **Near-Black Ink** (#141414, report #1A1A1A): primary buttons, body text, table header rows in reports. It is the only dark color on a screen.

### Secondary
- **Sage** (#ACCDB5): done, completed, on track, growth. Input fields in Sign.
- **Lavender** (#BBCAF0): in progress, viewed, neutral info, focus rings (use the darker lavender for the ring so it holds contrast).
- **Pink** (Sign #F1C1F3, report #E8C2EF): the one call to action per screen, highlights, second category or phase.
- **Amber** (Sign #F2B457, report orange #E8B766): pending, waiting, attention, warnings. Text on orange fills uses accent ink #7A4F1E.

### Neutral
- **Warm Beige** (Sign #FFFFF6, report #FFFFF5): page background. Never pure white for the page.
- **Paper White** (#FFFFFF): cards and tables.
- **Sand** (#F7F6E9) and **Soft Sand** (#EDECDE): secondary surfaces, hover, table header (Sign), disabled fills.
- **Hairline** (Sign #DCDBCF, report #E8E4D2): borders and dividers.
- **Muted Ink** (#6B6B70): helper text, eyebrows, captions.
- **Signal Red** (Sign #D1483D): destructive actions, blocked items, off-track health.
- **Row Stripe** (#F8F8EE): alternating table rows in the report face.

### Status mapping (tracker)
| State | Color | Never rely on color alone, always pair with the label |
|---|---|---|
| Done, On track | Sage | "Done", "On track" |
| In progress | Lavender | "In progress" |
| Waiting on client, At risk, Pending | Amber (orange in report face) | "Waiting on client", "At risk" |
| Blocked, Off track, Overdue | Signal Red | "Blocked", "3 days overdue" |
| Not started, Dropped | Soft Sand with muted ink | "Not started", "Dropped" (struck through) |

Pattern for pills: soft fill at about 10% of the status color, text in ink or accent ink, 1px border at about 20%.

### Named Rules
**The Two Contexts Rule.** Sign pink #F1C1F3 and amber #F2B457 belong to the staff face only. Anything a client sees (viewer links, the "View as client" preview, print, export) uses report pink #E8C2EF and orange #E8B766. This was confirmed as intentional by Jolo Yu on 14 August 2026. Never use both sets on one page.

**The Meaning Rule.** One accent per concept, held across the whole product. Green never means "pending". Amber never means "done".

**The One Pink Rule.** Pink marks the single call to action or the single most important callout on a screen. Its rarity is the point.

**The Signature Gradient Rule.** The gradient (sage to lavender to pink to amber in Sign, with stops 0, 33, 66, 100 in reports) is a thin strip, 6px (Sign hero) or 10px (report cover). It is never a fill and never a page background.

## Typography

**Display Font:** Space Grotesk (with system-ui fallback)
**Body Font:** DM Sans in the staff face (the approved clean geometric fallback for the licensed Polymath Text), Space Grotesk end to end in the client face
**Label Font:** Space Grotesk, uppercase, wide tracking
**Workflow Builder:** a map has a look (stored on the map). New maps use the "readable" look: Inter in the diagram, the client page and the editor, because it stays legible at 12 to 13px; body text in the diagram is 13px, small print 11 to 12px. Existing maps keep the "original" look (DM Sans, 11px) until someone switches them in the editor's Layout panel. The rest of the app keeps the faces above.

**Character:** Tight, modern, slightly condensed headings over calm, readable body text. Polymath Display and Polymath Text are the licensed originals and are not available, so Space Grotesk is the approved substitute. If Polymath files arrive, swap the font tokens only.

### Hierarchy
- **Display** (700, 29px, 1.15, -0.03em): page titles and the Exec Summary headline.
- **Headline** (500, 19px, 1.15, -0.02em): section titles.
- **Title** (700, 15px, -0.02em): card titles.
- **Body** (400, 15px, 1.5): default text. Dense tables use 13px at 1.45.
- **Label** (600, 11px, 0.12em, uppercase): eyebrows, table headers, category labels.
- **KPI** (600, 40px, -0.03em, tabular numbers): the big number on a KPI card (48px for a single hero KPI).

### Named Rules
**The Finding-First Rule.** Headlines state the finding, not the topic, in sentence case, with a verb. "Go-live is on track for 14 Nov, but 3 client items block UAT" beats "Project status".

**The Tabular Rule.** Every number in a table, card or chart uses tabular figures so digits align.

**The No Em Dash Rule.** Never use em dashes, anywhere: headlines, labels, tables, empty states, error messages, footers. Use a period, comma, colon or parentheses.

## Layout

Warm page, white cards, generous whitespace between blocks. Page padding is `p-4` on phones and `md:p-8` on larger screens. Section rhythm is `space-y-4` or `space-y-6`. Card padding is `p-6`. Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64.

The app shell is a sticky 56px header, a collapsible light sidebar (48px collapsed, 192px open), and a content area. Tables sit inside `rounded-xl border bg-card overflow-hidden`.

The Exec Summary follows report page anatomy: header row, eyebrow, finding headline, optional muted subhead, content zone, insight notes, footer. It must read well at 375px. Boards scroll sideways. The timeline is desktop-first and falls back to the list below 768px.

## Elevation & Depth

Flat by default. A card is a hairline border plus a very soft shadow. Depth appears only in response to state.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 2px rgba(26,26,26,0.06), 0 1px 1px rgba(26,26,26,0.04)`): cards at rest.
- **Card hover** (`box-shadow: 0 4px 14px rgba(26,26,26,0.09)`): interactive cards on hover.

### Named Rules
**The Flat-By-Default Rule.** No inner shadows, glows, glassmorphism or blur. Confetti squares use partial opacity only, never blur.

## Shapes

Staff face: 6px cards, 4px buttons and inputs, full-round pills and avatars. Client face: 10px to 14px report cards. Insight notes and callouts carry a 4px solid left bar in the accent color. Chevron dividers show flow between sequential phase cards. The recurring signature shape is the small rotated square.

## Components

### Buttons
- **Shape:** 4px radius.
- **Primary:** near-black fill, warm cream text. The DS default size is `h-12 px-6 py-3`. Dense table rows and sheets use the smaller sizes already defined in `src/components/ui/button.tsx`.
- **CTA:** pink fill, ink text. One per screen.
- **Variants:** default, cta, destructive, outline, secondary, ghost, link, accent, sage.
- **Hover / Press:** scale 1.02 on hover, 0.98 on press, 150 to 200ms. Honor `prefers-reduced-motion`.
- **Focus:** a visible lavender ring on every control.

### Status pill
- **Style:** rounded-full, soft accent fill, 1px soft border, label text always present. Used for item status, project health, phase and tags.

### Cards / Containers
- **Corner Style:** 6px (staff), 10 to 14px (client face).
- **Background:** white on the beige page.
- **Border:** 1px hairline. Shadow per Elevation.
- **Internal Padding:** 24px.

### KPI card
- **Style:** white card, big tabular number (28 to 48px, weight 600), small uppercase label, optional trend pill (sage for improvement, amber or pink for decline, with the delta). Three to five per row, never more.

### Insight note
- **Style:** beige fill, 4px accent left bar, one or two sentences. Every chart carries one directly underneath. No exceptions.

### Phase flow (chevron flow)
- **Style:** sequential phase cards joined by chevron dividers. Current phase has an accent fill, finished phases sage, upcoming phases outlined.

### Tables
- **Staff face:** wrapper `rounded-xl border border-border bg-card overflow-hidden`, header row sand with `text-xs font-semibold uppercase tracking-wider`.
- **Client face:** header row ink with white text, alternating beige and `#F8F8EE` rows, aging and status color-coded, one-line legend under the table when color codes are used.

### Inputs / Fields
- **Style:** 4px radius, hairline border, white fill. Persistent labels above the field.
- **Focus:** lavender ring.
- **Error:** signal red text plus an icon, message tied to the field.

### Navigation
- **Style:** light sidebar, white surface, hairline right border. Active item has a soft sage tint and near-black text. Icons are Lucide, 20px in the sidebar. A module switcher sits in the header. The project page uses tabs for its views.

### Tracker extensions (derived from the tokens above, not in the DS source)
- **Kanban card:** white card, 6px radius, title, owner avatar, due chip, "Blocked by N" pill. Overdue text is written out ("3 days overdue").
- **Gantt bar:** 4px radius, fill follows the status mapping, today line in near-black, milestone as a small rotated square, dependency arrows in muted ink.
- **Item sheet:** right-hand sheet, white, hairline left border, sticky footer for the primary action.

### Signature decoration
- **Accent squares:** small rotated squares, 10 to 18px, two to four per page, near titles. Used on the login page and the Exec Summary header only (the Companies gallery has none). Never on boards, lists, tables or the timeline.

## Do's and Don'ts

### Do:
- **Do** use CSS custom properties for every color. No hardcoded hex in component code.
- **Do** pick the context first: staff face (Sign) or client face (report). Do not mix them.
- **Do** use Lucide icons only: 20px nav, 16px inputs and table actions, 48px empty states.
- **Do** write headlines as findings, in sentence case, with a verb, and put the number in when the number is the story.
- **Do** put an insight note under every chart, with the period the number covers.
- **Do** pair every status color with a text label or icon.
- **Do** name data gaps honestly in a "Data notes" callout.
- **Do** use tabular figures, thousands separators (23,868) and whole or one-decimal percentages.
- **Do** show the real Talkpush logo, never a drawn or text stand-in. The official horizontal lockup is still needed, so use the existing mark until it is supplied.
- **Do** respect `prefers-reduced-motion` and keep motion subtle: fade up 0 to 1 with a 20px rise, 0.08s stagger.

### Don't:
- **Don't** use em dashes anywhere.
- **Don't** use Sign pink or amber in anything a client sees, and don't use report pink or orange in staff screens.
- **Don't** use more than four colors on one layout, or fill a page with a gradient.
- **Don't** use photography, illustration, textures, 3D, dual axes, heavy gridlines or chart legends where direct labels work.
- **Don't** use shadows, glows or blur as decoration.
- **Don't** invent an icon style, an imagery style or a logo. Ask for real material.
- **Don't** write "leverage" as a verb, "delve", "it is worth noting", or exclamation-point enthusiasm.
- **Don't** put internal items, internal remarks or other clients' data in any client-facing view.
