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
    const powerBefore = session.getPlayer().power;

    session.runTick(1, { moveIntent: { x: 1, y: 0 }, priority: "explore" });
    session.runTick(1, { moveIntent: { x: -1, y: 0 }, priority: "mine" });

    const citizensAfter = session.getCitizenSystem().getCitizens().length;
    const powerAfter = session.getPlayer().power;

    expect(world.size).toBe(16);
    expect(citizensAfter).toBeGreaterThanOrEqual(citizensBefore);
    expect(powerAfter).toBeGreaterThanOrEqual(powerBefore);
    expect(logs.length).toBeGreaterThan(0);
  });
});
