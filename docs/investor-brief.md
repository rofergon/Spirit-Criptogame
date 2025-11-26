![Theron: Legends of the Hex Lands cover](../.github/cover.png)

Theron: Legends of the Hex Lands — Investor Brief
=================================================

Overview
--------
- Genre: hex-based tribal survival/city-builder with autonomous villagers and procedural worlds.
- Hook: “Paint priorities, assign roles, and watch villagers execute.” Camera/HUD-driven loop with live notifications and zoom/speed control.
- Tech: TypeScript + Vite; custom world engine and AI systems; OneChain + OneWallet blockchain integration for token flow and NFTs.

Core Gameplay & Systems
-----------------------
- World engine (`src/game/core/world/WorldEngine.ts`): procedural terrain, visibility fog, climate effects, resource growth/decay, construction placement and stockpile capacities that scale with buildings.
- Citizen simulation (`src/game/systems/CitizenSystem.ts`): individual needs (hunger/morale/health), role AI (farmer/worker/warrior/scout), task arbitration, migrants/raiders/beasts, devotee assignment for Faith generation, and lifecycle pruning for dead citizens.
- Game orchestration (`src/game/game.ts`): unifies rendering, HUD, camera, planning modes (farm/mine/gather/build/explore), speed control, notifications, projectile visuals, and event handling (travelers, threats, extinction).
- UX: HUD, portrait bar, tooltips, build planner, and responsive controls; landing page marketing copy and art already present (`public/landing/index.html`).

Blockchain Integration
----------------------
- OneChain + OneWallet via Wallet Standard: connect, sign, and poll balances in-game (`src/game/controllers/TokenController.ts`).
- Faith → HEX on-chain conversion: modal flow, balance polling, status messaging, and HUD updates; transactions surfaced to the player with success/failure notifications.
- Store/NFT narrative: premium lands and starter chests referenced in README/landing, aligned with THERON premium token.

Tokenomics (Two-Token Model)
----------------------------
- Faith (in-game): soft resource earned by assigning devotees to temples; convertible.
- HEX (utility/on-chain): minted by burning Faith at a fixed rate (e.g., 100 Faith → 1 HEX). Uses: upgrades/boosts; acts as a sink.
- THERON (premium/on-chain): purchased with OCT or minted by burning large amounts of HEX (high fixed rate). Uses: lands, chests, premium items/NFTs.
- Flow summary: Faith (gameplay faucet) → HEX (utility, on-chain, sinks via upgrades) → THERON (premium, OCT on-ramp, HEX burn path). Clear sinks and dual on-ramps (earnable + purchasable).
- Classic investor levers: treasury allocation with multi-sig control; emissions schedule with halving cadence; staking/yield for HEX with lockups and slashing for security; liquidity provisioning program (HEX/OCT, THERON/OCT) with protocol-owned liquidity targets; buyback-and-burn policy tied to in-game revenue; vesting cliffs for team/partners; governance gating for THERON holders on feature unlocks and treasury spend; third-party audits on contracts + on-chain monitoring.

Market Position & Next Steps
----------------------------
- Differentiation: living autonomous villagers plus procedural worlds; clear on-chain utility loop (Faith → HEX → THERON) rather than cosmetic-only NFTs.
- Recommended milestones: ship telemetry for retention/ARPU modeling; finalize faucet/sink ratios per stage; prepare contract/wallet security audit; run load tests on conversion flows and store; expand landing with ROI/roadmap metrics for investor decks.
