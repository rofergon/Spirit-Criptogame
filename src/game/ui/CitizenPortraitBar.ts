import type { Citizen } from "../core/types";

type CitizenPortraitBarOptions = {
    onSelectCitizen: (citizenId: number) => void;
};

export class CitizenPortraitBarController {
    private container: HTMLDivElement | null = null;

    constructor(private options: CitizenPortraitBarOptions) {
        this.container = document.querySelector<HTMLDivElement>("#citizen-portrait-bar");
        this.container?.addEventListener("click", this.handleClick);
    }

    update(citizens: Citizen[], selectedCitizenId: number | null) {
        if (!this.container) return;

        const aliveCitizens = citizens.filter((c) => c.state === "alive");

        if (aliveCitizens.length === 0) {
            this.container.innerHTML = `<div class="portrait-bar-empty">No hay aldeanos vivos</div>`;
            return;
        }

        // Sort by tribe (player first), then by role, then by ID
        const sorted = [...aliveCitizens].sort((a, b) => {
            if (a.tribeId !== b.tribeId) {
                return a.tribeId === 1 ? -1 : b.tribeId === 1 ? 1 : a.tribeId - b.tribeId;
            }
            if (a.role !== b.role) {
                const roleOrder = { farmer: 0, worker: 1, warrior: 2, scout: 3, child: 4, elder: 5 };
                return (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
            }
            return a.id - b.id;
        });

        this.container.innerHTML = sorted
            .map((citizen) => this.renderPortrait(citizen, citizen.id === selectedCitizenId))
            .join("");
    }

    private renderPortrait(citizen: Citizen, isSelected: boolean): string {
        const roleIcon = this.getRoleIcon(citizen.role);
        const healthPercent = Math.max(0, Math.min(100, Math.floor(citizen.health)));
        const healthColor = this.getHealthColor(healthPercent);
        const tribeIndicator = citizen.tribeId === 1 ? "player-tribe" : "other-tribe";
        const blessedClass = citizen.blessedUntil && citizen.age < citizen.blessedUntil ? "blessed" : "";
        const selectedClass = isSelected ? "selected" : "";

        return `
      <div class="citizen-portrait ${tribeIndicator} ${blessedClass} ${selectedClass}" data-citizen-id="${citizen.id}">
        <div class="portrait-icon" title="Aldeano #${citizen.id} - ${this.getRoleLabel(citizen.role)}">
          ${roleIcon}
        </div>
        <div class="portrait-health-bar">
          <div class="health-bar-fill" style="width: ${healthPercent}%; background-color: ${healthColor};"></div>
        </div>
        <div class="portrait-id">#${citizen.id}</div>
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
        return icons[role];
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
        return labels[role];
    }

    private getHealthColor(healthPercent: number): string {
        if (healthPercent >= 75) return "#22c55e"; // Green
        if (healthPercent >= 50) return "#eab308"; // Yellow
        if (healthPercent >= 25) return "#f97316"; // Orange
        return "#ef4444"; // Red
    }

    private handleClick = (event: Event) => {
        const target = (event.target as HTMLElement | null)?.closest<HTMLDivElement>("[data-citizen-id]");
        if (!target) return;

        const id = Number.parseInt(target.dataset.citizenId ?? "", 10);
        if (Number.isNaN(id)) return;

        this.options.onSelectCitizen(id);
    };
}
