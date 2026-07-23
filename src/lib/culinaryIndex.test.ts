import { describe, it, expect } from "vitest";
import {
  normalizeKey,
  resolveRestaurantKey,
  lookupRestaurant,
  lookupDish,
  matrixCourseDish,
} from "./culinaryIndex";

describe("culinaryIndex", () => {
  it("normalizes keys", () => {
    expect(normalizeKey("Dal Makhani!")).toBe("dal makhani");
    expect(normalizeKey("Curries & Biryanis")).toBe("curries and biryanis");
  });

  it("aliases India Oven El Dorado Hills → india oven", () => {
    expect(resolveRestaurantKey("India Oven El Dorado Hills")).toBe("india oven");
    expect(resolveRestaurantKey("India Oven")).toBe("india oven");
  });

  it("looks up restaurant + dish", () => {
    const rest = lookupRestaurant("Bawarchi Indian Cuisine");
    expect(rest).toBeTruthy();
    expect(Object.keys(rest!.dishes).length).toBeGreaterThan(0);

    const dish = lookupDish("Dal Makhani", "Bawarchi Indian Cuisine");
    expect(dish).toBeTruthy();
    expect((dish as { dish_type?: string }).dish_type || (dish as { calories_kcal?: number }).calories_kcal).toBeTruthy();
  });

  it("falls back to byDish when restaurant unknown", () => {
    const dish = lookupDish("Gobi Manchurian");
    expect(dish).toBeTruthy();
  });

  it("returns matrix course slots", () => {
    const main = matrixCourseDish("Bawarchi Indian Cuisine", "main_course");
    expect(main?.course).toBe("main_course");
    const carrier = matrixCourseDish("Bawarchi Indian Cuisine", "accompaniment_base");
    expect(carrier?.course).toBe("accompaniment_base");
  });
});
