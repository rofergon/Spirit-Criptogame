import type { SimulationSession } from "../core/SimulationSession";
import type { Role } from "../core/types";
import type { HUDController } from "../ui/HUDController";

type AssignableRole = Extract<Role, "farmer" | "worker" | "warrior" | "scout">;

interface RoleDependencies {
  hud: HUDController;
  getSimulation: () => SimulationSession | null;
  playerTribeId: number;
}

export class RoleController {
  private readonly assignableRoles: AssignableRole[] = ["farmer", "worker", "warrior", "scout"];
  private roleControls: Record<AssignableRole, { input: HTMLInputElement | null; value: HTMLSpanElement | null }> = {
    farmer: { input: null, value: null },
    worker: { input: null, value: null },
    warrior: { input: null, value: null },
    scout: { input: null, value: null },
  };
  private devoteeControl: {
    input: HTMLInputElement | null;
    value: HTMLSpanElement | null;
    slots: HTMLSpanElement | null;
    help: HTMLParagraphElement | null;
  } = {
    input: document.querySelector<HTMLInputElement>("#role-devotee"),
    value: document.querySelector<HTMLSpanElement>("#role-value-devotee"),
    slots: document.querySelector<HTMLSpanElement>("#role-devotee-slots"),
    help: document.querySelector<HTMLParagraphElement>("#role-devotee-help"),
  };
  private readonly devoteeSlotsPerTemple = 3;
  private devoteeTarget = 0;
  private lastAdjustedRole: AssignableRole | null = null;
  private roleTargets: Record<AssignableRole, number> = {
    farmer: 0,
    worker: 0,
    warrior: 0,
    scout: 0,
  };

  constructor(private readonly deps: RoleDependencies) {}

  init() {
    this.setupRoleControls();
    this.refresh(true);
  }

  refresh(force = false) {
    this.updateRoleControls(force);
  }

  private setupRoleControls() {
    this.roleControls = {
      farmer: {
        input: document.querySelector<HTMLInputElement>("#role-farmer"),
        value: document.querySelector<HTMLSpanElement>("#role-value-farmer"),
      },
      worker: {
        input: document.querySelector<HTMLInputElement>("#role-worker"),
        value: document.querySelector<HTMLSpanElement>("#role-value-worker"),
      },
      warrior: {
        input: document.querySelector<HTMLInputElement>("#role-warrior"),
        value: document.querySelector<HTMLSpanElement>("#role-value-warrior"),
      },
      scout: {
        input: document.querySelector<HTMLInputElement>("#role-scout"),
        value: document.querySelector<HTMLSpanElement>("#role-value-scout"),
      },
    };

    for (const role of this.assignableRoles) {
      const control = this.roleControls[role];
      if (control.input) {
        control.input.dataset.role = role;
        control.input.addEventListener("input", this.handleRoleSliderInput);
      }
    }

    this.devoteeControl.input?.addEventListener("input", this.handleDevoteeSliderInput);

    for (const role of this.assignableRoles) {
      const control = this.roleControls[role];
      const initial = Number.parseInt(control.input?.value ?? "0", 10);
      this.roleTargets[role] = Number.isFinite(initial) ? Math.max(0, initial) : 0;
    }
  }

  private handleRoleSliderInput = (event: Event) => {
    const simulation = this.deps.getSimulation();
    if (!simulation) {
      return;
    }
    const role = this.getRoleFromEvent(event);
    if (role) {
      this.lastAdjustedRole = role;
      const targetInput = event.target as HTMLInputElement | null;
      const rawValue = targetInput ? Number.parseInt(targetInput.value ?? "0", 10) : 0;
      this.roleTargets[role] = Number.isFinite(rawValue) ? Math.max(0, rawValue) : 0;
    }
    const assignable = simulation.getCitizenSystem().getAssignablePopulationCount(this.deps.playerTribeId, true);
    const normalized = this.normalizeRoleTargets(this.roleTargets, assignable, this.lastAdjustedRole ?? undefined);
    this.roleTargets = normalized;
    const finalTargets = simulation
      .getCitizenSystem()
      .rebalanceRoles(normalized, this.deps.playerTribeId, this.lastAdjustedRole ?? undefined);
    this.roleTargets = finalTargets;
    this.updateRoleControls(true);
  };

  private getRoleFromEvent(event: Event): AssignableRole | null {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return null;
    }
    const datasetRole = target.dataset.role as AssignableRole | undefined;
    if (datasetRole && this.assignableRoles.includes(datasetRole)) {
      return datasetRole;
    }
    return this.assignableRoles.find((role) => this.roleControls[role].input === target) ?? null;
  }

  private handleDevoteeSliderInput = () => {
    const simulation = this.deps.getSimulation();
    if (!simulation) {
      this.updateDevoteeControl(true);
      return;
    }
    const input = this.devoteeControl.input;
    if (!input) return;

    const requested = Number.parseInt(input.value ?? "0", 10) || 0;
    this.devoteeTarget = Math.max(0, requested);
    const assigned = simulation.getCitizenSystem().setDevoteeTarget(this.devoteeTarget, this.deps.playerTribeId);

    this.updateRoleControls(true);
    this.updateDevoteeControl(true);

    if (input.disabled) {
      this.deps.hud.updateStatus("Build a temple to enable devotees.");
      return;
    }
    const maxSlots = Number.parseInt(input.max ?? "0", 10) || 0;
    this.deps.hud.updateStatus(`Devotees assigned: ${assigned}/${Math.max(maxSlots, this.devoteeTarget)}`);
  };

  private normalizeRoleTargets(
    targets: Record<AssignableRole, number>,
    available: number,
    priorityRole?: AssignableRole | null,
  ): Record<AssignableRole, number> {
    const normalized: Record<AssignableRole, number> = {
      farmer: Math.max(0, Math.floor(targets.farmer ?? 0)),
      worker: Math.max(0, Math.floor(targets.worker ?? 0)),
      warrior: Math.max(0, Math.floor(targets.warrior ?? 0)),
      scout: Math.max(0, Math.floor(targets.scout ?? 0)),
    };

    if (available <= 0) {
      return { farmer: 0, worker: 0, warrior: 0, scout: 0 };
    }

    const totalRequested = Object.values(normalized).reduce((sum, value) => sum + value, 0);
    if (totalRequested <= available) {
      return normalized;
    }

    const finalTargets: Record<AssignableRole, number> = {
      farmer: 0,
      worker: 0,
      warrior: 0,
      scout: 0,
    };

    if (priorityRole && this.assignableRoles.includes(priorityRole)) {
      finalTargets[priorityRole] = Math.min(normalized[priorityRole], available);
      const remainingSlots = Math.max(available - finalTargets[priorityRole], 0);
      const otherRoles = this.assignableRoles.filter((role) => role !== priorityRole);
      const requestedOthers = otherRoles.reduce((sum, role) => sum + normalized[role], 0);

      if (remainingSlots > 0 && requestedOthers > 0) {
        const scale = remainingSlots / requestedOthers;
        let assigned = finalTargets[priorityRole];

        for (const role of otherRoles) {
          finalTargets[role] = Math.floor(normalized[role] * scale);
          assigned += finalTargets[role];
        }

        for (const role of otherRoles) {
          if (assigned >= available) break;
          if (finalTargets[role] < normalized[role]) {
            finalTargets[role] += 1;
            assigned += 1;
          }
        }
      }

      return finalTargets;
    }

    const scale = available / totalRequested;
    let assigned = 0;
    for (const role of this.assignableRoles) {
      finalTargets[role] = Math.floor(normalized[role] * scale);
      assigned += finalTargets[role];
    }

    for (const role of this.assignableRoles) {
      if (assigned >= available) break;
      if (finalTargets[role] < normalized[role]) {
        finalTargets[role] += 1;
        assigned += 1;
      }
    }

    return finalTargets;
  }

  private updateRoleControls(force = false) {
    const simulation = this.deps.getSimulation();
    if (!simulation) {
      return;
    }
    const citizenSystem = simulation.getCitizenSystem();
    const assignable = citizenSystem.getAssignablePopulationCount(this.deps.playerTribeId, true);
    this.roleTargets = this.normalizeRoleTargets(this.roleTargets, assignable, this.lastAdjustedRole);
    for (const role of this.assignableRoles) {
      const control = this.roleControls[role];
      const currentTarget = Number.isFinite(this.roleTargets[role]) ? this.roleTargets[role] : 0;
      const clampedTarget = Math.max(0, Math.min(currentTarget, assignable));
      this.roleTargets[role] = clampedTarget;

      if (control.value) {
        control.value.textContent = clampedTarget.toString();
      }
      if (control.input) {
        control.input.max = Math.max(assignable, 0).toString();
        if (force || document.activeElement !== control.input) {
          control.input.value = clampedTarget.toString();
        }
      }
    }
    this.updateDevoteeControl(force);
  }

  private updateDevoteeControl(force = false) {
    const simulation = this.deps.getSimulation();
    if (!simulation) {
      return;
    }
    const { input, value, slots, help } = this.devoteeControl;
    if (!input) {
      return;
    }
    const world = simulation.getWorld();
    const citizenSystem = simulation.getCitizenSystem();
    const templeCount = typeof world.getStructureCount === "function" ? world.getStructureCount("temple") : 0;
    const maxSlots = Math.max(templeCount * this.devoteeSlotsPerTemple, 0);
    const assignable = citizenSystem.getAssignablePopulationCount(this.deps.playerTribeId);
    const effectiveMax = Math.min(maxSlots, assignable);
    const currentRaw = Number.parseInt(input.value ?? "0", 10);
    const desired = Math.max(0, Math.min(Number.isFinite(currentRaw) ? currentRaw : 0, effectiveMax));
    this.devoteeTarget = desired;

    const assigned = citizenSystem.setDevoteeTarget(desired, this.deps.playerTribeId);

    input.max = maxSlots.toString();
    input.disabled = maxSlots === 0 || assignable === 0;
    const displayValue = input.disabled ? 0 : desired;
    if (input.disabled) {
      input.value = "0";
    } else if (force || displayValue !== currentRaw) {
      input.value = displayValue.toString();
    }

    if (value) {
      value.textContent = input.value;
    }

    if (slots) {
      slots.textContent = `${assigned}/${maxSlots}`;
    }

    if (help) {
      help.textContent =
        maxSlots === 0
          ? "Build a temple to enable devotees."
          : assignable === 0
            ? "No assignable inhabitants available."
            : `Available devotee slots: ${maxSlots}`;
    }
  }
}
