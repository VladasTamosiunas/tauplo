import { describe, expect, it } from "vitest";
import { formatEur, formatPercent, formatSigned, pluralLt, tidyText } from "./format";

describe("pluralLt", () => {
  const w = (n: number) => pluralLt(n, "pamoka", "pamokos", "pamokų");
  it("uses the singular for 1, 21, 31 but not 11", () => {
    expect([1, 21, 31, 101].map(w)).toEqual(Array(4).fill("pamoka"));
    expect(w(11)).toBe("pamokų");
  });
  it("uses the few form for 2 to 9 and 22 to 29", () => {
    expect([2, 5, 9, 22, 29].map(w)).toEqual(Array(5).fill("pamokos"));
  });
  it("uses the many form for 0, 10 to 20, 30", () => {
    expect([0, 10, 12, 19, 20, 30].map(w)).toEqual(Array(6).fill("pamokų"));
  });
});

describe("tidyText", () => {
  it("glues thousands groups and units together so they never wrap", () => {
    expect(tidyText("Turi 1 400 € ir 3,5 %")).toBe("Turi 1 400 € ir 3,5 %");
  });
  it("handles several thousands groups", () => {
    expect(tidyText("5 000 000 €")).toBe("5 000 000 €");
  });
  it("leaves ordinary sentences alone", () => {
    expect(tidyText("Per 5 dienas atsakyk")).toBe("Per 5 dienas atsakyk");
  });
});

describe("formatSigned", () => {
  it("adds + for gains and a real minus for losses", () => {
    expect(formatSigned(12)).toBe("+12");
    expect(formatSigned(-380, " €")).toBe("−380 €");
    expect(formatSigned(0)).toBe("0");
  });
});

describe("formatEur", () => {
  it("groups thousands with non-breaking spaces and uses a decimal comma", () => {
    expect(formatEur(12480.5, 2)).toBe("12 480,50 €");
  });
  it("rounds to whole euros by default", () => {
    expect(formatEur(7856.4)).toBe("7 856 €");
  });
  it("uses a real minus sign for negatives", () => {
    expect(formatEur(-380)).toBe("−380 €");
  });
  it("does not group numbers below one thousand", () => {
    expect(formatEur(999)).toBe("999 €");
  });
});

describe("formatPercent", () => {
  it("uses a decimal comma and a non-breaking space before the sign", () => {
    expect(formatPercent(3.5, 1)).toBe("3,5 %");
  });
  it("drops decimals by default", () => {
    expect(formatPercent(8)).toBe("8 %");
  });
});
