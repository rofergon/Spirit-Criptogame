import { getStructureDefinition, type StructureRequirements } from "../data/structures";
import type { PriorityMark, StructureType, Vec2 } from "../core/types";
import type { SimulationSession } from "../core/SimulationSession";
import type { HUDController } from "../ui/HUDController";
import type { CameraController } from "../core/CameraController";
import type { MainMenu } from "../ui/MainMenu";

export type PlanningMode = "farm" | "mine" | "gather" | "explore" | "build";

interface PlanningDependencies {
  hud: HUDController;
  camera: CameraController;
  mainMenu: MainMenu;
  getSimulation: () => SimulationSession | null;
  onPauseToggle: () => void;
  onResize: () => void;
  getHoveredCell: () => Vec2 | null;
  isRunning: () => boolean;
}

export class PlanningController {
  private planningPriority: PlanningMode | null = null;
  private planningStrokeActive = false;
  private planningStrokeCells = new Set<string>();
  private skipNextCanvasClick = false;
  private skipClickReset: number | null = null;
  private planningButtons: HTMLButtonElement[] = [];

  private buildSelector = document.querySelector<HTMLDivElement>("#build-selector");
  private structurePrevButton = document.querySelector<HTMLButtonElement>("#build-prev");
  private structureNextButton = document.querySelector<HTMLButtonElement>("#build-next");
  private structureLabel = document.querySelector<HTMLSpanElement>("#build-name");
  private structureStatusLabel = document.querySelector<HTMLSpanElement>("#build-status");
  private buildDetailsContainer = document.querySelector<HTMLDivElement>("#build-details");
  private buildDetailsSummary = document.querySelector<HTMLParagraphElement>("#build-details-summary");
  private buildDetailsCost = document.querySelector<HTMLSpanElement>("#build-details-cost");
  private buildDetailsRequirements = document.querySelector<HTMLSpanElement>("#build-details-requirements");
  private planningHintLabel = document.querySelector<HTMLDivElement>("#planning-hint");
  private selectedStructureType: StructureType | null = null;
  private availableStructures: StructureType[] = [];

  private mobileMediaQuery: MediaQueryList;
  private useMobileLayout = false;
  private mobileActionBar: HTMLDivElement | null = null;
  private mobileHintBubble: HTMLDivElement | null = null;
  private mobileHintTimeout: number | null = null;
  private mobileBuildLabel: HTMLSpanElement | null = null;
  private mobilePlanningButtons: Partial<Record<PlanningMode, HTMLButtonElement>> = {};
  private zoomInButton: HTMLButtonElement | null = null;
  private zoomOutButton: HTMLButtonElement | null = null;

  constructor(private readonly deps: PlanningDependencies) {
    this.mobileMediaQuery = window.matchMedia("(max-width: 900px)");
    this.useMobileLayout = this.shouldUseMobileLayout();
    document.body.classList.toggle("is-mobile", this.useMobileLayout);
    this.deps.mainMenu.setMobileMode(this.useMobileLayout);
  }

  init() {
    this.setupPlanningControls();
    this.mobileMediaQuery.addEventListener("change", this.syncMobileLayout);
    window.addEventListener("orientationchange", this.syncMobileLayout);
    this.initializeMobileUI();
  }

  destroy() {
    this.teardownMobileUI();
    this.mobileMediaQuery.removeEventListener("change", this.syncMobileLayout);
    window.removeEventListener("orientationchange", this.syncMobileLayout);
  }

  registerZoomButtons(zoomIn: HTMLButtonElement | null, zoomOut: HTMLButtonElement | null) {
    this.zoomInButton = zoomIn;
    this.zoomOutButton = zoomOut;
  }

  isMobileLayout() {
    return this.useMobileLayout;
  }

  getPlanningMode() {
    return this.planningPriority;
  }

  isBuildMode() {
    return this.planningPriority === "build";
  }

  isActive() {
    return this.planningPriority !== null;
  }

  isStrokeActive() {
    return this.planningStrokeActive;
  }

  startStrokeAt(cell: Vec2) {
    if (!this.planningPriority) {
      return;
    }
    if (this.planningPriority === "build") {
      this.applyStructurePlan(cell);
      this.resetStroke();
      return;
    }
    this.planningStrokeActive = true;
    this.planningStrokeCells.clear();
    this.applyPlanningAtCell(cell);
  }

  continueStrokeAt(cell: Vec2 | null) {
    if (!cell || !this.planningStrokeActive || !this.planningPriority || this.planningPriority === "build") {
      return;
    }
    this.applyPlanningAtCell(cell);
  }

  finishStroke(clearPlanning = false) {
    this.planningStrokeActive = false;
    this.planningStrokeCells.clear();
    if (clearPlanning && this.planningPriority && this.planningPriority !== "build") {
      this.clearPlanningMode();
    }
  }

  resetStroke() {
    this.planningStrokeActive = false;
    this.planningStrokeCells.clear();
  }

  consumeSkippedClick() {
    if (!this.skipNextCanvasClick) {
      return false;
    }
    this.skipNextCanvasClick = false;
    if (this.skipClickReset !== null) {
      window.clearTimeout(this.skipClickReset);
      this.skipClickReset = null;
    }
    return true;
  }

  suppressNextCanvasClick(delayMs = 400) {
    this.skipNextCanvasClick = true;
    if (this.skipClickReset !== null) {
      window.clearTimeout(this.skipClickReset);
    }
    this.skipClickReset = window.setTimeout(() => {
      this.skipNextCanvasClick = false;
      this.skipClickReset = null;
    }, delayMs);
  }

  togglePlanningMode(mode: PlanningMode) {
    if (this.planningPriority === mode) {
      this.clearPlanningMode();
      return;
    }
    this.activatePlanningMode(mode);
  }

  activatePlanningMode(mode: PlanningMode) {
    this.planningPriority = mode;
    if (mode !== "build") {
      this.planningStrokeActive = false;
      this.planningStrokeCells.clear();
    } else {
      this.ensureStructureSelection();
    }
    this.updatePlanningButtons();
    this.updatePlanningHint();
    this.updateBuildSelectorVisibility();
  }

  clearPlanningMode() {
    if (!this.planningPriority) {
      return;
    }
    this.planningPriority = null;
    this.planningStrokeActive = false;
    this.planningStrokeCells.clear();
    this.updatePlanningButtons();
    this.updatePlanningHint();
    this.updateBuildSelectorVisibility();
  }

  updatePlanningHint(message?: string) {
    if (message) {
      this.setPlanningHint(message);
      return;
    }
    if (!this.planningHintLabel) {
      return;
    }
    if (!this.planningPriority) {
      this.setPlanningHint("Select a mode to start marking zones.");
      return;
    }
    if (this.planningPriority === "build") {
      const isSelectedAvailable = this.selectedStructureType
        ? this.availableStructures.includes(this.selectedStructureType)
        : false;
      if (!this.selectedStructureType) {
        this.setPlanningHint("No buildings available yet. Increase population to unlock them.");
      } else if (!isSelectedAvailable) {
        this.setPlanningHint("Building locked. Meet the requirements to plan it.");
      } else {
        this.setPlanningHint("Click on the map to place the blueprint of the selected building.");
      }
      return;
    }
    const labels: Record<Exclude<PlanningMode, "build">, string> = {
      farm: "Drag over the map to mark crop zones.",
      mine: "Paint over hills or mountains to prioritize mining.",
      gather: "Designate natural gathering zones for your workers.",
      explore: "Mark regions for scouts to uncover the fog of war.",
    };
    this.setPlanningHint(labels[this.planningPriority]);
  }

  refreshStructureSelection() {
    const simulation = this.deps.getSimulation();
    if (!simulation) {
      if (this.availableStructures.length > 0 || this.selectedStructureType) {
        this.availableStructures = [];
        this.selectedStructureType = null;
        this.updateStructureDetails();
      }
      return;
    }
    const unlocked = simulation.getAvailableStructures();
    const prevKey = this.availableStructures.join(",");
    const nextKey = unlocked.join(",");
    if (prevKey === nextKey) {
      return;
    }
    this.availableStructures = unlocked;
    this.ensureStructureSelection();
    this.updateStructureDetails();
    this.updatePlanningHint();
  }

  cycleStructure(direction: number) {
    if (this.availableStructures.length === 0) {
      return;
    }
    if (!this.selectedStructureType) {
      this.selectedStructureType = this.availableStructures[0] ?? null;
      this.updateStructureDetails();
      this.updatePlanningHint();
      return;
    }
    const index = this.availableStructures.indexOf(this.selectedStructureType);
    const length = this.availableStructures.length;
    const nextIndex = (index + direction + length) % length;
    this.selectedStructureType = this.availableStructures[nextIndex] ?? null;
    this.updateStructureDetails();
    this.updatePlanningHint();
  }

  handlePlanningTouch(position: { x: number; y: number }) {
    const eventLike = { clientX: position.x, clientY: position.y } as MouseEvent;
    const cell = this.deps.camera.getCellUnderPointer(eventLike);
    if (!cell) {
      return;
    }
    if (this.planningPriority === "build") {
      this.applyStructurePlan(cell);
      this.resetStroke();
    } else if (this.planningPriority) {
      this.planningStrokeActive = true;
      this.planningStrokeCells.clear();
      this.applyPlanningAtCell(cell);
    }
  }

  updateMobileHint(text: string, sticky = false) {
    if (!this.useMobileLayout || !this.mobileHintBubble) {
      return;
    }
    this.mobileHintBubble.textContent = this.formatMobileHint(text);
    this.mobileHintBubble.classList.add("visible");
    if (this.mobileHintTimeout) {
      window.clearTimeout(this.mobileHintTimeout);
      this.mobileHintTimeout = null;
    }
    if (!sticky) {
      this.mobileHintTimeout = window.setTimeout(() => {
        this.mobileHintBubble?.classList.remove("visible");
      }, 2600);
    }
  }

  private setupPlanningControls() {
    this.planningButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".planning-hex-button"));
    this.planningButtons.forEach((button) => {
      const mode = button.dataset.planningMode as PlanningMode | undefined;
      if (!mode) return;
      button.addEventListener("click", () => this.togglePlanningMode(mode));
    });

    const hexButtons = document.querySelectorAll<HTMLButtonElement>(".construction-hex-button");
    hexButtons.forEach((button) => {
      const structureType = button.dataset.structure as StructureType | undefined;
      if (!structureType) return;
      button.addEventListener("click", () => {
        this.activatePlanningMode("build");
        this.selectedStructureType = structureType;
        this.updateStructureDetails();
        this.updatePlanningHint();
      });
    });

    this.structurePrevButton?.addEventListener("click", () => this.cycleStructure(-1));
    this.structureNextButton?.addEventListener("click", () => this.cycleStructure(1));

    this.updatePlanningButtons();
    this.updatePlanningHint();
    this.updateBuildSelectorVisibility();
    this.updateStructureDetails();
  }

  private shouldUseMobileLayout() {
    const prefersSmallScreen = typeof window !== "undefined" && "matchMedia" in window && this.mobileMediaQuery.matches;
    const touchCapable =
      (typeof window !== "undefined" && "ontouchstart" in window) ||
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 1);
    return Boolean(prefersSmallScreen || touchCapable);
  }

  private syncMobileLayout = () => {
    const next = this.shouldUseMobileLayout();
    if (next === this.useMobileLayout) {
      return;
    }
    this.useMobileLayout = next;
    document.body.classList.toggle("is-mobile", this.useMobileLayout);
    this.deps.mainMenu.setMobileMode(this.useMobileLayout);
    if (this.useMobileLayout) {
      this.initializeMobileUI();
    } else {
      this.teardownMobileUI();
    }
    this.deps.onResize();
  };

  setActionBarHidden(hidden: boolean) {
    if (!this.mobileActionBar) {
      return;
    }
    this.mobileActionBar.classList.toggle("is-hidden", hidden);
  }

  private initializeMobileUI() {
    if (!this.useMobileLayout) {
      return;
    }
    this.createMobileActionBar();
    this.setupMobileTooltips();
    this.updatePlanningButtons();
    this.updateStructureDetails();
    if (this.planningHintLabel?.textContent) {
      this.updateMobileHint(this.planningHintLabel.textContent, true);
    }
  }

  private teardownMobileUI() {
    this.mobileActionBar?.remove();
    this.mobileActionBar = null;
    this.mobilePlanningButtons = {};
    this.mobileHintBubble = null;
    this.mobileBuildLabel = null;
    if (this.mobileHintTimeout) {
      window.clearTimeout(this.mobileHintTimeout);
      this.mobileHintTimeout = null;
    }
  }

  private createMobileActionBar() {
    if (this.mobileActionBar) {
      return;
    }
    const bar = document.createElement("div");
    bar.id = "mobile-action-bar";
    bar.innerHTML = `
      <div class="mobile-action-row">
        <button type="button" data-mobile-mode="farm" aria-label="Crops" data-mobile-tip="Mark fertile zones for sowing.">🌾</button>
        <button type="button" data-mobile-mode="mine" aria-label="Mining" data-mobile-tip="Prioritize quarries and hills.">🪨</button>
        <button type="button" data-mobile-mode="gather" aria-label="Gathering" data-mobile-tip="Gather quick natural resources.">🍃</button>
        <button type="button" data-mobile-mode="explore" aria-label="Exploration" data-mobile-tip="Mark zones for scouts to reveal.">🧭</button>
        <button type="button" data-mobile-mode="build" class="mobile-build-button" aria-label="Construction" data-mobile-tip="Create building blueprints where you touch.">
          🧱 <span id="mobile-build-label">-</span>
        </button>
      </div>
      <div class="mobile-action-row mobile-secondary-row">
        <button type="button" data-mobile-action="prev-structure" aria-label="Previous building" data-mobile-tip="Switch to previous building.">◀</button>
        <button type="button" data-mobile-action="pause" aria-label="Pause or resume" data-mobile-tip="Pause or resume the simulation.">⏯️</button>
        <button type="button" data-mobile-action="next-structure" aria-label="Next building" data-mobile-tip="Switch to next building.">▶</button>
        <button type="button" data-mobile-action="zoom-out" aria-label="Zoom out" data-mobile-tip="Zoom out map.">−</button>
        <button type="button" data-mobile-action="zoom-in" aria-label="Zoom in" data-mobile-tip="Zoom in map.">+</button>
      </div>
      <div id="mobile-hint-bubble" aria-live="polite"></div>
    `;
    document.body.appendChild(bar);
    this.mobileActionBar = bar;
    this.mobileHintBubble = bar.querySelector<HTMLDivElement>("#mobile-hint-bubble");
    this.mobileBuildLabel = bar.querySelector<HTMLSpanElement>("#mobile-build-label");
    this.mobilePlanningButtons = {
      farm: bar.querySelector<HTMLButtonElement>('[data-mobile-mode="farm"]') ?? undefined,
      mine: bar.querySelector<HTMLButtonElement>('[data-mobile-mode="mine"]') ?? undefined,
      gather: bar.querySelector<HTMLButtonElement>('[data-mobile-mode="gather"]') ?? undefined,
      explore: bar.querySelector<HTMLButtonElement>('[data-mobile-mode="explore"]') ?? undefined,
      build: bar.querySelector<HTMLButtonElement>('[data-mobile-mode="build"]') ?? undefined,
    };
    this.registerMobileActionHandlers(bar);
  }

  private registerMobileActionHandlers(bar: HTMLDivElement) {
    const modeButtons = bar.querySelectorAll<HTMLButtonElement>("[data-mobile-mode]");
    modeButtons.forEach((btn) => {
      const mode = btn.dataset.mobileMode as PlanningMode | undefined;
      if (!mode) return;
      btn.addEventListener("click", () => {
        this.togglePlanningMode(mode);
        this.updateMobileHint(btn.dataset.mobileTip ?? `Mode ${mode}`);
      });
      this.attachMobileTip(btn, btn.dataset.mobileTip ?? "");
    });

    const prevButton = bar.querySelector<HTMLButtonElement>('[data-mobile-action="prev-structure"]');
    const nextButton = bar.querySelector<HTMLButtonElement>('[data-mobile-action="next-structure"]');
    const pauseButton = bar.querySelector<HTMLButtonElement>('[data-mobile-action="pause"]');
    const zoomInButton = bar.querySelector<HTMLButtonElement>('[data-mobile-action="zoom-in"]');
    const zoomOutButton = bar.querySelector<HTMLButtonElement>('[data-mobile-action="zoom-out"]');

    prevButton?.addEventListener("click", () => {
      this.activatePlanningMode("build");
      this.cycleStructure(-1);
      this.updateMobileHint("Previous building");
    });
    nextButton?.addEventListener("click", () => {
      this.activatePlanningMode("build");
      this.cycleStructure(1);
      this.updateMobileHint("Next building");
    });
    pauseButton?.addEventListener("click", () => {
      this.deps.onPauseToggle();
      this.updateMobileHint(this.deps.isRunning() ? "▶️ Simulation in progress" : "⏸️ Paused");
    });
    zoomInButton?.addEventListener("click", () => {
      const hovered = this.deps.getHoveredCell();
      const anchor = hovered ? { x: hovered.x + 0.5, y: hovered.y + 0.5 } : this.deps.camera.getViewTarget();
      this.deps.camera.adjustZoom(0.25, anchor ?? undefined);
      this.updateMobileHint("Zoom in map");
    });
    zoomOutButton?.addEventListener("click", () => {
      const hovered = this.deps.getHoveredCell();
      const anchor = hovered ? { x: hovered.x + 0.5, y: hovered.y + 0.5 } : this.deps.camera.getViewTarget();
      this.deps.camera.adjustZoom(-0.25, anchor ?? undefined);
      this.updateMobileHint("Zoom out map");
    });

    [prevButton, nextButton, pauseButton, zoomInButton, zoomOutButton].forEach((btn) => {
      this.attachMobileTip(btn, btn?.dataset.mobileTip ?? "");
    });
  }

  private setupMobileTooltips() {
    if (!this.useMobileLayout) {
      return;
    }
    const tipTargets: Array<[HTMLElement | null, string]> = [
      [this.zoomInButton, "Zoom in map"],
      [this.zoomOutButton, "Zoom out map"],
      [this.structurePrevButton, "Previous building"],
      [this.structureNextButton, "Next building"],
      [this.planningHintLabel, "Choose a mode and paint over the map."],
    ];
    this.planningButtons.forEach((button) => {
      const mode = button.dataset.planningMode as PlanningMode | undefined;
      if (!mode) return;
      const defaultHints: Record<PlanningMode, string> = {
        farm: "Mark crop fields.",
        mine: "Mark mines and quarries.",
        gather: "Gather natural resources.",
        explore: "Plan exploration routes.",
        build: "Place building blueprints.",
      };
      tipTargets.push([button, defaultHints[mode]]);
    });
    tipTargets.forEach(([el, message]) => this.attachMobileTip(el, message));
  }

  private attachMobileTip(element: HTMLElement | null, message: string) {
    if (!element || !message) {
      return;
    }
    if ((element as HTMLElement).dataset.tipBound === "true") {
      return;
    }
    element.dataset.tipBound = "true";
    element.setAttribute("data-mobile-tip", message);
    element.addEventListener("pointerup", () => this.updateMobileHint(message));
    element.addEventListener("focus", () => this.updateMobileHint(message, true));
  }

  private setPlanningHint(text: string) {
    if (!this.planningHintLabel) return;
    this.planningHintLabel.textContent = text;
    this.updateMobileHint(text, true);
  }

  private updateBuildSelectorVisibility() {
    if (!this.buildSelector) {
      return;
    }
    const show = this.planningPriority === "build";
    this.buildSelector.classList.toggle("collapsed", !show);
    this.buildSelector.setAttribute("aria-hidden", show ? "false" : "true");
  }

  private ensureStructureSelection() {
    if (!this.selectedStructureType && this.availableStructures.length > 0) {
      this.selectedStructureType = this.availableStructures[0] ?? null;
    }
  }

  private updateStructureDetails() {
    const hasOptions = this.availableStructures.length > 0 || !!this.selectedStructureType;
    const disableCyclers = this.availableStructures.length <= 1;
    if (this.structurePrevButton) {
      this.structurePrevButton.disabled = disableCyclers;
    }
    if (this.structureNextButton) {
      this.structureNextButton.disabled = disableCyclers;
    }

    const hexButtons = document.querySelectorAll<HTMLButtonElement>(".construction-hex-button");
    hexButtons.forEach((button) => {
      const structureType = button.dataset.structure as StructureType | undefined;
      if (!structureType) return;

      const isAvailable = this.availableStructures.includes(structureType);
      button.disabled = false;
      button.classList.toggle("locked", !isAvailable);
      button.setAttribute("aria-disabled", isAvailable ? "false" : "true");

      const isSelected = structureType === this.selectedStructureType;
      button.classList.toggle("selected", isSelected);
    });

    if (!this.selectedStructureType) {
      if (this.structureLabel) this.structureLabel.textContent = "None";
      if (this.structureStatusLabel) {
        this.structureStatusLabel.textContent = hasOptions
          ? "Select a building to start."
          : "Increase population to unlock buildings.";
      }
      if (this.buildDetailsContainer) {
        this.buildDetailsContainer.hidden = true;
      }
      if (this.buildDetailsSummary) {
        this.buildDetailsSummary.textContent = "Select a building to see its details.";
      }
      if (this.buildDetailsCost) {
        this.buildDetailsCost.textContent = "-";
      }
      if (this.buildDetailsRequirements) {
        this.buildDetailsRequirements.textContent = "-";
      }
      if (this.mobileBuildLabel) {
        this.mobileBuildLabel.textContent = "—";
        this.mobileBuildLabel.title = "No buildings available";
      }
      return;
    }

    const definition = getStructureDefinition(this.selectedStructureType);
    const isSelectedAvailable = this.selectedStructureType
      ? this.availableStructures.includes(this.selectedStructureType)
      : false;
    if (this.structureLabel) {
      if (definition) {
        this.structureLabel.textContent = `${definition.icon} ${definition.displayName}`;
      } else {
        this.structureLabel.textContent = this.selectedStructureType;
      }
    }
    if (this.structureStatusLabel) {
      this.structureStatusLabel.textContent = isSelectedAvailable
        ? "Click on the map to plan this building."
        : "Locked: meet requirements to plan this building.";
    }
    if (this.buildDetailsContainer) {
      this.buildDetailsContainer.hidden = !definition;
    }
    if (definition) {
      if (this.buildDetailsSummary) {
        this.buildDetailsSummary.textContent = definition.summary;
      }
      if (this.buildDetailsCost) {
        this.buildDetailsCost.textContent = this.formatStructureCosts(definition.costs);
      }
      if (this.buildDetailsRequirements) {
        this.buildDetailsRequirements.textContent = this.formatStructureRequirements(definition.requirements);
      }
    }
    if (this.mobileBuildLabel) {
      this.mobileBuildLabel.textContent = definition?.icon ?? "🧱";
      this.mobileBuildLabel.title = definition?.displayName ?? this.selectedStructureType;
    }
  }

  private formatStructureCosts(costs: { stone?: number; food?: number; wood?: number }) {
    const parts: string[] = [];
    if (costs.stone && costs.stone > 0) {
      parts.push(`${costs.stone} stone${costs.stone > 1 ? "s" : ""}`);
    }
    if (costs.food && costs.food > 0) {
      parts.push(`${costs.food} food`);
    }
    if (costs.wood && costs.wood > 0) {
      parts.push(`${costs.wood} wood${costs.wood > 1 ? "s" : ""}`);
    }
    return parts.length > 0 ? parts.join(" · ") : "No cost";
  }

  private formatStructureRequirements(req: StructureRequirements) {
    const parts: string[] = [];
    if (req.population) {
      parts.push(`Population ${req.population}+`);
    }
    if (req.structures && req.structures.length > 0) {
      const names = req.structures
        .map((type) => getStructureDefinition(type)?.displayName ?? type)
        .join(", ");
      parts.push(`Structures: ${names}`);
    }
    return parts.length > 0 ? parts.join(" | ") : "None";
  }

  private applyPlanningAtCell(cell: Vec2) {
    const simulation = this.deps.getSimulation();
    if (!simulation || !this.planningPriority || this.planningPriority === "build") {
      return;
    }
    const key = this.planningCellKey(cell);
    if (this.planningStrokeCells.has(key)) {
      return;
    }
    this.planningStrokeCells.add(key);
    const priority = this.planningPriority as PriorityMark;
    simulation.getWorld().setPriorityAt(cell.x, cell.y, priority);
  }

  private applyStructurePlan(cell: Vec2) {
    const simulation = this.deps.getSimulation();
    if (!simulation) {
      return;
    }
    if (!this.selectedStructureType) {
      const message = "No buildings unlocked yet.";
      this.deps.hud.updateStatus(message);
      this.updatePlanningHint(message);
      this.clearPlanningMode();
      return;
    }
    const result = simulation.planConstruction(this.selectedStructureType, cell);
    const message = result.ok
      ? `Blueprint placed at (${cell.x}, ${cell.y}).`
      : result.reason ?? "Could not place blueprint here.";
    this.deps.hud.updateStatus(message);
    this.updatePlanningHint(message);
    this.clearPlanningMode();
  }

  private planningCellKey(cell: Vec2) {
    return `${cell.x},${cell.y}`;
  }

  private updatePlanningButtons() {
    if (this.planningButtons.length === 0) {
      return;
    }
    this.planningButtons.forEach((button) => {
      const mode = button.dataset.planningMode as PlanningMode | undefined;
      if (!mode) return;
      const active = mode === this.planningPriority;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    Object.entries(this.mobilePlanningButtons).forEach(([mode, button]) => {
      if (!button) return;
      const active = mode === this.planningPriority;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  private formatMobileHint(text: string) {
    const trimmed = text.trim();
    if (trimmed.length <= 90) {
      return trimmed;
    }
    return `${trimmed.slice(0, 88)}…`;
  }
}
