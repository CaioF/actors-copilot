import { parseImperialToCm, parseCmToImperial } from "@/lib/height-utils";

describe("parseImperialToCm", () => {
  describe("valid inputs", () => {
    it('parses "5ft 9in" to 175', () => {
      expect(parseImperialToCm("5ft 9in")).toBe(175);
    });

    it("parses \"5' 9\\\"\" to 175", () => {
      expect(parseImperialToCm('5\' 9"')).toBe(175);
    });

    it("parses \"5'9\\\"\" to 175", () => {
      expect(parseImperialToCm('5\'9"')).toBe(175);
    });

    it('parses "6ft" to 183', () => {
      expect(parseImperialToCm("6ft")).toBe(183);
    });

    it('parses "6ft 0in" to 183', () => {
      expect(parseImperialToCm("6ft 0in")).toBe(183);
    });

    it('returns null for "5ft 9" (no second unit)', () => {
      expect(parseImperialToCm("5ft 9")).toBeNull();
    });
  });

  describe("invalid inputs", () => {
    it('returns null for "invalid"', () => {
      expect(parseImperialToCm("invalid")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseImperialToCm("")).toBeNull();
    });
  });
});

describe("parseCmToImperial", () => {
  describe("valid inputs", () => {
    it('parses "175cm" to "5\' 9""', () => {
      expect(parseCmToImperial("175cm")).toBe("5' 9\"");
    });

    it('parses "180cm" to "5\' 11""', () => {
      expect(parseCmToImperial("180cm")).toBe("5' 11\"");
    });

    it('parses "183cm" to "6\' 0"" (exactly 12 inches becomes 6\' 0")', () => {
      expect(parseCmToImperial("183cm")).toBe("6' 0\"");
    });

    it('parses "200cm" to "6\' 7""', () => {
      expect(parseCmToImperial("200cm")).toBe("6' 7\"");
    });
  });

  describe("invalid inputs", () => {
    it('returns null for "175" (no unit)', () => {
      expect(parseCmToImperial("175")).toBeNull();
    });

    it('returns null for "cm"', () => {
      expect(parseCmToImperial("cm")).toBeNull();
    });

    it('returns null for "invalid"', () => {
      expect(parseCmToImperial("invalid")).toBeNull();
    });
  });
});
