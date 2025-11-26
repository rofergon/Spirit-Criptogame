import { PRIORITY_KEYMAP, WORLD_SIZE } from "./core/constants";
import { InputHandler } from "./core/InputHandler";
import { clamp } from "./core/utils";
import type { Citizen, PriorityMark, ToastNotification, Vec2 } from "./core/types";
import type { SimulationSession, SimulationVisualEvent } from "./core/SimulationSession";
import { CameraController } from "./core/CameraController";
import { HUDController, type HUDSnapshot } from "./ui/HUDController";
import { CitizenPortraitBarController } from "./ui/CitizenPortraitBar";
import { CitizenControlPanelController } from "./ui/CitizenControlPanel";
import { GameRenderer, type RenderState } from "./ui/GameRenderer";
import { MainMenu } from "./ui/MainMenu";
import { CellTooltipController } from "./ui/CellTooltip";
import { PlanningController } from "./controllers/PlanningController";
import { TokenController } from "./controllers/TokenController";
import { ThreatController } from "./controllers/ThreatController";
import { RoleController } from "./controllers/RoleController";
import { InteractionController } from "./controllers/InteractionController";
import { LifecycleController } from "./controllers/LifecycleController";

export class Game {
  private readonly input = new InputHandler();
  private mainMenu: MainMenu;
  private readonly renderer: GameRenderer;
  private readonly hud = new HUDController();
  private readonly portraitBar = new CitizenPortraitBarController({ onSelectCitizen: (id) => this.handleCitizenSelection(id) });
  private readonly citizenPanel = new CitizenControlPanelController({ onClose: () => this.handlePanelClose() });
  private readonly cellTooltip: CellTooltipController;
  private readonly planning: PlanningController;
  private readonly roles: RoleController;
  private readonly interactions: InteractionController;
  private readonly playerTribeId = 1;
  private simulation: SimulationSession | null = null;
  private readonly tokens: TokenController;
  private readonly threats: ThreatController;
  private readonly lifecycle: LifecycleController;
  private debugExportButton = document.querySelector<HTMLButtonElement>("#debug-export");
  private extinctionAnnounced = false;
  private readonly camera: CameraController;

  private pendingPriority: PriorityMark | null = null;

  private selectedCitizen: Citizen | null = null;
  private hoveredCell: Vec2 | null = null;

  private readonly minZoom = 2;
  private readonly maxZoom = 10;
  private zoomInButton = document.querySelector<HTMLButtonElement>("#zoom-in");
  private zoomOutButton = document.querySelector<HTMLButtonElement>("#zoom-out");
  private speedButtons: HTMLButtonElement[] = [];
  private projectileAnimations: Array<{ from: Vec2; to: Vec2; spawnedAt: number; duration: number }> = [];
  private readonly projectileDurationMs = 650;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new GameRenderer(canvas);
    this.cellTooltip = new CellTooltipController({
      onCancelConstruction: this.handleCancelConstruction,
      onClearPriority: this.handleClearPriority,
    });
    this.camera = new CameraController({ canvas, minZoom: this.minZoom, maxZoom: this.maxZoom }, () => this.simulation?.getWorld() ?? null);
    this.mainMenu = new MainMenu(canvas, { isMobile: false });
    this.planning = new PlanningController({
      hud: this.hud,
      camera: this.camera,
      mainMenu: this.mainMenu,
      getSimulation: () => this.simulation,
      onPauseToggle: () => this.lifecycle?.handlePauseToggle(),
      onResize: this.handleResize,
      getHoveredCell: () => this.hoveredCell,
      isRunning: () => this.lifecycle?.isRunning() ?? false,
    });
    this.roles = new RoleController({
      hud: this.hud,
      getSimulation: () => this.simulation,
      playerTribeId: this.playerTribeId,
    });
    this.interactions = new InteractionController({
      canvas,
      camera: this.camera,
      planning: this.planning,
      getSimulation: () => this.simulation,
      onSelectCitizen: (citizen) => {
        this.selectedCitizen = citizen;
      },
      onUpdateCitizenPanel: () => this.updateCitizenControlPanel(),
      onDraw: () => this.draw(),
      getHoveredCell: () => this.hoveredCell,
      setHoveredCell: (cell) => {
        this.hoveredCell = cell;
      },
      showCellTooltip: (cell, event) => this.showCellTooltip(cell, event),
      hideOverlayTooltip: () => this.cellTooltip.hide(),
    });
    this.tokens = new TokenController({
      hud: this.hud,
      getSimulation: () => this.simulation,
      logEvent: (message, notificationType) => this.logEvent(message, notificationType),
      onBalancesChanged: () => this.updateHUD(),
    });
    this.threats = new ThreatController({
      hud: this.hud,
      camera: this.camera,
      getSimulation: () => this.simulation,
      onPause: () => this.lifecycle.pause(),
      onResume: () => this.lifecycle.resume(),
      onRequestRender: () => this.draw(),
      playerTribeId: this.playerTribeId,
    });
    this.lifecycle = new LifecycleController({
      playerTribeId: this.playerTribeId,
      mainMenu: this.mainMenu,
      planning: this.planning,
      camera: this.camera,
      hud: this.hud,
      tokens: this.tokens,
      roles: this.roles,
      threats: this.threats,
      logEvent: (message, notificationType) => this.logEvent(message, notificationType),
      onExtinction: this.handleExtinction,
      resetExtinctionAnnouncement: () => {
        this.extinctionAnnounced = false;
      },
      clearSelection: () => {
        this.selectedCitizen = null;
        this.hoveredCell = null;
      },
      setSimulation: (session) => {
        this.simulation = session;
      },
      updateCitizenPanel: () => this.updateCitizenControlPanel(),
      onTick: (tickHours) => this.runTick(tickHours),
      onDraw: () => this.draw(),
      onFrame: () => this.handleRealtimeInput(),
      onSpeedChange: (multiplier, changed) => {
        this.updateSpeedButtons(multiplier);
        if (changed && this.lifecycle.isInitialized()) {
          this.logEvent(`Simulation speed ${multiplier}×`);
        }
      },
    });
    this.camera.setViewTarget({ x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 });

    this.hud.setupHeaderButtons(() => this.lifecycle.handlePauseToggle());
    this.hud.hideOverlay(); // Hide the overlay immediately
    this.hud.updateStatus("🎮 Configure your world and press START");
    this.hud.setPauseButtonState(false); // Show button as if paused

    this.planning.registerZoomButtons(this.zoomInButton, this.zoomOutButton);
    this.setupZoomControls();
    this.roles.init();
    this.setupSpeedControls();
    this.planning.init();
    this.tokens.init();
    this.threats.init();
    this.interactions.bind();
    this.debugExportButton?.addEventListener("click", this.exportDebugLog);

    window.addEventListener("resize", this.handleResize);
    this.handleResize();

    // Start the render loop immediately to show the menu
    this.lifecycle.start();
  }

  private setupSpeedControls() {
    const container = document.querySelector<HTMLDivElement>(".speed-controls-header");
    if (!container) {
      return;
    }
    this.speedButtons = Array.from(container.querySelectorAll<HTMLButtonElement>("button[data-speed]"));
    if (this.speedButtons.length === 0) {
      return;
    }
    this.speedButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextSpeed = Number(button.dataset.speed ?? "1");
        if (!Number.isFinite(nextSpeed) || nextSpeed <= 0) {
          return;
        }
        this.lifecycle.setSpeedMultiplier(nextSpeed);
      });
    });
    this.updateSpeedButtons();
  }

  private updateSpeedButtons(activeMultiplier = this.lifecycle.getSpeedMultiplier()) {
    if (this.speedButtons.length === 0) {
      return;
    }
    this.speedButtons.forEach((button) => {
      const buttonSpeed = Number(button.dataset.speed ?? "1");
      const isActive = buttonSpeed === activeMultiplier;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  private handleCancelConstruction = (siteId: number) => {
    if (!this.simulation) return;
    const result = this.simulation.cancelConstruction(siteId, { reclaimMaterials: true });
    if (!result.ok) {
      this.hud.updateStatus(result.reason ?? "Could not cancel construction.");
      return;
    }
    const parts: string[] = [];
    if (result.stoneReturned && result.stoneReturned > 0) {
      parts.push(`${result.stoneReturned} stone`);
    }
    if (result.woodReturned && result.woodReturned > 0) {
      parts.push(`${result.woodReturned} wood`);
    }
    const reclaimed = parts.length > 0 ? ` Materials reclaimed: ${parts.join(", ")}.` : "";
    this.hud.updateStatus(`Construction canceled.${reclaimed}`.trim());
    this.updateHUD();
    this.planning.refreshStructureSelection();
    this.cellTooltip.hide();
  };

  private handleClearPriority = (cell: Vec2) => {
    if (!this.simulation) return;
    const result = this.simulation.clearPriorityAt(cell);
    this.hud.updateStatus(
      result.ok ? `Designation cleared at (${cell.x}, ${cell.y}).` : result.reason ?? "Could not clear designation.",
    );
    this.cellTooltip.hide();
  };

  private handleRealtimeInput() {
    Object.entries(PRIORITY_KEYMAP).forEach(([key, priority]) => {
      if (this.input.consumeKey(key)) {
        this.pendingPriority = priority;
      }
    });

    if (this.input.consumeKey("KeyF")) {
      this.planning.togglePlanningMode("farm");
    }
    if (this.input.consumeKey("KeyM")) {
      this.planning.togglePlanningMode("mine");
    }
    if (this.input.consumeKey("KeyG")) {
      this.planning.togglePlanningMode("gather");
    }
    if (this.input.consumeKey("KeyB")) {
      this.planning.togglePlanningMode("build");
    }
    if (this.input.consumeKey("Escape")) {
      this.planning.clearPlanningMode();
    }
    if (this.planning.isBuildMode()) {
      if (this.input.consumeKey("BracketLeft")) {
        this.planning.cycleStructure(-1);
      }
      if (this.input.consumeKey("BracketRight")) {
        this.planning.cycleStructure(1);
      }
    }
  }

  private runTick(tickHours: number) {
    if (!this.lifecycle.isInitialized() || !this.simulation) return;

    const priority = this.pendingPriority;

    this.simulation.runTick(tickHours, {
      priority: priority ?? null,
    });
    const visualEvents = this.simulation.consumeVisualEvents();
    if (visualEvents.length > 0) {
      this.enqueueProjectileVisuals(visualEvents);
    }

    this.pendingPriority = null;

    if (this.selectedCitizen?.state === "dead") {
      this.selectedCitizen = null;
    }

    this.hud.tickNotifications();
    this.roles.refresh();
    this.updateHUD();
    this.updateCitizenControlPanel();
    this.planning.refreshStructureSelection();
  }

  private enqueueProjectileVisuals(events: SimulationVisualEvent[]) {
    const now = performance.now();
    events.forEach((event) => {
      if (event.type === "towerProjectile") {
        this.projectileAnimations.push({
          from: event.from,
          to: event.to,
          spawnedAt: now,
          duration: this.projectileDurationMs,
        });
      }
    });
  }

  private collectProjectileFrames(): RenderState["projectiles"] {
    const now = performance.now();
    const active: typeof this.projectileAnimations = [];
    const frames: RenderState["projectiles"] = [];

    this.projectileAnimations.forEach((projectile) => {
      const progress = (now - projectile.spawnedAt) / projectile.duration;
      if (progress <= 1) {
        frames.push({
          from: projectile.from,
          to: projectile.to,
          progress: clamp(progress, 0, 1),
        });
        active.push(projectile);
      }
    });

    this.projectileAnimations = active;
    return frames;
  }



  private updateHUD() {
    if (!this.lifecycle.isInitialized() || !this.simulation) return;
    const citizenSystem = this.simulation.getCitizenSystem();
    const world = this.simulation.getWorld();
    const citizens = citizenSystem.getCitizens();
    const livingPopulation = citizens.filter((citizen) => citizen.state === "alive").length;
    const tokenSnapshot = this.tokens.getTokenSnapshot() ?? this.simulation.getTokens();
    const hudSnapshot: HUDSnapshot = {
      faith: this.simulation.getFaithSnapshot(),
      tokens: tokenSnapshot,
      population: {
        value: livingPopulation,
        trend: this.simulation.getResourceTrendAverage("population"),
      },
      climate: this.simulation.getClimate(),
      food: {
        value: world.stockpile.food,
        capacity: world.stockpile.foodCapacity,
        trend: this.simulation.getResourceTrendAverage("food"),
      },
      stone: {
        value: world.stockpile.stone,
        capacity: world.stockpile.stoneCapacity,
        trend: this.simulation.getResourceTrendAverage("stone"),
      },
      wood: {
        value: world.stockpile.wood,
        capacity: world.stockpile.woodCapacity,
        trend: this.simulation.getResourceTrendAverage("wood"),
      },
      water: world.stockpile.water,
    };

    this.hud.updateHUD(hudSnapshot);
  }

  private updateCitizenControlPanel() {
    if (!this.simulation) return;
    const citizens = this.simulation.getCitizenSystem().getCitizens();
    const selectedId = this.selectedCitizen?.id ?? null;
    this.portraitBar.update(citizens, selectedId);

    // Update panel if it's visible and we have a selected citizen
    if (this.selectedCitizen) {
      this.citizenPanel.update();
    }
  }

  private handleExtinction = () => {
    if (this.extinctionAnnounced) {
      return;
    }
    this.extinctionAnnounced = true;
    this.hud.updateStatus("☠️ The tribe has vanished.");
    this.logEvent("All inhabitants have died. Use 'Download debug' to save the log.");
    this.enableDebugExport();
  };

  private enableDebugExport() {
    if (this.debugExportButton) {
      this.debugExportButton.disabled = false;
    }
  }

  private exportDebugLog = () => {
    const entries = this.hud.getHistoryArchive();
    if (entries.length === 0) {
      this.logEvent("No events recorded to export.");
      return;
    }
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const header = `Debug log - ${now.toLocaleString()} (entries: ${entries.length})\n`;
    const lines = entries.map((entry, index) => `${String(index + 1).padStart(4, "0")} ${entry}`);
    const blob = new Blob([header + lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `guardian-spirit-debug-${timestamp}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    this.logEvent("Debug log exported.");
  };

  private logEvent(message: string, notificationType?: ToastNotification["type"]) {
    // Skip DEBUG messages completely - don't add to history
    if (message.startsWith("[DEBUG]")) {
      return;
    }

    const normalizedMessage = message.toLowerCase();

    this.hud.appendHistory(message);

    if (notificationType) {
      this.hud.showNotification(message, notificationType);
    } else if (normalizedMessage.includes("dead") || normalizedMessage.includes("beast") || normalizedMessage.includes("hostile")) {
      this.hud.showNotification(message, "critical");
    } else if (normalizedMessage.includes("famine") || normalizedMessage.includes("drought") || normalizedMessage.includes("without")) {
      this.hud.showNotification(message, "warning");
    } else if (normalizedMessage.includes("born") || normalizedMessage.includes("blessed") || normalizedMessage.includes("rain")) {
      this.hud.showNotification(message, "success");
    }
  }

  private draw() {
    if (!this.lifecycle.isInitialized() || !this.simulation) return;

    const renderState: RenderState = {
      world: this.simulation.getWorld(),
      citizens: this.simulation.getCitizenSystem().getCitizens(),
      selectedCitizen: this.selectedCitizen,
      hoveredCell: this.hoveredCell,
      notifications: this.hud.getNotifications(),
      projectiles: this.collectProjectileFrames(),
      view: this.camera.getViewMetrics(),
    };

    this.renderer.render(renderState);
  }

  private handleCitizenPanelSelection = (citizenId: number) => {
    if (!this.lifecycle.isInitialized() || !this.simulation) {
      return;
    }
    const citizen = this.simulation.getCitizenSystem().getCitizenById(citizenId) ?? null;
    this.selectedCitizen = citizen;
    if (citizen) {
      this.camera.focusOn({ x: citizen.x + 0.5, y: citizen.y + 0.5 });
    }
    this.updateCitizenControlPanel();
  };

  private showCellTooltip(cellPos: Vec2, event: MouseEvent) {
    if (!this.simulation) return;
    const cell = this.simulation.getWorld().getCell(cellPos.x, cellPos.y);
    if (!cell) return;
    const site = cell.constructionSiteId ? this.simulation.getWorld().getConstructionSite(cell.constructionSiteId) : null;

    const citizensInCell = this.simulation
      .getCitizenSystem()
      .getCitizens()
      .filter((citizen) => citizen.state === "alive" && citizen.x === cellPos.x && citizen.y === cellPos.y);

    this.cellTooltip.show({
      cell,
      citizens: citizensInCell,
      position: { x: event.clientX, y: event.clientY },
      constructionSite: site,
    });
  }

  private setupZoomControls() {
    const hoverAnchor = () => (this.hoveredCell ? { x: this.hoveredCell.x + 0.5, y: this.hoveredCell.y + 0.5 } : null);

    this.zoomInButton?.addEventListener("click", () => {
      if (!this.lifecycle.isInitialized()) {
        return;
      }
      this.camera.adjustZoom(0.2, hoverAnchor());
    });

    this.zoomOutButton?.addEventListener("click", () => {
      if (!this.lifecycle.isInitialized()) {
        return;
      }
      this.camera.adjustZoom(-0.2, hoverAnchor());
    });
  }

  private handleResize = () => {
    const gameWrapper = this.canvas.parentElement;
    if (!gameWrapper) return;

    const wrapperRect = gameWrapper.getBoundingClientRect();
    const isMobile = this.planning.isMobileLayout();
    const padding = isMobile ? 12 : 32;
    const mobileOffset = isMobile ? 96 : 0;
    const availableWidth = Math.max(0, wrapperRect.width - padding);
    const availableHeight = Math.max(0, wrapperRect.height - padding - mobileOffset);

    this.canvas.style.width = `${availableWidth}px`;
    this.canvas.style.height = `${availableHeight}px`;
    this.canvas.width = availableWidth;
    this.canvas.height = availableHeight;

    // Hide tooltip on resize
    this.cellTooltip.hide();
  };

  private handleCitizenSelection(citizenId: number) {
    if (!this.simulation) return;
    const citizen = this.simulation.getCitizenSystem().getCitizens().find((c) => c.id === citizenId);
    if (!citizen) return;

    this.selectedCitizen = citizen;
    this.citizenPanel.show(citizen);
    this.updateCitizenControlPanel();
  }

  private handlePanelClose() {
    this.selectedCitizen = null;
    this.updateCitizenControlPanel();
  }

  destroy() {
    this.cellTooltip.destroy();
    this.planning.destroy();
    this.tokens.destroy();
    this.threats.destroy();
    this.interactions.destroy();
    // Clear other event listeners if necessary
  }

}
