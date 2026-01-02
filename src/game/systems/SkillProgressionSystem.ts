import type { Citizen, SkillType } from "../core/types";
import { SKILL_CONFIG } from "../core/skillConstants";
import { clamp } from "../core/utils";

/**
 * Manages skill progression for citizens.
 * Skills improve through use and provide bonuses to related actions.
 */
export class SkillProgressionSystem {
    /**
     * Grant XP to a citizen for a specific skill.
     * @param citizen - The citizen gaining XP
     * @param skill - The skill type being improved
     * @param multiplier - Optional multiplier for XP gain (default 1)
     */
    gainXP(citizen: Citizen, skill: SkillType, multiplier = 1): void {
        if (citizen.state !== "alive") return;

        const xpGain = SKILL_CONFIG.XP_PER_ACTION[skill] * multiplier;
        citizen.skills[skill] = clamp(
            citizen.skills[skill] + xpGain,
            SKILL_CONFIG.MIN_SKILL,
            SKILL_CONFIG.MAX_SKILL
        );
    }

    /**
     * Grant XP for gathering resources.
     * @param citizen - The citizen gathering
     * @param resourceType - Type of resource being gathered
     */
    gainGatheringXP(citizen: Citizen, resourceType: "food" | "stone" | "wood"): void {
        if (resourceType === "stone") {
            this.gainXP(citizen, "mining");
        } else {
            this.gainXP(citizen, "foraging");
        }
    }

    /**
     * Grant XP for farming activities.
     * @param citizen - The citizen farming
     */
    gainFarmingXP(citizen: Citizen): void {
        this.gainXP(citizen, "farming");
    }

    /**
     * Grant XP for combat.
     * @param citizen - The citizen in combat
     */
    gainCombatXP(citizen: Citizen): void {
        this.gainXP(citizen, "combat");
    }

    /**
     * Grant XP for construction work.
     * @param citizen - The citizen constructing
     */
    gainConstructionXP(citizen: Citizen): void {
        this.gainXP(citizen, "construction");
    }
}

// Singleton instance for easy access
let skillSystemInstance: SkillProgressionSystem | null = null;

export function getSkillProgressionSystem(): SkillProgressionSystem {
    if (!skillSystemInstance) {
        skillSystemInstance = new SkillProgressionSystem();
    }
    return skillSystemInstance;
}
