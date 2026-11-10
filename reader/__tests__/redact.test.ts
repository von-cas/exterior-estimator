import { describe, expect, it } from "vitest";
import { redact, RedactionError } from "../redact";

// A made-up address in the same layout HOVER uses.
const cover = `Complete Measurements 1234 Example Lane
Springfield, IL 62704
© 2017 HOVER Inc. All rights reserved. Lots of legal text, fitness for a particular purpose.
PROPERTY ID: 555555
27 MARCH 2017`;
const page2 = `Complete Measurements 1234 Example Lane
SUMMARY
Facades 2513 ft2
PROPERTY ID: 555555
SPRINGF
Page 1`;

describe("redaction before anything is sent", () => {
  it("empties the cover, removes the address everywhere and keeps the numbers", () => {
    const r = redact([cover, page2]);
    expect(r.pages[0]).toBe("");
    const all = r.pages.join("\n");
    expect(all).not.toMatch(/Example Lane|1234|Springf|62704|555555/i);
    expect(all).toContain("Facades 2513 ft2");
  });
  it("reads the report date from the cover with code", () => {
    expect(redact([cover, page2]).reportDate).toBe("2017-03-27");
  });
  it("refuses when it cannot find the address to remove", () => {
    expect(() => redact(["Some other report", page2])).toThrow(RedactionError);
  });
});
