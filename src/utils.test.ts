import {
  computeKitchenTipAmount,
  filterSuggestions,
  kitchenTipPoolCaption,
  kitchenTipReportLabel,
  kitchenTipShortCaption,
} from "./utils";

describe("filterSuggestions", () => {
  const names = ["Jonathan", "Bob", "Alice", "Matt", "Katie", "Steph"];

  it("returns every suggestion for an empty query", () => {
    expect(filterSuggestions(names, "")).toEqual(names);
  });

  it("is case-insensitive", () => {
    expect(filterSuggestions(names, "BOB")).toEqual(["Bob"]);
  });

  it("tolerates a typo", () => {
    expect(filterSuggestions(names, "jhonathan")).toEqual(["Jonathan"]);
  });

  it("matches an in-order subsequence", () => {
    expect(filterSuggestions(names, "mtt")).toEqual(["Matt"]);
  });

  it("returns nothing for a clearly unrelated query", () => {
    expect(filterSuggestions(names, "zzzzzzz")).toEqual([]);
  });
});

describe("computeKitchenTipAmount", () => {
  it("computes off total tips for percentage_of_tips", () => {
    expect(computeKitchenTipAmount("percentage_of_tips", 12, 500, 999)).toBeCloseTo(60);
  });

  it("computes off gross kitchen sales for percentage_of_gross_kitchen_sales", () => {
    expect(computeKitchenTipAmount("percentage_of_gross_kitchen_sales", 10, 500, 1200)).toBeCloseTo(120);
  });

  it("returns 0 when the relevant base is 0", () => {
    expect(computeKitchenTipAmount("percentage_of_tips", 12, 0, 500)).toBe(0);
    expect(computeKitchenTipAmount("percentage_of_gross_kitchen_sales", 10, 500, 0)).toBe(0);
  });
});

describe("kitchenTipShortCaption", () => {
  it("says 'off the top' for percentage_of_tips", () => {
    expect(kitchenTipShortCaption("percentage_of_tips", 12)).toBe("12% off the top");
  });

  it("says 'of gross kitchen sales' for percentage_of_gross_kitchen_sales", () => {
    expect(kitchenTipShortCaption("percentage_of_gross_kitchen_sales", 10)).toBe("10% of gross kitchen sales");
  });
});

describe("kitchenTipPoolCaption", () => {
  it("matches the pre-existing wording for percentage_of_tips", () => {
    expect(kitchenTipPoolCaption("percentage_of_tips", 12)).toBe("12% kitchen tip-out");
  });

  it("calls out the gross-kitchen-sales basis", () => {
    expect(kitchenTipPoolCaption("percentage_of_gross_kitchen_sales", 10)).toBe(
      "10% gross-kitchen-sales kitchen tip-out"
    );
  });
});

describe("kitchenTipReportLabel", () => {
  it("matches the pre-existing report format for percentage_of_tips", () => {
    expect(kitchenTipReportLabel("percentage_of_tips", 12, 84, null)).toBe("12% ($84.00)");
  });

  it("shows the gross kitchen sales base and the resulting amount", () => {
    expect(kitchenTipReportLabel("percentage_of_gross_kitchen_sales", 10, 120, 1200)).toBe(
      "10% of Gross Kitchen Sales ($1,200.00) = $120.00"
    );
  });
});
