# Talkpush Brand Guidelines

Compiled for Claude Design training. Version 1, August 2026.

Source: the Talkpush design skills maintained by Jolo Yu (`talkpush-executive-reports`, `talkpush-pdf-design-spec`, `talkpush-sign-design`). No values in this document are invented. Anything uncertain is labelled.

---

## 0. How to use this document

Talkpush has one brand foundation and three delivery contexts. The foundation is always the same. The context decides page background, gradient use, and which font pairing applies.

**Canonical system:** the 2026 executive reports system (Section 1). When two sources disagree, the 2026 values win. Context-specific exceptions are listed in Section 7 and are the only permitted deviations.

Pick the context first:

| If you are building | Use context |
|---|---|
| Report, dashboard, funnel report, status update, one-pager, executive deliverable | **A. Executive reports** (Section 4) |
| Pricing proposal, sales proposal, tiered commercial document | **B. Pricing proposals** (Section 5) |
| Talkpush Sign product UI, app screens, components | **C. Sign product UI** (Section 6) |

---

## 1. Canonical color palette (2026)

| Role | Hex | Usage |
|---|---|---|
| Beige (background) | `#FFFFF5` | Page background. Never pure white in reports. |
| Ink | `#1a1a1a` | All primary text and headlines |
| Muted | `#6b6b6b` | Eyebrows, captions, secondary text |
| Line | `#E8E4D2` | Hairline dividers, table borders |
| Green | `#ACCDB5` | Accent 1. Positive, resolved, done, growth |
| Green soft | `#DCEAE0` | Fills behind green content |
| Pink | `#E8C2EF` | Accent 2. Second category or phase |
| Pink soft | `#F4E0F7` | Fills behind pink content |
| Blue | `#BBCAF0` | Accent 3. Third category, neutral info |
| Blue soft | `#DFE5F7` | Fills behind blue content |
| Orange | `#E8B766` | Accent 4. Attention, in progress, warm highlight |
| Orange soft | `#F4DBB2` | Fills behind orange content |

### Extended tints and shades

Used for lighter fills and darker text in proposal documents. These are additive, not replacements.

| Name | Hex |
|---|---|
| Green lightest | `#BFDCC5` |
| Green darker | `#88A88C` |
| Blue lightest | `#CDDAF2` |
| Blue darker | `#95A4DB` |
| Pink lightest | `#EFD2F3` |
| Pink darker | `#D59BDE` |
| Orange lightest | `#F7CC90` |
| Orange darker | `#D69048` |
| Accent ink (text on orange) | `#7A4F1E` |
| White / card | `#FFFFFF` |
| Row stripe | `#F8F8EE` or `#F4F4ED` |

### Semantic color rules

Color carries meaning. One accent per concept, held consistently across the whole document.

| Meaning | Color |
|---|---|
| Created, new, pending, in-progress warning | Orange `#E8B766` |
| Resolved, completed, success, growth | Green `#ACCDB5` |
| In progress, neutral info, third category | Blue `#BBCAF0` |
| Second category or phase, CTA highlight | Pink `#E8C2EF` |
| Aging 30 days or more | Red |
| Aging 14 days or more | Amber |

Do not rainbow a page. Two to four colors maximum per layout.

### Signature gradient

```css
linear-gradient(90deg, #ACCDB5 0%, #BBCAF0 33%, #E8C2EF 66%, #E8B766 100%);
```

Green, blue, pink, orange, in that order, always at those stops. Used as a thin band or strip on covers, hero banners, and the single most important callout card. Never as a page background.

The Sign product uses the same four colors in the reverse direction as a 6px top strip: `linear-gradient(to right, #F2B457, #F1C1F3, #BBCAF0, #ACCDB5)`.

---

## 2. Typography

**Official brand fonts:** Polymath Display and Polymath Text. Licensed, not freely available.

**Approved substitutes:**

| Role | Font | Notes |
|---|---|---|
| Body and default | Space Grotesk (300 to 700) | Approved working substitute for Polymath Text |
| Display and headings | Space Grotesk | Approved substitute for Polymath Display |
| Editorial cover titles | Fraunces | Warmer serif, for marketing one-pagers only. Body stays Space Grotesk. |
| Labels, meta, small caps, tabular data | Space Grotesk | Always uppercase with wide letter spacing |

Recommended stacks:

```css
--font-display: 'Polymath Display','Space Grotesk',system-ui,-apple-system,sans-serif;
--font-body:    'Polymath Text','Space Grotesk',system-ui,-apple-system,sans-serif;
--font-details: 'Space Grotesk',ui-monospace,Menlo,monospace;
```

Google Fonts: `https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap`

### Type behaviour

- Display headings use tight negative letter spacing, roughly -0.015em to -0.04em. This gives the modern condensed feel.
- Small labels, eyebrows, and meta use Space Grotesk uppercase with 0.1em to 0.14em letter spacing.
- Numeric values in tables and cards use `font-variant-numeric: tabular-nums` so digits align.
- Headlines are sentence case, not Title Case.

### Type scale reference

| Element | Size | Weight | Tracking |
|---|---|---|---|
| Cover title (report) | 60 to 80px | 500 | around -3px |
| Cover title (proposal) | 44pt | 700 | -0.04em |
| Page headline / h1 | 22pt | 700 | -0.035em |
| h2 | 13pt | 700 | -0.015em, thin bottom border |
| h3 | 11pt | 700 | 0 |
| Body | 9 to 11px dense, 10.5pt print | 400 | 0, line height 1.45 to 1.5 |
| Eyebrow | 8.5pt to 12px | 600 | 0.14em, uppercase |
| KPI number | 28 to 48px | 600 to 700 | -0.03em |
| Footer | 8pt | 400 | 0.06em, uppercase |

---

## 3. Logo

**Mandatory on every document.** Cover and every content page header.

- Never draw, generate, approximate, or text-placeholder the logo.
- Use the official horizontal lockup SVG from talkpush.com.
- Typical height 24 to 32px, top left or top right of the page header.
- In HTML deliverables, embed as a base64 data URI so the file is self-contained. A file path reference breaks the moment the HTML is moved or emailed.
- Black and white horizontal lockups exist in both PNG and SVG.

Known good URL as of mid 2026:
`https://cdn.prod.website-files.com/5ec2c2fb42e4aba64cd548a9/693b3321f6d6f3b167bb7283_Logo%20Horizontal%20Lockup.svg`

**Note for Claude Design:** upload the actual logo asset alongside this document. The source skills contain fetch instructions, not the file itself.

---

## 4. Context A. Executive reports and dashboards

The 2026 canonical system. Reports, dashboards, funnel reports, hypercare reports, status updates, one-pagers.

### Surface

- Page background: beige `#FFFFF5`. Never pure white.
- Cards: white `#FFFFFF`, rounded 8 to 14px, thin `#E8E4D2` border or soft shadow.
- Heavy whitespace between blocks. Minimalist, card-based.

### Signature decorative elements

- **Floating accent squares.** Small rotated squares, 10 to 18px, in the four accent colors, scattered sparingly near titles or in cover corners. Two to four per page maximum. This is the signature decorative element.
- **Left border accent bars.** 4px solid accent color on insight notes and callouts.
- **Pills and badges.** Rounded-full with soft accent fills for statuses, phases, tags.
- **Chevron dividers** between sequential phase cards to show flow.

### Page anatomy

Top to bottom: header row (logo one side, document name and date the other, hairline divider below), eyebrow (small uppercase label), headline (the insight, as a sentence with a verb, 1 to 2 lines), optional muted subhead, content zone, insight notes, optional callout box, footer.

Footer: left "Talkpush · Business Operations", right "Page X of Y · Confidential" when client data is involved.

### KPI cards

White card, big number 28 to 48px weight 600, small uppercase label above or below. Trend badges as small pills next to the number: green fill for improvement, orange or pink for decline, with the delta. Three to five cards per row, never more.

### Charts

- Bars in accent colors following the semantic conventions.
- Thin trend lines only where they add signal. No heavy markers.
- No chart junk. No gridline overload, no 3D, no legends when direct labels work.
- **Every chart carries a short insight note underneath, 1 to 2 sentences, in the left-border accent bar style. No exceptions.**

### Tables

- Header row: ink `#1a1a1a` background, beige or white text, bold, 8pt.
- Body 9 to 9.5pt, alternating rows beige and `#F8F8EE`.
- Color-code what matters: aging in red or amber, statuses as soft accent pills.
- Only include rows that fit the page. Sort by criticality and cut the trivial tail rather than shrinking the font.
- One-line legend under the table when color codes or abbreviations are used.

### Page setup

A4. Landscape for deck-style analytics and marketing documents, portrait for formal status and scope documents.

```css
@page { size: A4 portrait; margin: 0; }
.page {
  width: 210mm; height: 297mm;
  padding: 20mm 18mm;
  page-break-after: always;
  background: #FFFFF5;
}
html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
```

`print-color-adjust: exact` is mandatory or the beige background disappears.

---

## 5. Context B. Pricing proposals

Commercial documents with tiers, pricing tables, and module breakdowns.

### Deviations from canonical

- **Page background is white `#FFFFFF`, not beige.** Beige `#FFFFF5` is used for cards, term items, and callout fills only.
- Line color is `#E8E8E0` rather than `#E8E4D2`. Treat as equivalent hairline weight.
- Ink is `#000000` for headers and dark surfaces, `#1A1A1A` for body copy.

### Format

US Letter portrait, 8.5 x 11 in. Margins 0.4in top, 0.55in left, right, and bottom.

```css
@page { size: Letter portrait; margin: 0.4in 0.55in 0.55in; }
```

### Semantic tier colors

| Tier | Color | Module group |
|---|---|---|
| Tier 1 | Green `#ACCDB5` | Sourcing |
| Tier 2 | Blue `#BBCAF0` | Manage and Convert |
| Tier 3 | Pink `#E8C2EF` | Hire and Onboard |
| Tier 4 | Orange `#E8B766` | Accent, primary callout |

### Signature components

- **Orange dot before the eyebrow.** A 6px orange circle preceding the uppercase section label. Keep it.
- **Cover gradient band.** 10px tall, 3px radius, the signature gradient, above the title.
- **Cover colored blocks.** Four 56px blocks in a row, one per brand color.
- **Included box.** Dashed 1.5px border, beige fill, with a small green square tucked in the top-left corner. Keep the green square.
- **Term items.** Beige fill, 3px left border. Grey border normally, orange for the featured term.
- **Accent totals card.** One card in a stat strip carries the gradient background. Reserve for the single main callout stat.
- **Module columns.** Three columns with full brand color headers, icon boxes in the lightest palette variant, 15x15px black stroke SVG icons with no fill.

### Table conventions

Header row ink background with white uppercase Space Grotesk. Zebra rows in `#F4F4ED`. `<tr class="total">` dark background, `<tr class="less">` beige subtraction row, `<tr class="net">` beige with heavy 2px top and bottom ink borders.

### Standard page sequence

Cover, current situation, context and journey, meet the platform, modules, pricing, region breakdown, appendix. Skip or reorder as needed. Components stay the same.

---

## 6. Context C. Talkpush Sign product UI

Product screens, components, and Sign-branded presentations.

### Deviations from canonical

The Sign palette uses slightly different values for two accents. **These are product UI tokens only. Do not carry them into reports or proposals.**

| Brand color | Sign hex | Canonical report hex | Use for |
|---|---|---|---|
| Sage | `#ACCDB5` | `#ACCDB5` (same) | Success, completed, input fields |
| Lavender | `#BBCAF0` | `#BBCAF0` (same) | In-progress, viewed, focus rings |
| Pink | `#F1C1F3` | `#E8C2EF` | CTA, signatures, highlights |
| Amber | `#F2B457` | `#E8B766` | Pending, warnings, autofill fields |

### Philosophy

Warm, approachable, playful-professional. Multi-chromatic pastel. Soft surfaces, generous spacing, subtle animations.

### Semantic tokens, light mode HSL

| Token | HSL | Usage |
|---|---|---|
| background | `60 100% 98%` | Warm beige page surface |
| foreground | `240 10% 8%` | Near-black primary text |
| card | `0 0% 100%` | White card surfaces |
| primary | `240 10% 8%` | Primary buttons, dark |
| secondary | `60 30% 95%` | Secondary surfaces, hover |
| muted | `60 20% 93%` | Disabled backgrounds |
| muted-foreground | `240 5% 45%` | Helper and placeholder text |
| accent | `298 72% 85%` | CTA highlight, Pink |
| destructive | `0 65% 60%` | Errors, danger |
| border | `240 5% 85%` | Borders |

### Typography

Polymath Text for body and h1, Space Grotesk for navigation-style text and h2. Fallback to a clean geometric sans such as Inter or DM Sans.

- h1: Polymath Text Bold, -0.02em, page titles
- h2: Space Grotesk Medium, -0.02em, section titles
- h3: Polymath Text Medium, +0.05em, UPPERCASE, category labels
- h4 to h6: Polymath Text Bold, -0.02em, card titles

### Spacing and radius

| Pattern | Value |
|---|---|
| Page padding | `p-4 md:p-8` |
| Section gap | `space-y-4` or `space-y-6` |
| Card padding | `p-6` |
| Base radius | 6px |
| Cards | rounded-lg, 6px |
| Buttons and inputs | rounded-md, 4px |
| Avatars and pills | rounded-full |

### Component rules

- Stack: React 18 + TypeScript, Tailwind CSS 3, Shadcn/UI on Radix, Framer Motion, CVA, Lucide React icons.
- Always use CSS custom properties for color, never hardcoded hex in component code.
- Button variants: default, cta, destructive, outline, secondary, ghost, link, accent, sage. Default size `h-12 px-6 py-3`.
- Status pattern: `bg-status-{name}/10 text-status-{name} border-status-{name}/20`. Map completed to sage, in_progress to lavender, pending to amber, declined to red, voided to muted.
- Brand gradient strip `h-1.5` at the top of hero banners.
- **Confetti squares.** Small brand-colored squares scattered absolutely in hero sections, `opacity-30` to `opacity-50`, `w-2` to `w-3.5`, various rotations. Same signature idea as the report accent squares.
- Tables wrapped in `rounded-xl border border-border bg-card overflow-hidden`, header row `bg-secondary`, heads `text-xs font-semibold uppercase tracking-wider`.
- Icons: Lucide React only. Sidebar nav `w-5 h-5`, input prefix `w-4 h-4`, table actions `w-4 h-4`, empty state `w-12 h-12`.
- Animation: page entry opacity 0 y 20 to opacity 1 y 0, stagger 0.08, hover scale 1.02, tap scale 0.98.
- Dark mode via `.dark` on `<html>`. Brand hues hold, only lightness adjusts. Surfaces go dark blue-gray, text goes cream.

---

## 7. Conflict register

Where the three source systems disagree. The canonical column is what Claude Design should default to. These are recorded as observed differences, not as verified brand decisions.

| Value | Canonical (2026 reports) | Exception | Where the exception applies |
|---|---|---|---|
| Page background | Beige `#FFFFF5` | White `#FFFFFF` | Pricing proposals only. Beige moves to card fills. |
| Hairline / border | `#E8E4D2` | `#E8E8E0` | Pricing proposals. Visually equivalent. |
| Pink accent | `#E8C2EF` | `#F1C1F3` | Sign product UI only |
| Orange / amber accent | `#E8B766` | `#F2B457` | Sign product UI only |
| Primary text | `#1a1a1a` | `#000000` for headers and dark surfaces | Pricing proposals |
| Row stripe | `#F8F8EE` | `#F4F4ED` | Pricing proposals |

**Resolved, confirmed by Jolo Yu on 14 August 2026:** the Sign pink `#F1C1F3` and amber `#F2B457` are intentional product UI values, not drift. They are correct inside Talkpush Sign and must not be used in reports, proposals, or any client-facing document. Client-facing work always uses pink `#E8C2EF` and orange `#E8B766`.

---

## 8. Voice and copy rules

These are as much a part of the brand as the colors. They apply to every output.

1. **Never use em dashes. Anywhere.** Not in headlines, body, chart labels, tables, or footers. Use periods, commas, colons, parentheses, or the word itself. Hard rule.
2. **Headlines carry the finding, not the topic.** If you deleted everything except the headlines, the reader should still get the story.
   - Bad: "Colombia Funnel Performance". Good: "Colombia converted 1 in 3 qualified candidates to hire, the best rate across all six markets".
   - Bad: "Ticket Trends". Good: "Resolved tickets have outpaced new ones for four straight weeks. The backlog is finally shrinking".
3. **Use a verb in the headline.** Sentence case, not Title Case.
4. **Put the number in when the number is the story.** "23,868 applications, 99.8% handled without a human touching them".
5. **One idea per headline.** If you need "and", you probably need two pages.
6. **Sequence headlines into an arc:** situation, what the data shows, what is driving it, what to do about it.
7. **Keep it honest.** If the news is bad, the headline says so plainly. No spin, no cheerleading.
8. **Lead with the conclusion.** Biggest number on the cover. Every page answers "so what?" before "what?".
9. **Visual impact over text.** If it can be a KPI card, chart, pill, or chevron flow, it should be. Long paragraphs are almost always wrong.
10. **Write like a sharp human.** Short sentences. Direct claims. No "it is worth noting that", no "delve", no "leverage" as a verb every other line. No exclamation-point enthusiasm, no hedging soup.
11. **Human first, warm but professional.** No corporate jargon. Confidence without arrogance. The reader is an executive reading many documents. Respect their time.
12. **Factual.** State what happened. Show the source or the math when possible.
13. **English for all client-facing and executive content** unless explicitly requested otherwise.
14. **Numbers:** thousands separators (23,868), percentages to one decimal or whole numbers, always state the period a number covers.
15. **Client names:** IQOR is always all caps, never iQor or iCore. Verify client and prospect spellings before publishing.
16. **Name gaps honestly.** When source data is incomplete, say so in a "Data notes" section. A report that hides a gap is worse than one that names it.

---

## 9. Quick reference card

- Background `#FFFFF5`, ink `#1a1a1a`, accents `#ACCDB5` green, `#E8C2EF` pink, `#BBCAF0` blue, `#E8B766` orange
- Line `#E8E4D2`, cards white `#FFFFFF`, rounded 8 to 14px
- Font Space Grotesk. Fraunces for editorial covers. Polymath is the licensed original.
- Gradient always green to blue to pink to orange, stops 0 / 33 / 66 / 100
- Real Talkpush logo on every page, never generated, embedded as base64 in HTML
- Floating rotated accent squares are the signature decoration. Two to four per page.
- Insight note under every chart
- Headlines carry the finding, sentence case, with a verb
- No em dashes, ever
- Tabular nums for all numeric data
- Small labels: Space Grotesk uppercase, 0.1 to 0.14em tracking
- Cover tells the whole story in one glance

---

## 10. Known gaps in this document

Stated plainly so nothing here is mistaken for verified fact.

- **The logo asset is not included in this file.** The SVG and PNG horizontal lockups are uploaded to Claude Design separately.
- **Polymath font files are not included.** Space Grotesk is the approved substitute in every rendered output.
- **No photography, illustration, or iconography style guide exists** in the source skills beyond the 15x15px black stroke SVG icon rule for proposal module columns and Lucide React for Sign UI.
- **No logo clear-space, minimum-size, or misuse rules** are documented in the source skills.
- **No formal tone-of-voice document for marketing copy** exists beyond the report and proposal writing rules in Section 8.
