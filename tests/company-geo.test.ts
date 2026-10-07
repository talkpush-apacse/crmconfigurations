import test from "node:test";
import assert from "node:assert/strict";
import { accountName, customGeo, findGeo, geoOptions, guessCompanyAndGeo, REGIONS } from "../src/lib/companies/geo";

test("geo list: regions first, then every country with its own name and a short code", () => {
  const all = geoOptions();
  assert.deepEqual(all.slice(0, REGIONS.length).map((g) => g.name), ["Global", "APAC", "EMEA", "LATAM", "North America"]);
  const countries = all.filter((g) => g.kind === "country");
  assert.ok(countries.length > 200, `only ${countries.length} countries`);
  // every country has a real name, not just its code echoed back
  for (const g of countries) assert.ok(g.name.length > 2 && g.name !== g.code, `${g.code} has no name`);
  const codes = countries.map((g) => g.code);
  assert.equal(new Set(codes).size, codes.length, "country codes are unique");
});

test("geo list: the Philippines is PH, the United Kingdom is written UK", () => {
  assert.deepEqual(findGeo("Philippines"), { name: "Philippines", code: "PH", kind: "country" });
  const uk = findGeo("United Kingdom");
  assert.equal(uk?.code, "UK");
  assert.equal(findGeo("gb")?.code, undefined, "the official GB code is not what people type");
});

test("geo list: typed by name, code or nickname, ignoring capitals and spaces", () => {
  assert.equal(findGeo("  philippines ")?.code, "PH");
  assert.equal(findGeo("ph")?.name, "Philippines");
  assert.equal(findGeo("UK")?.name, "United Kingdom");
  assert.equal(findGeo("USA")?.code, "US");
  assert.equal(findGeo("Turkey")?.kind, "country");
  assert.equal(findGeo("apac")?.name, "APAC");
  assert.equal(findGeo("Atlantis"), null);
  assert.equal(findGeo(""), null);
});

test("geo list: a geo that is not in the list needs its own short code", () => {
  assert.deepEqual(customGeo("  Greater   Bay Area ", "gba"), { name: "Greater Bay Area", code: "gba", kind: "custom" });
  assert.equal(customGeo("Greater Bay Area", ""), null);
  assert.equal(customGeo("", "GBA"), null);
});

test("account name: the company and the geo's short code", () => {
  assert.equal(accountName("Concentrix", findGeo("Philippines")!), "Concentrix PH");
  assert.equal(accountName(" Concentrix ", findGeo("UK")!), "Concentrix UK");
  assert.equal(accountName("Concentrix", findGeo("North America")!), "Concentrix North America");
});

test("guess: an existing name that ends in a geo suggests a company and geo", () => {
  assert.deepEqual(guessCompanyAndGeo("TP Philippines"), { company: "TP", geo: findGeo("Philippines") });
  assert.equal(guessCompanyAndGeo("Concentrix PH")?.company, "Concentrix");
  assert.equal(guessCompanyAndGeo("Concentrix PH")?.geo.name, "Philippines");
  assert.equal(guessCompanyAndGeo("Acme North America")?.geo.name, "North America");
  assert.equal(guessCompanyAndGeo("Northwind Traders (demo data)"), null);
  assert.equal(guessCompanyAndGeo("Philippines"), null, "a name that is only a geo has no company part");
});

test("guess: a short ending that is also an everyday word is never read as a geo", () => {
  assert.equal(guessCompanyAndGeo("Hong Kong Trading Co"), null, "Co is Colombia, but also Company");
  assert.equal(guessCompanyAndGeo("Acme IT"), null);
  assert.equal(guessCompanyAndGeo("Acme ID"), null);
  assert.equal(guessCompanyAndGeo("Acme ph"), null, "lower-case short codes are not guessed");
  assert.equal(guessCompanyAndGeo("Acme PH")?.geo.name, "Philippines");
  assert.equal(guessCompanyAndGeo("Acme UK")?.geo.name, "United Kingdom");
  assert.equal(guessCompanyAndGeo("Acme Singapore")?.geo.code, "SG");
});
