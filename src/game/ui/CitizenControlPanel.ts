import type { Citizen } from "../core/types";

export class CitizenControlPanelController {
    private container: HTMLDivElement | null = null;
    private currentCitizen: Citizen | null = null;
    private isVisible = false;
    private lastRenderSignature: string | null = null;
    private panelBuilt = false;

    private roleIconEl: HTMLSpanElement | null = null;
    private nameLabelEl: HTMLSpanElement | null = null;
    private stateEl: HTMLSpanElement | null = null;
    private roleEl: HTMLDivElement | null = null;
    private statFills: Record<"health" | "hunger" | "energy" | "morale", HTMLDivElement | null> = {
        health: null,
        hunger: null,
        energy: null,
        morale: null,
    };
    private invFoodEl: HTMLSpanElement | null = null;
    private invStoneEl: HTMLSpanElement | null = null;
    private invWoodEl: HTMLSpanElement | null = null;
    private actionTextEl: HTMLDivElement | null = null;

    constructor(private options?: { onClose?: () => void }) {
        this.container = document.querySelector<HTMLDivElement>("#citizen-control-panel");
    }

    show(citizen: Citizen) {
        this.currentCitizen = citizen;
        this.isVisible = true;
        if (this.container) {
            this.container.classList.remove("hidden");
            this.render();
        }
    }

    hide() {
        this.isVisible = false;
        this.currentCitizen = null;
        this.lastRenderSignature = null;
        if (this.container) {
            this.container.classList.add("hidden");
        }
        this.options?.onClose?.();
    }

    update() {
        if (this.isVisible && this.currentCitizen) {
            this.render();
        }
    }

    private render() {
        if (!this.container || !this.currentCitizen) return;
        this.buildPanel();

        const signature = this.getCitizenSignature(this.currentCitizen);
        if (signature === this.lastRenderSignature) return;
        this.lastRenderSignature = signature;

        const c = this.currentCitizen;
        const roleIcon = this.getRoleIcon(c.role);
        const roleLabel = this.getRoleLabel(c.role);
        const stateIcon = c.state === "dead" ? "☠️" : "🟢";

        // Calculate percentages
        const healthPct = Math.floor(c.health);
        const hungerPct = Math.floor(100 - c.hunger);
        const energyPct = Math.floor(100 - c.fatigue);
        const moralePct = Math.floor(c.morale);

        if (this.roleIconEl) this.roleIconEl.textContent = roleIcon;
        if (this.nameLabelEl) this.nameLabelEl.textContent = `Villager #${c.id} `;
        if (this.stateEl) this.stateEl.textContent = stateIcon;
        if (this.roleEl) this.roleEl.textContent = `${roleLabel} · ${Math.floor(c.age)} years`;

        this.updateStatBar(this.statFills.health, healthPct, "#e53935");
        this.updateStatBar(this.statFills.hunger, hungerPct, "#fb8c00");
        this.updateStatBar(this.statFills.energy, energyPct, "#fdd835");
        this.updateStatBar(this.statFills.morale, moralePct, "#43a047");

        if (this.invFoodEl) this.invFoodEl.textContent = `${Math.floor(c.carrying.food)}`;
        if (this.invStoneEl) this.invStoneEl.textContent = `${Math.floor(c.carrying.stone)}`;
        if (this.invWoodEl) this.invWoodEl.textContent = `${Math.floor(c.carrying.wood)}`;

        if (this.actionTextEl) this.actionTextEl.textContent = this.getActivityText(c);
    }

    private getCitizenSignature(c: Citizen): string {
        return [
            c.id,
            c.state,
            c.role,
            Math.floor(c.age),
            Math.floor(c.health),
            Math.floor(100 - c.hunger),
            Math.floor(100 - c.fatigue),
            Math.floor(c.morale),
            Math.floor(c.carrying.food),
            Math.floor(c.carrying.stone),
            Math.floor(c.carrying.wood),
            c.currentGoal ?? "",
            c.debugLastAction ?? "",
        ].join("|");
    }

    private updateStatBar(fillEl: HTMLDivElement | null, value: number, color: string) {
        if (!fillEl) return;
        const clamped = Math.max(0, Math.min(100, value));
        fillEl.style.width = `${clamped}%`;
        fillEl.style.backgroundColor = color;
        fillEl.parentElement?.parentElement?.setAttribute("title", `${clamped}%`);
    }

    private buildPanel() {
        if (!this.container || this.panelBuilt) return;
        this.container.innerHTML = "";

        const header = document.createElement("div");
        header.className = "panel-header";

        const portrait = document.createElement("div");
        portrait.className = "panel-portrait";
        this.roleIconEl = document.createElement("span");
        this.roleIconEl.className = "panel-role-icon";
        portrait.appendChild(this.roleIconEl);

        const info = document.createElement("div");
        info.className = "panel-info";
        const name = document.createElement("div");
        name.className = "panel-name";
        this.nameLabelEl = document.createElement("span");
        this.stateEl = document.createElement("span");
        this.stateEl.className = "panel-state";
        name.appendChild(this.nameLabelEl);
        name.appendChild(this.stateEl);
        this.roleEl = document.createElement("div");
        this.roleEl.className = "panel-role";
        info.appendChild(name);
        info.appendChild(this.roleEl);

        const closeBtn = document.createElement("button");
        closeBtn.className = "panel-close-btn";
        closeBtn.title = "Close panel";
        closeBtn.textContent = "✕";
        closeBtn.addEventListener("click", () => this.hide());

        header.appendChild(portrait);
        header.appendChild(info);
        header.appendChild(closeBtn);

        const stats = document.createElement("div");
        stats.className = "panel-stats";

        const makeStat = (label: string, icon: string, key: keyof CitizenControlPanelController["statFills"]) => {
            const row = document.createElement("div");
            row.className = "stat-row";
            const iconEl = document.createElement("span");
            iconEl.className = "stat-icon";
            iconEl.textContent = icon;
            const bg = document.createElement("div");
            bg.className = "stat-bar-bg";
            const fill = document.createElement("div");
            fill.className = "stat-bar-fill";
            bg.appendChild(fill);
            row.appendChild(iconEl);
            row.appendChild(bg);
            row.setAttribute("title", `${label}: 0%`);
            stats.appendChild(row);
            this.statFills[key] = fill;
        };

        makeStat("Health", "❤️", "health");
        makeStat("Hunger", "🍖", "hunger");
        makeStat("Energy", "⚡", "energy");
        makeStat("Morale", "😊", "morale");

        const inventory = document.createElement("div");
        inventory.className = "panel-inventory";

        const makeInv = (title: string, icon: string, setter: (el: HTMLSpanElement) => void) => {
            const item = document.createElement("div");
            item.className = "inv-item";
            item.title = title;
            const iconSpan = document.createElement("span");
            iconSpan.textContent = icon;
            const valueSpan = document.createElement("span");
            valueSpan.className = "inv-value";
            item.appendChild(iconSpan);
            item.appendChild(valueSpan);
            inventory.appendChild(item);
            setter(valueSpan);
        };

        makeInv("Food", "🌾", (el) => (this.invFoodEl = el));
        makeInv("Stone", "🪨", (el) => (this.invStoneEl = el));
        makeInv("Wood", "🌲", (el) => (this.invWoodEl = el));

        const action = document.createElement("div");
        action.className = "panel-action";
        const actionLabel = document.createElement("div");
        actionLabel.className = "action-label";
        actionLabel.textContent = "Current activity:";
        this.actionTextEl = document.createElement("div");
        this.actionTextEl.className = "action-text";
        action.appendChild(actionLabel);
        action.appendChild(this.actionTextEl);

        this.container.appendChild(header);
        this.container.appendChild(stats);
        this.container.appendChild(inventory);
        this.container.appendChild(action);
        this.panelBuilt = true;
    }

    private getRoleIcon(role: Citizen["role"]): string {
        const icons: Record<Citizen["role"], string> = {
            worker: "🔨",
            farmer: "👨‍🌾",
            warrior: "⚔️",
            scout: "🔍",
            child: "👶",
            elder: "👴",
        };
        return icons[role] || "❓";
    }

    private getActivityText(citizen: Citizen): string {
        // Try to get activity from debugLastAction first
        if (citizen.debugLastAction) {
            const parts = citizen.debugLastAction.split("|");
            if (parts.length >= 2 && parts[1]) {
                const actionDesc = parts[1]; // The action signature part

                // Parse common action signatures to friendly text
                if (actionDesc.startsWith("gather:")) {
                    const resource = actionDesc.split(":")[1];
                    return `Gathering ${this.translateResource(resource || "")}`;
                } else if (actionDesc.startsWith("tend:")) {
                    return "Tending crops";
                } else if (actionDesc === "store") {
                    return "Storing resources";
                } else if (actionDesc === "rest") {
                    return "Resting";
                } else if (actionDesc === "idle") {
                    return "Idle";
                } else if (actionDesc.startsWith("move:")) {
                    return "Moving";
                } else if (actionDesc.startsWith("attack:")) {
                    return "Fighting";
                } else if (actionDesc.startsWith("mate:")) {
                    return "Looking for mate";
                } else if (actionDesc.startsWith("construct:")) {
                    return "Constructing";
                }
            }
        }

        // Fallback to currentGoal
        if (citizen.currentGoal) {
            if (citizen.currentGoal === "resting") return "Resting";
            if (citizen.currentGoal === "passive") return "Passive";
            return citizen.currentGoal;
        }

        return "Idle";
    }

    private translateResource(resource: string): string {
        const translations: Record<string, string> = {
            food: "food",
            stone: "stone",
            wood: "wood",
            water: "water",
        };
        return translations[resource] || resource;
    }

    private getRoleLabel(role: Citizen["role"]): string {
        const labels: Record<Citizen["role"], string> = {
            worker: "Worker",
            farmer: "Farmer",
            warrior: "Warrior",
            scout: "Scout",
            child: "Child",
            elder: "Elder",
        };
        return labels[role] || role;
    }
}
