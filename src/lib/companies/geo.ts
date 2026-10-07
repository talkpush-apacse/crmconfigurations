import { nameKey } from "./names";

/**
 * Geos: where a company's work is. An account is a company in one geo ("Concentrix" + Philippines = "Concentrix PH"), so
 * the name is built from the company and the geo's short code instead of being typed. A geo is a country (standard
 * two-letter code, the UK shown as "UK"), one of a few regions that are not countries, or one a person types in with
 * a short code of their own. Pure: no database, no screen.
 */

export interface Geo {
  name: string;
  /** What goes in the account name: "PH", "UK", "APAC". */
  code: string;
  kind: "country" | "region" | "custom";
}

/** Regions that are not countries. Their name is also their code ("Concentrix APAC", "Concentrix North America"). */
export const REGIONS: Geo[] = ["Global", "APAC", "EMEA", "LATAM", "North America"].map((name) => ({ name, code: name, kind: "region" as const }));

const COUNTRY_CODES =
  "AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");

/** The UK is written "UK" in an account name, not the official "GB". */
const DISPLAY_CODE: Record<string, string> = { GB: "UK" };

/** Names people use that the standard country names do not. */
const ALIASES: Record<string, string> = {
  uk: "GB", "great britain": "GB", britain: "GB", england: "GB",
  usa: "US", america: "US", "united states of america": "US",
  uae: "AE", turkey: "TR", burma: "MM", "czech republic": "CZ", "ivory coast": "CI", "south korea": "KR", "north korea": "KP",
  "hong kong": "HK", macau: "MO", vietnam: "VN",
};

let namer: Intl.DisplayNames | null = null;
function countryName(code: string): string {
  namer ??= new Intl.DisplayNames(["en"], { type: "region" });
  if (code === "GB") return "United Kingdom";
  return namer.of(code) ?? code;
}

let cached: Geo[] | null = null;

/** Every choice, regions first, then countries A to Z. */
export function geoOptions(): Geo[] {
  cached ??= [
    ...REGIONS,
    ...COUNTRY_CODES.map((c) => ({ name: countryName(c), code: DISPLAY_CODE[c] ?? c, kind: "country" as const })).sort((a, b) => a.name.localeCompare(b.name)),
  ];
  return cached;
}

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** What a person typed, matched to a known geo by name, by code, or by a common nickname. Null when it is not one. */
export function findGeo(text: string): Geo | null {
  const q = key(text);
  if (!q) return null;
  const all = geoOptions();
  const aliased = ALIASES[q];
  if (aliased) return all.find((g) => g.kind === "country" && (g.code === aliased || g.code === DISPLAY_CODE[aliased])) ?? null;
  return all.find((g) => key(g.name) === q) ?? all.find((g) => key(g.code) === q) ?? null;
}

/** A geo the list does not have, typed in with its own short code. */
export function customGeo(name: string, code: string): Geo | null {
  const n = name.trim().replace(/\s+/g, " ");
  const c = code.trim().replace(/\s+/g, " ");
  if (!n || !c || n.length > 60 || c.length > 12) return null;
  return { name: n, code: c, kind: "custom" };
}

/** The account name: the company and the geo's short code. */
export function accountName(company: string, geo: Pick<Geo, "code">): string {
  return `${company.trim()} ${geo.code}`.replace(/\s+/g, " ").trim();
}

/**
 * Short endings that are safe to read as a geo when guessing from a name. Most two-letter codes are not: "Co" is Colombia
 * but also "Company", "IT" is Italy but also a department, "ID" and "IN" are everyday words. Those can still be chosen by
 * hand; they are just never guessed. Names of 4 or more letters ("Philippines", "APAC") are always safe.
 */
const GUESSABLE_SHORT = new Set(["PH", "US", "UK", "USA", "UAE", "SG", "MY", "AU", "NZ", "CA", "MX", "BR", "JP", "HK", "VN", "TH"]);

/**
 * For an account that already has a name like "TP Philippines" or "Concentrix PH": which company and geo does the name
 * suggest? Only a hint for the Edit form; nothing is changed until a person confirms it.
 */
export function guessCompanyAndGeo(name: string): { company: string; geo: Geo } | null {
  const words = name.trim().split(/\s+/);
  for (let take = Math.min(3, words.length - 1); take >= 1; take--) {
    const tail = words.slice(words.length - take).join(" ");
    const geo = findGeo(tail);
    const company = words.slice(0, words.length - take).join(" ").trim();
    const safe = tail.length > 3 || GUESSABLE_SHORT.has(tail);
    if (geo && safe && nameKey(company)) return { company, geo };
  }
  return null;
}
