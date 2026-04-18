# CRM Config Checklist — Architecture Reference

> **Purpose**: Reference file for AI assistants validating feature coverage and generating implementation prompts.
> **Last regenerated**: 2026-04-18
> **Do not edit manually** — regenerate from source using the audit prompt.

---

## 1. Stack

| Concern | Detail |
|---|---|
| Framework | Next.js 16.1.6 (App Router, React 19.2.3) |
| Styling | Tailwind CSS v4 + Shadcn v3.8.4 (Radix UI primitives via `radix-ui` ^1.4.3) |
| ORM | Prisma 7.4.0 with `@prisma/adapter-pg` — PostgreSQL, generated client at `src/generated/prisma` |
| File Storage | Supabase Storage (`@supabase/supabase-js` ^2.96.0) — single bucket, folders: logos/banners/documents/general/tab-uploads |
| Auth | JWT cookie (`admin_token`, 7-day) via `jose` ^6.1.3 + `jsonwebtoken` ^9.0.3 + `bcryptjs` ^3.0.3. Google OAuth supported. |
| Hosting | Vercel (inferred from `vercel-build` script: `prisma migrate deploy && next build`) |
| PWA | Not configured (no manifest, no service worker present in codebase) |

---

## 2. Folder Structure

```
src/
├── app/
│   ├── admin/
│   │   ├── login/page.tsx
│   │   ├── new/page.tsx
│   │   └── page.tsx
│   ├── api/
│   │   ├── auth/
│   │   │   ├── route.ts
│   │   │   ├── check/route.ts
│   │   │   └── google/
│   │   │       ├── route.ts
│   │   │       └── callback/route.ts
│   │   ├── checklists/
│   │   │   ├── route.ts
│   │   │   ├── [id]/
│   │   │   │   ├── route.ts
│   │   │   │   └── regenerate-token/route.ts
│   │   │   ├── by-slug/[slug]/route.ts
│   │   │   └── by-token/[token]/route.ts
│   │   ├── export/
│   │   │   ├── [slug]/route.ts
│   │   │   └── by-token/[token]/route.ts
│   │   ├── upload/route.ts
│   │   └── mcp/route.ts
│   ├── client/[slug]/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── [tab]/page.tsx
│   ├── editor/[token]/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── [tab]/page.tsx
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── admin/
│   │   ├── AdminHeader.tsx
│   │   ├── AdminSidebar.tsx
│   │   ├── ChannelSelector.tsx
│   │   ├── CustomFieldBuilder.tsx
│   │   ├── CustomTabManager.tsx
│   │   ├── SettingsDialog.tsx
│   │   └── TabSelector.tsx
│   ├── layout/
│   │   ├── FloatingActionBar.tsx
│   │   ├── Header.tsx
│   │   ├── LegendBar.tsx
│   │   ├── SaveStatus.tsx
│   │   ├── TabNavigation.tsx
│   │   └── TopNav.tsx
│   ├── shared/
│   │   ├── ConfirmDeleteDialog.tsx
│   │   ├── CsvToolbar.tsx
│   │   ├── EditableCell.tsx
│   │   ├── EditableTable.tsx
│   │   ├── ExampleHint.tsx
│   │   ├── FileUploadCell.tsx
│   │   ├── KeyValueForm.tsx
│   │   ├── SectionFooter.tsx
│   │   ├── SectionHeader.tsx
│   │   ├── TabUploadBanner.tsx
│   │   └── VoicePreview.tsx
│   ├── sheets/
│   │   ├── AdminSettingsSheet.tsx
│   │   ├── AgencyPortalSheet.tsx
│   │   ├── AICallFAQsSheet.tsx
│   │   ├── AttributesSheet.tsx
│   │   ├── AutoflowsSheet.tsx
│   │   ├── CampaignsSheet.tsx
│   │   ├── CompanyInfoSheet.tsx
│   │   ├── CustomChecklistForm.tsx
│   │   ├── CustomTabSheet.tsx
│   │   ├── DocumentsSheet.tsx
│   │   ├── FacebookWhatsAppSheet.tsx
│   │   ├── FoldersSheet.tsx
│   │   ├── InstagramSheet.tsx
│   │   ├── MessagingSheet.tsx
│   │   ├── PrescreeningSheet.tsx
│   │   ├── RejectionReasonsSheet.tsx
│   │   ├── SitesSheet.tsx
│   │   ├── SourcesSheet.tsx
│   │   ├── UserListSheet.tsx
│   │   └── WelcomeSheet.tsx
│   └── ui/
│       ├── accordion.tsx, alert-dialog.tsx, avatar.tsx, badge.tsx
│       ├── button.tsx, card.tsx, checkbox.tsx, collapsible.tsx
│       ├── dialog.tsx, dropdown-menu.tsx, input.tsx, label.tsx
│       ├── scroll-area.tsx, select.tsx, separator.tsx, sheet.tsx
│       ├── table.tsx, tabs.tsx, textarea.tsx, tooltip.tsx
├── generated/
│   └── prisma/            (auto-generated Prisma client — do not edit)
├── hooks/
│   ├── useChecklist.ts
│   └── useTabUpload.ts
└── lib/
    ├── api-auth.ts
    ├── auth.ts
    ├── checklist-context.ts
    ├── csv-utils.ts
    ├── db.ts
    ├── excel-export.ts
    ├── mcp-auth.ts
    ├── mcp-server.ts
    ├── section-status.ts
    ├── supabase.ts
    ├── tab-config.ts
    ├── template-data.ts
    ├── types.ts
    ├── utils.ts
    └── validations.ts
```

---

## 3. DB Schema

### Model: `Checklist`

#### Scalar Fields

| Field | Type | Notes |
|---|---|---|
| id | String | `@id @default(cuid())` |
| slug | String | `@unique` — URL-safe client name |
| editorToken | String | `@unique @default(uuid())` — unguessable editor link token |
| clientName | String | Display name |
| createdAt | DateTime | `@default(now())` |
| updatedAt | DateTime | `@updatedAt` |
| version | Int | `@default(0)` — optimistic concurrency counter |
| isCustom | Boolean | `@default(false)` — true for custom-schema checklists |

#### JSON Fields

| Column | TypeScript Type | Stores |
|---|---|---|
| fieldVersions | `Record<string, number> \| null` | Per-field version counters for conflict detection |
| enabledTabs | `string[] \| null` | Array of enabled tab slugs |
| tabOrder | `string[] \| null` | Ordered array of tab slugs for custom ordering |
| tabFilledBy | `Record<string, "talkpush" \| "client"> \| null` | Per-tab filledBy overrides |
| communicationChannels | `CommunicationChannels \| null` | Boolean flags: email, sms, messenger, whatsapp, liveCall, aiCalls |
| featureToggles | `FeatureToggles \| null` | Boolean flags: aiCallVoiceSelection |
| companyInfo | `CompanyInfo \| null` | Company details, Facebook details, branding assets, recruitment process config |
| users | `UserRow[] \| null` | User list tab data |
| campaigns | `CampaignRow[] \| null` | Campaigns list tab data |
| sites | `SiteRow[] \| null` | Sites tab data |
| prescreening | `QuestionRow[] \| null` | Pre-screening questions tab data |
| messaging | `MessagingTemplateRow[] \| null` | Messaging templates tab data |
| sources | `SourceRow[] \| null` | Sources tab data |
| folders | `FolderRow[] \| null` | Folders tab data |
| documents | `DocumentRow[] \| null` | Document collection tab data |
| attributes | `AttributeRow[] \| null` | Candidate attributes tab data |
| fbWhatsapp | `FbWhatsappData \| null` | Facebook Messenger + WhatsApp tab data |
| instagram | `InstagramData \| null` | Instagram chatbot tab data |
| aiCallFaqs | `AiCallData \| null` | AI Call tab data (settings + FAQ rows) |
| agencyPortal | `AgencyPortalRow[] \| null` | Agency portal agencies list |
| agencyPortalUsers | `AgencyPortalUser[] \| null` | Agency portal users list |
| rejectionReasons | `string[] \| null` | Rejection reasons (plain string array) |
| adminSettings | `AdminSettingsData \| null` | Admin settings tab data (flags, credentials, business hours) |
| tabUploadMeta | `TabUploadMetaMap \| null` | Per-tab file upload metadata keyed by dataKey field name |
| autoflows | `AutoflowRule[] \| null` | Autoflows tab data |
| isCustom | Boolean | (scalar — see above) |
| customSchema | `CustomSchema \| null` | Custom checklist field definitions (`CustomFieldDef[]`) |
| customData | `CustomData \| null` | Custom checklist field values (`Record<string, unknown>`) |
| customTabs | `CustomTab[] \| null` | Custom tabs added to standard checklists |

#### Models Added / Changed Since v1.7.0

No explicit versioning is tracked in the schema file. The following fields are present and were not in early versions of the schema based on context:
- `autoflows` (AutoflowRule[] — Autoflows admin tab)
- `customTabs` (CustomTab[] — per-checklist custom tabs created via MCP or admin UI)
- `tabUploadMeta` (file upload skip banner feature)
- `version` + `fieldVersions` (field-level optimistic concurrency)
- `tabFilledBy` (per-tab filledBy overrides)
- `featureToggles`

---

### Model: `AdminUser`

| Field | Type | Notes |
|---|---|---|
| id | String | `@id @default(cuid())` |
| email | String | `@unique` |
| passwordHash | String? | Nullable — Google-only accounts have no password |
| googleId | String? | `@unique` — set on Google OAuth login |
| createdAt | DateTime | `@default(now())` |

---

## 4. Tab Inventory

| Tab ID | Label | Sheet Component | JSON Column | Admin-Only |
|---|---|---|---|---|
| welcome | Welcome | WelcomeSheet.tsx | _(none)_ | No |
| company-info | Company Information | CompanyInfoSheet.tsx | companyInfo | No |
| users | User List | UserListSheet.tsx | users | No |
| campaigns | Campaigns List | CampaignsSheet.tsx | campaigns | No |
| sites | Sites | SitesSheet.tsx | sites | No |
| prescreening | Pre-Screening Questions | PrescreeningSheet.tsx | prescreening | No |
| messaging | Messaging Templates | MessagingSheet.tsx | messaging | No |
| sources | Sources | SourcesSheet.tsx | sources | No |
| folders | Folders | FoldersSheet.tsx | folders | No |
| documents | Document Collection | DocumentsSheet.tsx | documents | No |
| attributes | Attributes | AttributesSheet.tsx | attributes | No |
| facebook-whatsapp | Facebook & WhatsApp | FacebookWhatsAppSheet.tsx | fbWhatsapp | No |
| instagram | Instagram Chatbot | InstagramSheet.tsx | instagram | No |
| ai-call-faqs | AI Call | AICallFAQsSheet.tsx | aiCallFaqs | No |
| rejection-reasons | Rejection Reasons | RejectionReasonsSheet.tsx | rejectionReasons | No |
| agency-portal | Agency Portal | AgencyPortalSheet.tsx | agencyPortal | No |
| admin-settings | Admin Settings | AdminSettingsSheet.tsx | adminSettings | Yes |
| autoflows | Autoflows | AutoflowsSheet.tsx | autoflows | Yes |
| custom-{slug} | _(dynamic)_ | CustomTabSheet.tsx | customTabs / customData | No |

> **Notes:**
> - `welcome` is always enabled (`ALWAYS_ENABLED_SLUGS`); it cannot be toggled off.
> - Admin-only tabs are excluded from `enabledTabs` control — they appear for admins regardless.
> - Custom tabs (`custom-{slug}`) are dynamically generated from `Checklist.customTabs` JSON array.
> - `filledBy` for each standard tab: campaigns/folders/attributes/admin-settings/autoflows = `talkpush`; all others = `client`. Per-checklist overrides stored in `tabFilledBy`.

---

## 5. Key Patterns

### Prisma Import
```ts
import { prisma } from "@/lib/db";
// Client generated at: src/generated/prisma (not node_modules)
// generator output: "../src/generated/prisma"
```

### JSON Serialization Requirement
All JSON field values must be serialized before writing to Prisma:
```ts
data.companyInfo = JSON.parse(JSON.stringify(value));
```
This is required due to Prisma's handling of the `Json` column type with the pg adapter.

### Auto-Save Hook (`useChecklist`)
- Location: `src/hooks/useChecklist.ts`
- `updateField(field, value)` — updates local state, marks field dirty in `dirtyFieldsRef`, sets `hasPendingChanges = true`. Does **not** immediately save.
- `publishChanges()` — triggers `save()` with current dirty fields. Called explicitly (e.g. on button click or blur).
- `save()` — sends `PUT` request with `{ ...data, changedFields: string[] }`. Field-level merge path is used when `changedFields` is present.
- Conflict detection: field-level via `version` (client's snapshot version) vs `fieldVersions[field]` (DB). Returns HTTP 409 with `conflictedFields` array on conflict.
- Retry: up to 3 attempts, exponential backoff (0s, 1s, 2s delays), uses latest in-memory data on retry.
- `discardChanges()` — restores last saved snapshot.
- `retrySave()` — re-triggers save with current data.
- `beforeunload` guard when `hasPendingChanges` or status is `"saving"`.
- Mode: `"slug"` (client link, uses `/api/checklists/by-slug/[slug]`) or `"token"` (editor link, uses `/api/checklists/by-token/[token]`).

### File Upload Route
- `POST /api/upload`
- `src/lib/supabase.ts` — Supabase Storage client
- Max size: 10 MB
- Allowed MIME types: PNG, JPEG, GIF, WEBP, SVG, PDF, XLSX, XLS, CSV
- Allowed folders: `logos`, `banners`, `documents`, `general`, `tab-uploads`
- Auth: admin cookie (`admin_token`) OR valid `editorToken`/`slug` for `tab-uploads` folder only

### Excel Export Route
- Admin (auth required): `GET /api/export/[slug]`
- Public (editor token): `GET /api/export/by-token/[token]`
- Library: `exceljs` ^4.4.0
- Export logic: `src/lib/excel-export.ts`
- Output: `.xlsx` file, named `{clientName}_CRM_Config.xlsx`

### Tab Visibility Toggle Mechanism
- `Checklist.enabledTabs` stores a `string[]` of enabled tab slugs.
- `ALWAYS_ENABLED_SLUGS = ["welcome"]` — these tabs are always included regardless of `enabledTabs`.
- `SELECTABLE_TABS` = `TAB_CONFIG` filtered to exclude always-enabled and admin-only tabs.
- Admin-only tabs (`adminOnly: true` in `TAB_CONFIG`) are **always** shown to admins and are not controlled by `enabledTabs`.
- `getEnabledTabs(enabledTabSlugs, includeAdminTabs, tabOrder, customTabs, tabFilledByOverrides)` in `src/lib/tab-config.ts` computes the final ordered tab list.
- Custom tabs are appended after standard tabs and ordered by `tabOrder` if provided.

---

## 6. API Routes

| Route | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/auth` | POST, DELETE | None | POST: email/password login, sets `admin_token` cookie. DELETE: logout, clears cookie. |
| `/api/auth/check` | GET | None | Verify JWT cookie validity; returns `{ authenticated: boolean }`. |
| `/api/auth/google` | GET | None | Initiate Google OAuth flow; redirects to Google consent screen. |
| `/api/auth/google/callback` | GET | None | Google OAuth callback; exchanges code for token, sets `admin_token` cookie. |
| `/api/checklists` | GET, POST | GET by slug: public; GET list + POST: admin cookie | GET with `?slug=`: fetch one checklist (public). GET without slug: paginated list (admin). POST: create new checklist. |
| `/api/checklists/[id]` | GET, PUT, DELETE | Admin cookie | GET: fetch by ID. PUT: update (field-level merge or full update). DELETE: delete checklist. |
| `/api/checklists/[id]/regenerate-token` | POST | Admin cookie | Regenerate `editorToken`, invalidating the old editor link. |
| `/api/checklists/by-slug/[slug]` | PUT | None (slug is access control) | Public save by slug (client-facing view). Supports field-level merge. |
| `/api/checklists/by-token/[token]` | GET, PUT | None (token is access control) | GET: fetch by editor token. PUT: save by editor token. Supports field-level merge. |
| `/api/export/[slug]` | GET | Admin cookie | Generate and download Excel export for a checklist by slug. |
| `/api/export/by-token/[token]` | GET | None (token is access control) | Generate and download Excel export for a checklist by editor token. |
| `/api/upload` | POST | Admin cookie OR valid editorToken/slug (tab-uploads only) | Upload file to Supabase Storage; returns public URL. |
| `/api/mcp` | POST, GET, DELETE, OPTIONS | Bearer token (`MCP_API_KEY` env var) | MCP server endpoint for Claude AI integration. Stateless HTTP transport. POST handles MCP requests; GET returns 405; DELETE returns 200 (no-op); OPTIONS for CORS preflight. |

---

## 7. Integration Points

| Integration | Purpose | Location |
|---|---|---|
| Supabase Storage | File uploads (logos, banners, documents, tab upload files) | `src/lib/supabase.ts`, `src/app/api/upload/route.ts` |
| Google OAuth | Admin authentication via Google account | `src/app/api/auth/google/route.ts`, `src/app/api/auth/google/callback/route.ts` |
| MCP Server (Model Context Protocol) | Claude AI integration — exposes checklist data as MCP tools | `src/lib/mcp-server.ts`, `src/lib/mcp-auth.ts`, `src/app/api/mcp/route.ts` |
| ExcelJS | Excel (.xlsx) export of checklist data | `src/lib/excel-export.ts`, `src/app/api/export/` |
| PostgreSQL (via Prisma + pg adapter) | Primary database | `src/lib/db.ts`, `prisma/schema.prisma`, `src/generated/prisma/` |

---

## 8. Current Version

From `package.json`:

```
"version": "0.1.0"
```
