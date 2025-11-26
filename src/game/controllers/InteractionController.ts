import type { PlanningController } from "./PlanningController";
import type { CameraController } from "../core/CameraController";
import type { Vec2, Citizen } from "../core/types";
import type { SimulationSession } from "../core/SimulationSession";

interface InteractionDependencies {
  canvas: HTMLCanvasElement;
  camera: CameraController;
  planning: PlanningController;
  getSimulation: () => SimulationSession | null;
  onSelectCitizen: (citizen: Citizen | null) => void;
  onUpdateCitizenPanel: () => void;
  onDraw: () => void;
  getHoveredCell: () => Vec2 | null;
  setHoveredCell: (cell: Vec2 | null) => void;
  showCellTooltip: (cell: Vec2, event: MouseEvent) => void;
  hideOverlayTooltip: () => void;
}

export class InteractionController {
  private readonly deps: InteractionDependencies;
  private skipNextCanvasClick = false;
  private skipClickReset: number | null = null;
  private touchStart: { x: number; y: number } | null = null;
  private touchLast: { x: number; y: number } | null = null;
  private touchMoved = false;
  private pinchStartDistance: number | null = null;
  private pinchStartZoom: number | null = null;
  private isTouchPanning = false;
  private isMousePanning = false;
  private hoveredCell: Vec2 | null = null;

  constructor(deps: InteractionDependencies) {
    this.deps = deps;
  }

  bind() {
    const { canvas } = this.deps;
    canvas.addEventListener("click", this.handleCanvasClick);
    canvas.addEventListener("mousemove", this.handleCanvasHover);
    canvas.addEventListener("mousemove", this.handleMouseMove);
    canvas.addEventListener("wheel", this.handleCanvasWheel, { passive: false });
    canvas.addEventListener("mousedown", this.handleMouseDown);
    canvas.addEventListener("mouseleave", this.handleCanvasLeave);
    window.addEventListener("mouseup", this.handleMouseUp);
    canvas.addEventListener("touchstart", this.handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", this.handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", this.handleTouchEnd);
    canvas.addEventListener("touchcancel", this.handleTouchCancel);

    window.addEventListener("scroll", this.hideTooltip);
    window.addEventListener("resize", this.hideTooltip);
  }

  destroy() {
    const { canvas } = this.deps;
    canvas.removeEventListener("click", this.handleCanvasClick);
    canvas.removeEventListener("mousemove", this.handleCanvasHover);
    canvas.removeEventListener("mousemove", this.handleMouseMove);
    canvas.removeEventListener("wheel", this.handleCanvasWheel);
    canvas.removeEventListener("mousedown", this.handleMouseDown);
    canvas.removeEventListener("mouseleave", this.handleCanvasLeave);
    window.removeEventListener("mouseup", this.handleMouseUp);
    canvas.removeEventListener("touchstart", this.handleTouchStart);
    canvas.removeEventListener("touchmove", this.handleTouchMove);
    canvas.removeEventListener("touchend", this.handleTouchEnd);
    canvas.removeEventListener("touchcancel", this.handleTouchCancel);
    window.removeEventListener("scroll", this.hideTooltip);
    window.removeEventListener("resize", this.hideTooltip);
  }

  private handleCanvasClick = (event: MouseEvent) => {
    if (this.consumeSkippedClick()) {
      return;
    }
    const simulation = this.deps.getSimulation();
    if (!simulation) {
      return;
    }
    if (this.deps.planning.isActive()) {
      return;
    }
    const cell = this.deps.camera.getCellUnderPointer(event);
    if (!cell) {
      this.deps.onSelectCitizen(null);
      this.deps.hideOverlayTooltip();
      return;
    }

    const clickedCitizen = simulation
      .getCitizenSystem()
      .getCitizens()
      .find((citizen) => citizen.state === "alive" && citizen.x === cell.x && citizen.y === cell.y);
    this.deps.onSelectCitizen(clickedCitizen || null);
    this.hoveredCell = cell;
    this.deps.setHoveredCell(cell);
    this.deps.showCellTooltip(cell, event);
    this.deps.onUpdateCitizenPanel();
  };

  private handleCanvasHover = (event: MouseEvent) => {
    const simulation = this.deps.getSimulation();
    if (!simulation) {
      return;
    }
    const cell = this.deps.camera.getCellUnderPointer(event);
    this.hoveredCell = cell;
    this.deps.setHoveredCell(cell);
    if (this.deps.planning.isStrokeActive() && this.deps.planning.isActive() && !this.deps.planning.isBuildMode() && cell) {
      this.deps.planning.continueStrokeAt(cell);
    }
  };

  private handleCanvasWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.hideTooltip();
    const delta = event.deltaY < 0 ? 0.2 : -0.2;
    this.deps.camera.adjustZoom(delta);
  };

  private handleMouseDown = (event: MouseEvent) => {
    if (event.button === 0 && this.deps.planning.isActive()) {
      const cell = this.deps.camera.getCellUnderPointer(event);
      if (cell) {
        event.preventDefault();
        this.hideTooltip();
        this.suppressNextCanvasClick();
        this.deps.planning.startStrokeAt(cell);
      }
      return;
    }
    if (event.button === 1) {
      event.preventDefault();
      this.hideTooltip();
      this.deps.camera.startPanning({ x: event.clientX, y: event.clientY });
      this.isMousePanning = true;
    }
  };

  private handleMouseUp = (event: MouseEvent) => {
    if (event.button === 0 && this.deps.planning.isStrokeActive()) {
      const shouldClearPlanning = this.deps.planning.isActive() && !this.deps.planning.isBuildMode();
      this.deps.planning.finishStroke(shouldClearPlanning);
      this.suppressNextCanvasClick();
    }
    if (event.button === 1) {
      this.deps.camera.stopPanning();
      this.isMousePanning = false;
    }
  };

  private handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length === 0) {
      return;
    }
    this.hideTooltip();
    const primary = event.touches[0];
    if (!primary) return;
    this.touchStart = { x: primary.clientX, y: primary.clientY };
    this.touchLast = { x: primary.clientX, y: primary.clientY };
    this.touchMoved = false;
    this.isTouchPanning = false;

    if (event.touches.length === 2) {
      this.pinchStartDistance = this.getPinchDistance(event.touches);
      this.pinchStartZoom = this.deps.camera.getZoom();
    } else if (this.deps.planning.isActive()) {
      event.preventDefault();
      const pos = { x: primary.clientX, y: primary.clientY };
      this.deps.planning.handlePlanningTouch(pos);
    }
  };

  private handleTouchMove = (event: TouchEvent) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      this.handlePinchZoom(event);
      return;
    }
    const primary = event.touches[0];
    if (!primary) return;
    const current = { x: primary.clientX, y: primary.clientY };
    this.touchLast = current;
    const movedEnough = this.touchStart
      ? Math.hypot(current.x - this.touchStart.x, current.y - this.touchStart.y) > 6
      : false;
    this.touchMoved = this.touchMoved || movedEnough;

    if (this.deps.planning.isStrokeActive() && this.deps.planning.isActive() && !this.deps.planning.isBuildMode()) {
      const cell = this.deps.camera.getCellUnderPointer({ clientX: current.x, clientY: current.y } as MouseEvent);
      if (cell) {
        this.hoveredCell = cell;
        this.deps.setHoveredCell(cell);
        this.deps.planning.continueStrokeAt(cell);
      }
      return;
    }

    if (!this.deps.planning.isActive()) {
      if (movedEnough) {
        event.preventDefault();
        if (!this.isTouchPanning) {
          this.deps.camera.startPanning(current);
          this.isTouchPanning = true;
        }
        this.deps.camera.pan(current);
      }
      return;
    }
  };

  private handleTouchEnd = (event: TouchEvent) => {
    if (event.touches.length > 0) {
      return;
    }

    const last = this.touchLast;
    const moved = this.touchMoved;
    this.touchStart = null;
    this.touchLast = null;
    this.touchMoved = false;
    this.pinchStartDistance = null;
    this.pinchStartZoom = null;
    this.deps.camera.stopPanning();
    this.isTouchPanning = false;

    const planningActive = this.deps.planning.isActive();
    const strokeActive = this.deps.planning.isStrokeActive();
    const buildMode = this.deps.planning.isBuildMode();

    if (!last) {
      return;
    }

    if (!moved) {
      const pseudoEvent = { clientX: last.x, clientY: last.y } as MouseEvent;
      if (!planningActive) {
        this.handleCanvasClick(pseudoEvent);
      } else {
        this.deps.planning.finishStroke();
        this.suppressNextCanvasClick();
      }
    } else if (planningActive && strokeActive) {
      this.deps.planning.finishStroke();
      this.suppressNextCanvasClick();
    }

    if (planningActive && !buildMode) {
      this.deps.planning.clearPlanningMode();
    }
  };

  private handleTouchCancel = () => {
    this.touchStart = null;
    this.touchLast = null;
    this.touchMoved = false;
    this.pinchStartDistance = null;
    this.pinchStartZoom = null;
    this.deps.camera.stopPanning();
    this.isTouchPanning = false;
    this.deps.planning.finishStroke();
  };

  private handlePinchZoom(event: TouchEvent) {
    if (event.touches.length !== 2) {
      return;
    }
    const dist = this.getPinchDistance(event.touches);
    if (this.pinchStartDistance === null) {
      this.pinchStartDistance = dist;
      this.pinchStartZoom = this.deps.camera.getZoom();
      return;
    }
    if (!this.pinchStartZoom) {
      this.pinchStartZoom = this.deps.camera.getZoom();
    }
    if (dist <= 0 || this.pinchStartDistance <= 0) {
      return;
    }
    const scale = dist / this.pinchStartDistance;
    const newZoom = this.pinchStartZoom * scale;
    const center = this.getPinchCenter(event.touches);
    const anchor = this.deps.camera.getWorldPosition({ clientX: center.x, clientY: center.y } as MouseEvent);
    this.deps.camera.setZoom(newZoom, anchor ?? undefined);
  }

  private getPinchDistance(touches: TouchList) {
    const a = touches[0];
    const b = touches[1];
    if (!a || !b) return 0;
    return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  }

  private getPinchCenter(touches: TouchList) {
    const a = touches[0];
    const b = touches[1];
    if (!a || !b) return { x: 0, y: 0 };
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  }

  private hideTooltip = () => {
    this.deps.hideOverlayTooltip();
  };

  private suppressNextCanvasClick(delayMs = 400) {
    this.skipNextCanvasClick = true;
    if (this.skipClickReset !== null) {
      window.clearTimeout(this.skipClickReset);
    }
    this.skipClickReset = window.setTimeout(() => {
      this.skipNextCanvasClick = false;
      this.skipClickReset = null;
    }, delayMs);
  }

  private consumeSkippedClick() {
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

  private handleCanvasLeave = (event?: MouseEvent) => {
    this.hideTooltip();
    this.deps.planning.finishStroke();
    if (this.isMousePanning) {
      this.deps.camera.stopPanning();
      this.isMousePanning = false;
    }
  };

  private handleMouseMove = (event: MouseEvent) => {
    if (!this.isMousePanning) {
      return;
    }
    this.deps.camera.pan({ x: event.clientX, y: event.clientY });
  };
}
