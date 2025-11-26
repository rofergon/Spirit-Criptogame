import type { Citizen } from "../core/types";

type CitizenPortraitBarOptions = {
    onSelectCitizen: (citizenId: number) => void;
    playerTribeId?: number;
};

export class CitizenPortraitBarController {
    private container: HTMLDivElement | null = null;
    private portraits = new Map<number, HTMLDivElement>();

    constructor(private options: CitizenPortraitBarOptions) {
        this.container = document.querySelector<HTMLDivElement>("#citizen-portrait-bar");
        this.container?.addEventListener("click", this.handleClick);
    }

    update(citizens: Citizen[], selectedCitizenId: number | null) {
        if (!this.container) return;

        const playerTribeId = this.options.playerTribeId ?? 1;
        const aliveCitizens = citizens.filter((c) => c.state === "alive" && c.tribeId === playerTribeId);

        if (aliveCitizens.length === 0) {
            this.container.textContent = "No living citizens";
            this.portraits.clear();
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

        const nextIds = new Set<number>();
        const fragment = document.createDocumentFragment();

        sorted.forEach((citizen) => {
            nextIds.add(citizen.id);
            const node = this.portraits.get(citizen.id) ?? this.createPortrait(citizen);
            this.updatePortrait(node, citizen, citizen.id === selectedCitizenId);
            fragment.appendChild(node);
        });

        // Remove stale portraits
        Array.from(this.portraits.keys()).forEach((id) => {
            if (!nextIds.has(id)) {
                this.portraits.delete(id);
            }
        });

        // Reorder without recreating nodes
        this.container.replaceChildren(fragment);
    }

    private createPortrait(citizen: Citizen): HTMLDivElement {
        const portrait = document.createElement("div");
        portrait.className = "citizen-portrait";
        portrait.dataset.citizenId = String(citizen.id);

        const icon = document.createElement("div");
        icon.className = "portrait-icon";
        portrait.appendChild(icon);

        const healthBar = document.createElement("div");
        healthBar.className = "portrait-health-bar";
        const healthFill = document.createElement("div");
        healthFill.className = "health-bar-fill";
        healthBar.appendChild(healthFill);
        portrait.appendChild(healthBar);

        const idLabel = document.createElement("div");
        idLabel.className = "portrait-id";
        portrait.appendChild(idLabel);

        this.portraits.set(citizen.id, portrait);
        return portrait;
    }

    private updatePortrait(portrait: HTMLDivElement, citizen: Citizen, isSelected: boolean) {
        portrait.dataset.citizenId = String(citizen.id);
        const roleIcon = this.getRoleIcon(citizen.role);
        const healthPercent = Math.max(0, Math.min(100, Math.floor(citizen.health)));
        const healthColor = this.getHealthColor(healthPercent);
        const tribeIndicator = citizen.tribeId === 1 ? "player-tribe" : "other-tribe";
        const blessedClass = citizen.blessedUntil && citizen.age < citizen.blessedUntil ? "blessed" : "";

        portrait.className = `citizen-portrait ${tribeIndicator} ${blessedClass} ${isSelected ? "selected" : ""}`.trim();

        const icon = portrait.querySelector<HTMLDivElement>(".portrait-icon");
        if (icon) {
            icon.textContent = roleIcon;
            icon.title = `Aldeano #${citizen.id} - ${this.getRoleLabel(citizen.role)}`;
        }

        const healthFill = portrait.querySelector<HTMLDivElement>(".health-bar-fill");
        if (healthFill) {
            healthFill.style.width = `${healthPercent}%`;
            healthFill.style.backgroundColor = healthColor;
        }

        const idLabel = portrait.querySelector<HTMLDivElement>(".portrait-id");
        if (idLabel) {
            idLabel.textContent = `#${citizen.id}`;
        }
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
            worker: "Worker",
            farmer: "Farmer",
            warrior: "Warrior",
            scout: "Scout",
            child: "Child",
            elder: "Elder",
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
