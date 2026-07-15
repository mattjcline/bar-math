import { filterSuggestions } from "./utils";

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
