import {
  defaultInteractionType,
  interactionFromTitle,
} from "@/lib/interaction-title";

describe("titling an interaction", () => {
  it("logs plain time together when no title is given", () => {
    expect(interactionFromTitle("")).toEqual({
      type: defaultInteractionType,
      customLabel: null,
    });
    expect(interactionFromTitle(null)).toEqual({
      type: "met",
      customLabel: null,
    });
    expect(interactionFromTitle("   ")).toEqual({
      type: "met",
      customLabel: null,
    });
  });

  it("recognises the names the timeline already draws", () => {
    expect(interactionFromTitle("Coffee")).toEqual({
      type: "coffee",
      customLabel: null,
    });
    expect(interactionFromTitle("  texted ")).toEqual({
      type: "texted",
      customLabel: null,
    });
  });

  it("keeps the user's own words for anything else", () => {
    expect(interactionFromTitle("Went bouldering")).toEqual({
      type: "other",
      customLabel: "Went bouldering",
    });
  });
});
