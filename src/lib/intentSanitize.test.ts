import { describe, expect, it } from "vitest";
import {
  extractBloodSugarLens,
  extractCuisineFromTranscript,
  extractDietaryFromTranscript,
  extractDishFromTranscript,
  isSweetCravingTranscript,
  mergeBloodSugarLens,
  mergeDietary,
} from "./intentSanitize";

describe("intentSanitize IP-FIX", () => {
  describe("cuisine (IP-1)", () => {
    it("does not map 'something healthy' to cuisine Healthy (Ask example)", () => {
      expect(extractCuisineFromTranscript("I'm low energy, $35, something healthy")).toBeUndefined();
    });

    it("still extracts explicit Thai / Indian", () => {
      expect(extractCuisineFromTranscript("Thai food for my partner nearby")).toBe("Thai");
      expect(extractCuisineFromTranscript("Indian dinner tonight")).toBe("Indian");
      expect(extractCuisineFromTranscript("desi food, gut friendly")).toBe("Indian");
    });

    it("does not force Indian from bare naan/dal alone", () => {
      expect(extractCuisineFromTranscript("extra naan on the side")).toBeUndefined();
      expect(extractCuisineFromTranscript("a bowl of dal")).toBeUndefined();
    });
  });

  describe("blood_sugar lens (IP-2)", () => {
    it("grounds diabetic / low sugar Ask example", () => {
      expect(extractBloodSugarLens("Diabetic-friendly, low sugar, under $30")).toBe(true);
      expect(mergeBloodSugarLens(undefined, "Diabetic-friendly, low sugar")).toBe("blood_sugar");
    });

    it("grounds keto / blood sugar / low carb", () => {
      expect(extractBloodSugarLens("keep my blood sugar steady")).toBe(true);
      expect(extractBloodSugarLens("keto dinner")).toBe(true);
      expect(extractBloodSugarLens("low carb please")).toBe(true);
    });

    it("does not flip lens on bare no bread / no naan", () => {
      expect(extractBloodSugarLens("no naan tonight")).toBe(false);
      expect(extractBloodSugarLens("skip the bread")).toBe(false);
    });

    it("respects model lens when transcript silent", () => {
      expect(mergeBloodSugarLens("blood_sugar", "date night")).toBe("blood_sugar");
      expect(mergeBloodSugarLens(undefined, "date night")).toBeUndefined();
    });
  });

  describe("dietary negation + order (IP-3 / IP-4)", () => {
    it("ignores negated vegetarian / vegan", () => {
      expect(extractDietaryFromTranscript("Not vegetarian — I want chicken")).toBeUndefined();
      expect(extractDietaryFromTranscript("I'm not vegan")).toBeUndefined();
    });

    it("still extracts positive Jain / vegetarian", () => {
      expect(extractDietaryFromTranscript("my friend is a jain, birthday")).toBe("jain");
      expect(extractDietaryFromTranscript("pure veg only")).toBe("vegetarian");
    });

    it("prefers eggetarian over vegetarian when both could apply", () => {
      expect(extractDietaryFromTranscript("eggetarian please")).toBe("eggetarian");
      expect(extractDietaryFromTranscript("eggs ok")).toBe("eggetarian");
    });

    it("mergeDietary: transcript wins over model", () => {
      expect(mergeDietary("vegan", "jain birthday dinner")).toBe("jain");
      expect(mergeDietary("vegan", "not vegan, chicken please")).toBe("vegan"); // transcript no positive diet → model
    });
  });

  describe("sweet / dish (IP-5 / IP-11)", () => {
    it("maps something sweet → dessert", () => {
      expect(extractDishFromTranscript("I want something sweet")).toBe("dessert");
      expect(isSweetCravingTranscript("I want something sweet")).toBe(true);
    });

    it("does not treat sweet potato as dessert craving", () => {
      expect(extractDishFromTranscript("sweet potato fries")).toBeUndefined();
      expect(isSweetCravingTranscript("sweet potato fries")).toBe(false);
    });

    it("keeps named mithai and allows dish with dietary present", () => {
      expect(extractDishFromTranscript("jain gulab jamun")).toMatch(/gulab/i);
      expect(extractDishFromTranscript("pad thai")).toMatch(/pad thai/i);
    });
  });
});
