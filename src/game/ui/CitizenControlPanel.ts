import type { Citizen } from "../core/types";

export class CitizenControlPanelController {
    private container: HTMLDivElement | null = null;
    private currentCitizen: Citizen | null = null;
    private isVisible = false;
    private lastRenderSignature: string | null = null;

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

        this.container.innerHTML = `
            <div class="panel-header">
                <div class="panel-portrait">
                    <span class="panel-role-icon">${roleIcon}</span>
                </div>
                <div class="panel-info">
                    <div class="panel-name">Aldeano #${c.id} <span class="panel-state">${stateIcon}</span></div>
                    <div class="panel-role">${roleLabel} · ${Math.floor(c.age)} años</div>
                </div>
                <button class="panel-close-btn" title="Cerrar panel">✕</button>
            </div>

            <div class="panel-stats">
                ${this.renderStatBar("Salud", healthPct, "#ef4444", "❤️")}
                ${this.renderStatBar("Hambre", hungerPct, "#f97316", "🍖")}
                ${this.renderStatBar("Energía", energyPct, "#8b5cf6", "⚡")}
                ${this.renderStatBar("Moral", moralePct, "#3b82f6", "😊")}
            </div>

            <div class="panel-inventory">
                <div class="inv-item" title="Comida">
                    <span>🌾</span> ${Math.floor(c.carrying.food)}
                </div>
                <div class="inv-item" title="Piedra">
                    <span>🪨</span> ${Math.floor(c.carrying.stone)}
                </div>
                <div class="inv-item" title="Madera">
                    <span>🌲</span> ${Math.floor(c.carrying.wood)}
                </div>
            </div>

            <div class="panel-action">
                <div class="action-label">Actividad actual:</div>
                <div class="action-text">${this.getActivityText(c)}</div>
            </div>
        `;

        // Re-attach close listener
        this.container.querySelector(".panel-close-btn")?.addEventListener("click", () => this.hide());
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

    private renderStatBar(label: string, value: number, color: string, icon: string): string {
        return `
            <div class="stat-row" title="${label}: ${value}%">
                <span class="stat-icon">${icon}</span>
                <div class="stat-bar-bg">
                    <div class="stat-bar-fill" style="width: ${Math.max(0, Math.min(100, value))}%; background-color: ${color};"></div>
                </div>
            </div>
        `;
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
                    return `Recolectando ${this.translateResource(resource || "")}`;
                } else if (actionDesc.startsWith("tend:")) {
                    return "Cultivando";
                } else if (actionDesc === "store") {
                    return "Almacenando recursos";
                } else if (actionDesc === "rest") {
                    return "Descansando";
                } else if (actionDesc === "idle") {
                    return "Inactivo";
                } else if (actionDesc.startsWith("move:")) {
                    return "En movimiento";
                } else if (actionDesc.startsWith("attack:")) {
                    return "Combatiendo";
                } else if (actionDesc.startsWith("mate:")) {
                    return "Buscando pareja";
                } else if (actionDesc.startsWith("construct:")) {
                    return "Construyendo";
                }
            }
        }

        // Fallback to currentGoal
        if (citizen.currentGoal) {
            if (citizen.currentGoal === "resting") return "Descansando";
            if (citizen.currentGoal === "passive") return "Pasivo";
            return citizen.currentGoal;
        }

        return "Inactivo";
    }

    private translateResource(resource: string): string {
        const translations: Record<string, string> = {
            food: "comida",
            stone: "piedra",
            wood: "madera",
            water: "agua",
        };
        return translations[resource] || resource;
    }

    private getRoleLabel(role: Citizen["role"]): string {
        const labels: Record<Citizen["role"], string> = {
            worker: "Trabajador",
            farmer: "Granjero",
            warrior: "Guerrero",
            scout: "Explorador",
            child: "Niño",
            elder: "Anciano",
        };
        return labels[role] || role;
    }
}
