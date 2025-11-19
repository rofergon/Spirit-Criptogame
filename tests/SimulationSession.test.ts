import { describe, it, expect } from "vitest";
import { SimulationSession } from "../src/game/core/SimulationSession";

describe("SimulationSession", () => {
  it("runs ticks without depending on the DOM", () => {
    const logs: string[] = [];
    const session = new SimulationSession(1, {
      onLog: (message) => logs.push(message),
    });

    session.initialize({ worldSize: 16, seed: 12345, difficulty: "normal" });

    const world = session.getWorld();
    const citizensBefore = session.getCitizenSystem().getCitizens().length;
    const stockpileBefore = world.stockpile.food;

    session.runTick(1, { priority: "explore" });
    session.runTick(1, { priority: "mine" });

    const citizensAfter = session.getCitizenSystem().getCitizens().length;
    const stockpileAfter = world.stockpile.food;

    expect(world.size).toBe(16);
    expect(citizensAfter).toBeGreaterThanOrEqual(citizensBefore);
    expect(stockpileAfter).toBeGreaterThanOrEqual(0); // La comida puede bajar, pero debe ser un número válido
    expect(logs.length).toBeGreaterThan(0);
  });
});
