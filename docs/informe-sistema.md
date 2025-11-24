# Game loop, world, and villagers report

## Game loop
- The main loop lives in `src/game/game.ts:844`. It starts via `requestAnimationFrame`, freezes delta while the menu is open, and resumes counting when the menu closes.
- Each frame converts real time into simulation hours: it adds `deltaSeconds * HOURS_PER_SECOND * speedMultiplier` and processes fixed-size ticks `TICK_HOURS` (0.25 h, ~4 real seconds per sim hour). Inside the `while` it calls `runTick`.
- `runTick` delegates to `SimulationSession.runTick`, which applies pending priorities, updates events and climate, advances the world (`WorldEngine.updateEnvironment`), and runs the citizen system. Afterward it syncs the HUD, citizen panel, and structure selection.
- Rendering happens at the end of each frame with `GameRenderer.render`, receiving camera view, entities, notifications, and hovered/selected cell.
- Realtime input captures priority hotkeys (`PRIORITY_KEYMAP`), planning modes (farm/mine/gather/build), building cycle, zoom, and speed.

## World generator
- `WorldEngine` (`src/game/core/world/WorldEngine.ts`) builds the map. It uses `TerrainGenerator` to produce `WorldCell` grids with terrain, fertility, moisture, and initial resources; then it places the village center and initial structures via `StructureManager`.
- Navigation and movement use `PathFinder`, with walkable cells except ocean/snow. `addCitizen/moveCitizen` keep per-cell inhabitants up to date.
- `TerrainGenerator` (`src/game/core/world/modules/TerrainGenerator.ts`):
  - Generates elevation and moisture maps with multi-octave noise and warping.
  - Shapes smoothed biomes, rivers from peaks, coherent oceans, and beaches adjacent to the sea.
  - Guarantees a mountain core (and relocates resources there) and applies height/moisture biases to resolve the final biome per cell.
- `ResourceGenerator` decides fertility by terrain and distributes resources:
  - Renewable food hotspots in grassland/forest/swamp based on fertility; springs in rivers/ocean.
  - Renewable wood clusters in forests and non-renewable stone clusters in mountain/tundra/desert, ensuring stone in the mountain zone.
- Global stockpile state: food/stone/wood with base capacities; `updateEnvironment` adjusts capacities if granary/warehouse exist, grows renewable resources, and advances crops by stages depending on climate (drought/rain).
- Cell priorities (`setPriorityAt`) paint farm/mine/gather/explore/defend. Marking farm starts `farmTask = sow` and resets progress if unmarked.

## Villager system, roles, and resources
- `SimulationSession` (`src/game/core/SimulationSession.ts`) instantiates `WorldEngine` and `CitizenSystem`, creates the initial tribe by difficulty, and propagates events/climate each tick.
- `CitizenSystem` (`src/game/systems/CitizenSystem.ts`) orchestrates:
  - `CitizenNeedsSimulator` applies hunger/fatigue/morale and deaths.
  - `CitizenBehaviorDirector` decides actions by role/goal, prioritizing urgent needs (eat, flee, rest).
  - `Navigator` moves via pathfinding; `CitizenActionExecutor` applies effects (gathering, construction, combat, crop care, rest, storage) and logs actions.
  - `ResourceCollectionEngine` implements the gatherer “brain”: phases go to resource → gather → go to storage, with carrying capacity per type. Deposits in cells with `village/granary/warehouse`.
- Key roles:
  - `farmer`: prioritizes crop tasks in farm cells (sow/fertilize/harvest), then uses the food gatherer brain as fallback.
  - `worker`: follows construction directives (haul stone/wood from stockpile, work on site). If no site or missing material, switches to gathering stone/wood based on stock/capacity.
  - `warrior`: looks for threats (`threats` from `WorldView`), defends or patrols the center.
  - `scout`: follows `explore` marks or roams.
  - `child/elder`: passive; child can mature to worker, elder takes age damage.
- Resource flow: gatherers consume nodes (renewables decay but regrow with climate), carry loads to storage, `deposit/consume` on the world adjusts stock and affects morale/life from hunger; construction consumes stock delivered by workers.

## How it relates to player actions
- Roles: sliders in HUD (`Game.handleRoleSliderInput`) rebalance assignable populations via `CitizenSystem.rebalanceRoles`; changes apply live when a villager isn’t “busy.”
- Planning: buttons/hotkeys activate farm/mine/gather/build modes. Painting the map calls `WorldEngine.setPriorityAt`, marking cells the AI uses to pick resources or define crop tasks.
- Construction: in build mode select an unlocked structure (depends on population in `SimulationSession.getAvailableStructures`), place blueprint (`planConstruction`). `StructureManager` creates sites; `workerAI` hauls materials from stockpile and works until done, which expands capacities (granary/warehouse) and enables defense/faith (tower/temple).
- Time pacing: the player tweaks `speedMultiplier` or pauses; this changes how many ticks run per frame but not per-tick AI logic.
- Selection and focus: click/tap selects a villager or shows the cell tooltip; the camera can focus on a villager from the panel, but AI stays autonomous.
