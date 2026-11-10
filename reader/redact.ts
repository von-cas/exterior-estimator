// Removes the property's address from report text before any of it leaves the
// app. HOVER prints the address in every page header, and the doubled text
// layer repeats fragments of it, so the cover page alone is not enough.

export class RedactionError extends Error {}

export interface Redacted {
  pages: string[]; // same numbering as the PDF; the cover page is emptied
  reportDate: string | null; // ISO date read by code from the cover, never sent
}

const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

export function redact(pages: string[]): Redacted {
  const cover = pages[0] ?? "";
  const street = cover.match(/Complete Measurements[ \t]*([^\n]+)/)?.[1]?.trim() ?? null;
  const cityLine = cover.match(/^\s*([A-Za-z .'-]+?),?\s+([A-Z]{2})\s+(\d{5})(?:-\d{4})?\s*$/m);
  const city = cityLine?.[1]?.trim() ?? null;
  const zip = cityLine?.[3] ?? null;

  const date = cover.match(new RegExp(`(\\d{1,2})\\s+(${MONTHS.join("|")})\\s+(\\d{4})`, "i"));
  const reportDate = date
    ? `${date[3]}-${String(MONTHS.indexOf(date[2].toUpperCase()) + 1).padStart(2, "0")}-${date[1].padStart(2, "0")}`
    : null;

  const out = pages.map((text, i) => {
    if (i === 0) return ""; // the cover page is never sent
    let t = text
      .replace(/Complete Measurements[^\n]*/g, "Complete Measurements")
      .replace(/PROPERTY ID:?\s*\d+/gi, "")
      .replace(/©\s*\d{4} HOVER Inc\.[\s\S]*?fitness for a particular purpose\.?/g, "")
      .replace(/^\s*[A-Za-z .'-]+,?\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?\s*$/gm, "");
    if (street) t = t.split(street).join("");
    if (city) {
      t = t.replace(new RegExp(escape(city), "gi"), "");
      // Fragments like "BLOOMING" from the doubled text layer.
      if (city.length >= 5) t = t.replace(new RegExp(`\\b${escape(city.slice(0, 5))}[A-Za-z]*`, "gi"), "");
    }
    if (zip) t = t.replace(new RegExp(`\\b${zip}\\b`, "g"), "");
    return t.replace(/\n{3,}/g, "\n\n").trim();
  });

  // Refuse to send anything if a trace of the street address is left.
  const houseNumber = street?.match(/^\d+/)?.[0];
  const streetWord = street?.replace(/^\d+\s*/, "").split(/\s+/)[0];
  if (houseNumber && streetWord) {
    const leak = new RegExp(`\\b${houseNumber}\\s+${escape(streetWord)}`, "i");
    if (out.some((p) => leak.test(p))) throw new RedactionError("The address is still in the report text after redaction; nothing was sent.");
  }
  if (!street) throw new RedactionError("Could not find the address header on the cover page, so the text cannot be safely redacted; nothing was sent.");
  return { pages: out, reportDate };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
