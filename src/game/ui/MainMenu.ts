import type { Terrain } from "../core/types";
import { WorldEngine } from "../core/world/WorldEngine";
import { createHexGeometry, getHexCenter, getHexWorldBounds, traceHexPath } from "./hexGrid";

export interface WorldGenerationConfig {
  seed: number;
  worldSize: number;
  difficulty: "easy" | "normal" | "hard";
  startingCitizens: number;
}

type MenuButtonKey =
  | "start"
  | "seedInput"
  | "randomSeed"
  | "sizeSmall"
  | "sizeNormal"
  | "sizeLarge"
  | "difficultyEasy"
  | "difficultyNormal"
  | "difficultyHard";

type ButtonRegion = { x: number; y: number; width: number; height: number };

export class MainMenu {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isVisible: boolean = true;

  // Configurable options
  private config: WorldGenerationConfig = {
    seed: Math.floor(Math.random() * 1000000),
    worldSize: 36,
    difficulty: "normal",
    startingCitizens: 5
  };

  private hoveredButton: MenuButtonKey | null = null;
  private focusedInput: string | null = null;
  private seedInputValue: string = "";
  private previewWorld: WorldEngine | null = null;
  private previewDirty = true;
  private lastPreviewUpdate = 0;
  private readonly previewThrottleMs = 220;
  private buttonRegions: Partial<Record<MenuButtonKey, ButtonRegion>> = {};
  private useMobileLayout: boolean;
  private readonly onStartCallback?: (config: WorldGenerationConfig) => void;
  private keyListenerAttached = false;
  private logoImage: HTMLImageElement | null = null;
  private goldChestImage: HTMLImageElement | null = null;
  private silverChestImage: HTMLImageElement | null = null;
  private copperChestImage: HTMLImageElement | null = null;

  // Animation and visual effects
  private particles: Array<{ x: number, y: number, vx: number, vy: number, life: number, maxLife: number, size: number, opacity: number }> = [];
  private animationFrame: number = 0;
  private menuOpenTime: number = 0;
  private lastAnimationTime: number = 0;
  private keydownHandler = (e: KeyboardEvent) => {
    if (!this.isVisible) return;
    if (this.focusedInput === "seed") {
      if (e.key === "Backspace") {
        this.seedInputValue = this.seedInputValue.slice(0, -1);
      } else if (e.key === "Enter") {
        this.focusedInput = null;
        this.applySeedInput();
      } else if (e.key >= "0" && e.key <= "9" && this.seedInputValue.length < 10) {
        this.seedInputValue += e.key;
      } else if (e.key === "-" && this.seedInputValue.length === 0) {
        this.seedInputValue = "-";
      }
    }
  };

  constructor(canvas: HTMLCanvasElement, options?: { isMobile?: boolean; onStart?: (config: WorldGenerationConfig) => void }) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D context");
    this.ctx = ctx;
    this.seedInputValue = this.config.seed.toString();
    this.useMobileLayout = options?.isMobile ?? false;
    this.onStartCallback = options?.onStart;

    this.menuOpenTime = performance.now();
    this.lastAnimationTime = this.menuOpenTime;
    this.initParticles();
    this.loadLogo();

    this.setupEventListeners();
    this.requestPreviewUpdate();
  }

  private setupEventListeners() {
    this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
    this.canvas.addEventListener("click", (e) => this.handleClick(e));

    // Capture keyboard input for seed input while menu is visible
    this.attachKeyListener();
  }

  private loadLogo() {
    this.logoImage = new Image();
    this.logoImage.src = "/assets/Landing/Theron_game_logo.png";

    // Load chest images for difficulty options
    this.goldChestImage = new Image();
    this.goldChestImage.src = "/assets/Chest/Gold_chest.png";

    this.silverChestImage = new Image();
    this.silverChestImage.src = "/assets/Chest/Silver_chest.png";

    this.copperChestImage = new Image();
    this.copperChestImage.src = "/assets/Chest/Copper_Chest.png";
  }

  private initParticles() {
    const particleCount = this.useMobileLayout ? 20 : 40;
    this.particles = [];

    for (let i = 0; i < particleCount; i++) {
      this.particles.push(this.createParticle());
    }
  }

  private createParticle() {
    const maxLife = 3000 + Math.random() * 4000;
    return {
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.2 - Math.random() * 0.5, // Float upward
      life: Math.random() * maxLife,
      maxLife,
      size: 1 + Math.random() * 2,
      opacity: 0.3 + Math.random() * 0.4
    };
  }

  private updateParticles(deltaTime: number) {
    this.particles.forEach(particle => {
      particle.x += particle.vx * deltaTime * 0.06;
      particle.y += particle.vy * deltaTime * 0.06;
      particle.life += deltaTime;

      // Reset particle if it goes off screen or dies
      if (particle.life > particle.maxLife || particle.y < -10 || particle.x < -10 || particle.x > this.canvas.width + 10) {
        const newParticle = this.createParticle();
        newParticle.y = this.canvas.height + 10; // Start from bottom
        Object.assign(particle, newParticle);
        particle.life = 0;
      }
    });
  }

  private renderParticles() {
    const ctx = this.ctx;

    this.particles.forEach(particle => {
      const lifeFactor = particle.life / particle.maxLife;
      const fadeIn = Math.min(1, lifeFactor * 4);
      const fadeOut = Math.max(0, 1 - (lifeFactor - 0.7) / 0.3);
      const alpha = particle.opacity * fadeIn * fadeOut;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Create glow effect
      const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.size * 3);
      gradient.addColorStop(0, "#ff6b35");
      gradient.addColorStop(0.5, "#6ee7ff");
      gradient.addColorStop(1, "rgba(110, 231, 255, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * 3, 0, Math.PI * 2);
      ctx.fill();

      // Core particle
      ctx.fillStyle = "#eaf0ff";
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }

  private attachKeyListener() {
    if (this.keyListenerAttached) return;
    window.addEventListener("keydown", this.keydownHandler);
    this.keyListenerAttached = true;
  }

  private detachKeyListener() {
    if (!this.keyListenerAttached) return;
    window.removeEventListener("keydown", this.keydownHandler);
    this.keyListenerAttached = false;
  }

  private applySeedInput() {
    const parsed = parseInt(this.seedInputValue) || Math.floor(Math.random() * 1000000);
    this.config.seed = parsed;
    this.seedInputValue = parsed.toString();
    this.requestPreviewUpdate();
  }

  private handleMouseMove(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.hoveredButton = this.getButtonAt(x, y);
    this.canvas.style.cursor = this.hoveredButton ? "pointer" : "default";
  }

  private handleClick(e: MouseEvent) {
    if (!this.isVisible) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const button = this.getButtonAt(x, y);

    switch (button) {
      case "start":
        this.isVisible = false;
        this.detachKeyListener();
        this.onStartCallback?.({ ...this.config });
        break;

      case "randomSeed":
        this.config.seed = Math.floor(Math.random() * 1000000);
        this.seedInputValue = this.config.seed.toString();
        this.focusedInput = null;
        this.requestPreviewUpdate();
        break;

      case "seedInput":
        this.focusedInput = "seed";
        break;

      case "sizeSmall":
        this.config.worldSize = 24;
        this.requestPreviewUpdate();
        break;

      case "sizeNormal":
        this.config.worldSize = 36;
        this.requestPreviewUpdate();
        break;

      case "sizeLarge":
        this.config.worldSize = 48;
        this.requestPreviewUpdate();
        break;

      case "difficultyEasy":
        this.config.difficulty = "easy";
        this.config.startingCitizens = 8;
        break;

      case "difficultyNormal":
        this.config.difficulty = "normal";
        this.config.startingCitizens = 5;
        break;

      case "difficultyHard":
        this.config.difficulty = "hard";
        this.config.startingCitizens = 3;
        break;
    }
  }

  private getButtonAt(x: number, y: number): MenuButtonKey | null {
    for (const [key, region] of Object.entries(this.buttonRegions) as Array<[MenuButtonKey, ButtonRegion]>) {
      if (!region) continue;
      if (x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height) {
        return key;
      }
    }
    return null;
  }

  private setButtonRegion(key: MenuButtonKey, x: number, y: number, width: number, height: number) {
    this.buttonRegions[key] = { x, y, width, height };
  }

  private clearButtonRegions() {
    this.buttonRegions = {};
  }

  render() {
    if (!this.isVisible) return;

    // Update animation frame and particles
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastAnimationTime;
    this.lastAnimationTime = currentTime;
    this.animationFrame++;
    this.updateParticles(deltaTime);

    this.clearButtonRegions();

    const ctx = this.ctx;
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    // Animated gradient background
    this.renderBackground();

    // Render particles
    this.renderParticles();

    // Main layout
    const layout = this.calculateLayout(canvasWidth, canvasHeight);

    // World preview (full background)
    this.renderWorldPreview(layout.preview.x, layout.preview.y, layout.preview.width, layout.preview.height);

    // Title
    this.renderTitle(layout.centerX);

    // Configuration panel (overlaid on map)
    this.renderConfigPanel(layout.configPanel);

    // Info panel (desktop only or very minimalist on mobile)
    if (!this.useMobileLayout) {
      this.renderInfoPanel(layout.infoPanel);
    }

    // Start button
    this.renderStartButton(layout.startButton);

    // Footer
    if (!this.useMobileLayout) {
      this.renderFooter(layout.centerX, canvasHeight);
    }
  }

  private calculateLayout(canvasWidth: number, canvasHeight: number) {
    const centerX = canvasWidth / 2;
    const margin = this.useMobileLayout ? 12 : 40;

    if (this.useMobileLayout) {
      const available = canvasHeight - margin * 2;
      const gap = 12;

      // Fixed heights for mobile components (reduced)
      const titleHeight = 35;
      const configPanelHeight = 180;
      const startButtonHeight = 48;

      // Preview takes remaining space, but with a minimum
      let previewHeight = available - titleHeight - configPanelHeight - startButtonHeight - gap * 3;
      previewHeight = Math.max(60, previewHeight);

      const contentWidth = canvasWidth - margin * 2;

      // Positions
      const previewY = margin + titleHeight + gap;
      const configPanelY = previewY + previewHeight + gap;
      const startButtonY = configPanelY + configPanelHeight + gap;

      // Check for overflow
      const totalHeight = startButtonY + startButtonHeight + margin;
      if (totalHeight > canvasHeight) {
        const overflow = totalHeight - canvasHeight;
        previewHeight = Math.max(0, previewHeight - overflow);

        const newConfigPanelY = previewY + previewHeight + gap;
        const newStartButtonY = newConfigPanelY + configPanelHeight + gap;

        return {
          centerX,
          useColumns: false,
          preview: { x: margin, y: previewY, width: contentWidth, height: previewHeight },
          infoPanel: { x: 0, y: 0, width: 0, height: 0 },
          startButton: { x: margin, y: newStartButtonY, width: contentWidth, height: startButtonHeight },
          configPanel: { x: margin, y: newConfigPanelY, width: contentWidth, height: configPanelHeight }
        };
      }

      return {
        centerX,
        useColumns: false,
        preview: { x: margin, y: previewY, width: contentWidth, height: previewHeight },
        infoPanel: { x: 0, y: 0, width: 0, height: 0 }, // Hidden on mobile
        startButton: { x: margin, y: startButtonY, width: contentWidth, height: startButtonHeight },
        configPanel: { x: margin, y: configPanelY, width: contentWidth, height: configPanelHeight }
      };
    }

    const previewMargin = 100;
    const previewWidth = canvasWidth - previewMargin * 2;
    const previewHeight = canvasHeight - previewMargin * 2;
    const previewX = previewMargin;
    const previewY = previewMargin;

    const headerHeight = 160;
    const configPanelHeight = 310;
    const configPanelWidth = Math.min(500, canvasWidth - margin * 2);
    const configPanelX = centerX - configPanelWidth / 2;
    const configPanelY = headerHeight;

    const infoPanelHeight = 85;
    const infoPanelWidth = Math.min(500, canvasWidth - margin * 2);
    const infoPanelX = centerX - infoPanelWidth / 2;
    const infoPanelY = configPanelY + configPanelHeight + 15;

    const startButtonHeight = 56;
    const startButtonWidth = 360;
    const startButtonX = centerX - startButtonWidth / 2;
    const startButtonY = infoPanelY + infoPanelHeight + 15;

    return {
      centerX,
      useColumns: false,
      preview: { x: previewX, y: previewY, width: previewWidth, height: previewHeight },
      infoPanel: { x: infoPanelX, y: infoPanelY, width: infoPanelWidth, height: infoPanelHeight },
      startButton: {
        x: startButtonX,
        y: startButtonY,
        width: startButtonWidth,
        height: startButtonHeight
      },
      configPanel: { x: configPanelX, y: configPanelY, width: configPanelWidth, height: configPanelHeight }
    };
  }

  private renderBackground() {
    const ctx = this.ctx;

    // Animated gradient background
    const time = (performance.now() - this.menuOpenTime) * 0.0003;
    const offset = Math.sin(time) * 20;

    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, `rgb(${11 + offset * 0.2}, ${15 + offset * 0.15}, ${22 + offset * 0.1})`);
    gradient.addColorStop(0.5, "#0b0f16");
    gradient.addColorStop(1, `rgb(${24 + offset * 0.15}, ${33 + offset * 0.1}, ${50 + offset * 0.1})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Vignette effect
    const vignetteGradient = ctx.createRadialGradient(
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.canvas.height * 0.3,
      this.canvas.width / 2,
      this.canvas.height / 2,
      this.canvas.height * 0.9
    );
    vignetteGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignetteGradient.addColorStop(1, "rgba(0, 0, 0, 0.3)");

    ctx.fillStyle = vignetteGradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private renderTitle(centerX: number) {
    const ctx = this.ctx;
    const logoWidth = this.useMobileLayout ? 120 : 200;
    const subtitleSize = this.useMobileLayout ? 11 : 16;
    const yPos = this.useMobileLayout ? 28 : 70;

    // Animated glow effect
    const glowIntensity = 0.3 + Math.sin((performance.now() - this.menuOpenTime) * 0.002) * 0.2;

    // Logo with glow - maintain aspect ratio
    if (this.logoImage && this.logoImage.complete) {
      ctx.save();
      ctx.shadowColor = `rgba(255, 107, 53, ${glowIntensity})`;
      ctx.shadowBlur = 30;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Calculate height to maintain aspect ratio
      const aspectRatio = this.logoImage.width / this.logoImage.height;
      const logoHeight = logoWidth / aspectRatio;

      const logoX = centerX - logoWidth / 2;
      const logoY = yPos - logoHeight / 2;
      ctx.drawImage(this.logoImage, logoX, logoY, logoWidth, logoHeight);
      ctx.restore();
    }

    if (!this.useMobileLayout) {
      // Fade in subtitle
      const fadeInProgress = Math.min(1, (performance.now() - this.menuOpenTime) / 1000);
      ctx.save();
      ctx.globalAlpha = fadeInProgress;
      ctx.font = `${subtitleSize}px "Space Grotesk", Arial`;
      ctx.fillStyle = "#9fb2d7";
      ctx.textAlign = "center";
      ctx.fillText("Configure your civilization before starting", centerX, yPos + 50);
      ctx.restore();
    }
  }

  private renderInfoPanel(bounds: { x: number; y: number; width: number; height: number }) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(12, 17, 25, 0.82)";
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

    ctx.fillStyle = "#6ee7ff";
    ctx.font = "bold 13px 'Space Grotesk', Arial";
    ctx.textAlign = "left";
    ctx.fillText("Information:", bounds.x + 16, bounds.y + 22);

    ctx.fillStyle = "#9fb2d7";
    ctx.font = "12px 'Space Grotesk', Arial";
    const tips = [
      "• Same seed generates the same world",
      "• Larger worlds = more exploration",
      "• You can copy the seed to share"
    ];

    tips.forEach((tip, i) => {
      ctx.fillText(tip, bounds.x + 16, bounds.y + 44 + i * 18);
    });
  }

  private renderStartButton(bounds: { x: number; y: number; width: number; height: number }) {
    const ctx = this.ctx;
    this.setButtonRegion("start", bounds.x, bounds.y, bounds.width, bounds.height);

    const isHovered = this.hoveredButton === "start";

    // Pulsing glow animation
    const pulseIntensity = 0.2 + Math.sin((performance.now() - this.menuOpenTime) * 0.003) * 0.15;

    // Button gradient
    const gradient = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x, bounds.y + bounds.height);
    if (isHovered) {
      gradient.addColorStop(0, "#ff8455");
      gradient.addColorStop(1, "#ff6b35");
    } else {
      gradient.addColorStop(0, "#ff6b35");
      gradient.addColorStop(1, "#d84315");
    }

    // Enhanced shadow with pulse
    ctx.save();
    ctx.shadowColor = `rgba(255, 107, 53, ${isHovered ? 0.6 : pulseIntensity + 0.2})`;
    ctx.shadowBlur = isHovered ? 30 : 20;
    ctx.shadowOffsetY = 5;

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 16);
    ctx.fill();

    ctx.shadowColor = "transparent"; // Reset shadow

    ctx.strokeStyle = isHovered ? "#ff8a65" : "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Button text with scale effect on hover
    ctx.save();
    if (isHovered) {
      const scale = 1.05;
      ctx.translate(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      ctx.scale(scale, scale);
      ctx.translate(-(bounds.x + bounds.width / 2), -(bounds.y + bounds.height / 2));
    }

    ctx.fillStyle = "#eaf0ff";
    ctx.font = "bold 20px 'Space Grotesk', Arial";
    ctx.textAlign = "center";
    ctx.fillText("⚡ START", bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 + 7);
    ctx.restore();
  }

  private renderConfigPanel(bounds: { x: number; y: number; width: number; height: number }) {
    const ctx = this.ctx;

    // Enhanced shadow for depth
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 10;

    // Panel background
    ctx.fillStyle = "rgba(12, 17, 25, 0.95)";
    ctx.beginPath();
    ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 16);
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.restore();

    // Subtle border glow
    const borderGlow = 0.3 + Math.sin((performance.now() - this.menuOpenTime) * 0.002) * 0.1;
    ctx.strokeStyle = `rgba(255, 255, 255, ${borderGlow * 0.3 + 0.1})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    const padding = this.useMobileLayout ? 12 : 24;
    let currentY = bounds.y + padding + 6;
    const contentX = bounds.x + padding;
    const contentWidth = bounds.width - padding * 2;

    // Section: Seed
    currentY = this.renderSeedSection(contentX, currentY, contentWidth);
    currentY += this.useMobileLayout ? 14 : 25;

    // Section: World size
    currentY = this.renderWorldSizeSection(contentX, currentY, bounds.x + bounds.width / 2);
    currentY += this.useMobileLayout ? 14 : 35;

    // Section: Difficulty
    this.renderDifficultySection(contentX, currentY, bounds.x + bounds.width / 2);
  }

  private renderSeedSection(x: number, y: number, width: number): number {
    const ctx = this.ctx;

    // Title
    ctx.fillStyle = "#6ee7ff";
    ctx.font = this.useMobileLayout ? "bold 12px 'Space Grotesk', Arial" : "bold 14px 'Space Grotesk', Arial";
    ctx.textAlign = "left";
    ctx.fillText("SEED", x, y);

    y += this.useMobileLayout ? 12 : 15;

    const inputHeight = this.useMobileLayout ? 36 : 44;
    const randomWidth = this.useMobileLayout ? 42 : 50; // Botón cuadrado para aleatorio
    const spacing = 10;
    const inputWidth = width - randomWidth - spacing;

    // Input box
    const isInputFocused = this.focusedInput === "seed";
    this.setButtonRegion("seedInput", x, y, inputWidth, inputHeight);

    ctx.fillStyle = isInputFocused ? "rgba(110, 231, 255, 0.1)" : "rgba(12, 17, 25, 0.8)";
    ctx.beginPath();
    ctx.roundRect(x, y, inputWidth, inputHeight, 10);
    ctx.fill();

    ctx.strokeStyle = isInputFocused ? "#6ee7ff" : "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#eaf0ff";
    ctx.font = this.useMobileLayout ? "15px 'Courier New'" : "18px 'Courier New'";
    ctx.textAlign = "left";
    ctx.fillText(this.seedInputValue || "0", x + 12, y + 28);

    // Cursor
    if (isInputFocused && Math.floor(Date.now() / 500) % 2 === 0) {
      const textWidth = ctx.measureText(this.seedInputValue).width;
      ctx.fillStyle = "#6ee7ff";
      ctx.fillRect(x + 14 + textWidth, y + 12, 2, 20);
    }

    // Random button (Dice icon)
    const randomX = x + inputWidth + spacing;
    const isRandomHovered = this.hoveredButton === "randomSeed";

    this.setButtonRegion("randomSeed", randomX, y, randomWidth, inputHeight);

    ctx.fillStyle = isRandomHovered ? "rgba(110, 231, 255, 0.25)" : "rgba(110, 231, 255, 0.1)";
    ctx.beginPath();
    ctx.roundRect(randomX, y, randomWidth, inputHeight, 10);
    ctx.fill();

    ctx.strokeStyle = isRandomHovered ? "#6ee7ff" : "rgba(110, 231, 255, 0.4)";
    ctx.stroke();

    ctx.fillStyle = "#eaf0ff";
    ctx.font = this.useMobileLayout ? "16px Arial" : "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText("⚄", randomX + randomWidth / 2, y + 29);

    return y + inputHeight;
  }

  private renderWorldSizeSection(x: number, y: number, centerX: number): number {
    const ctx = this.ctx;

    ctx.fillStyle = "#f4d03f";
    ctx.font = this.useMobileLayout ? "bold 12px Arial" : "bold 14px Arial";
    ctx.textAlign = "left";
    ctx.fillText("SIZE", x, y);

    y += this.useMobileLayout ? 12 : 15;

    const sizeOptions: Array<{ label: string; value: number; key: MenuButtonKey; icon?: string }> = [
      { label: "Small", value: 24, key: "sizeSmall" },
      { label: "Medium", value: 36, key: "sizeNormal" },
      { label: "Large", value: 48, key: "sizeLarge" }
    ];

    this.renderOptionButtons(sizeOptions, y, this.config.worldSize, centerX);

    return y + (this.useMobileLayout ? 40 : 50);
  }

  private renderDifficultySection(x: number, y: number, centerX: number) {
    const ctx = this.ctx;

    ctx.fillStyle = "#6ee7ff";
    ctx.font = this.useMobileLayout ? "bold 12px 'Space Grotesk', Arial" : "bold 14px 'Space Grotesk', Arial";
    ctx.textAlign = "left";
    ctx.fillText("DIFFICULTY", x, y);

    y += this.useMobileLayout ? 12 : 15;

    // Render difficulty options with chest icons
    this.renderDifficultyButtons(y, centerX);
  }

  private renderWorldPreview(x: number, y: number, width: number, height: number): void {
    const ctx = this.ctx;

    // Background with subtle shadow
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 5;

    ctx.fillStyle = "rgba(12, 17, 25, 0.85)";
    ctx.fillRect(x, y, width, height);

    ctx.shadowColor = "transparent";
    ctx.restore();

    // Animated border glow
    const borderPulse = 0.3 + Math.sin((performance.now() - this.menuOpenTime) * 0.0025) * 0.2;
    ctx.strokeStyle = `rgba(255, 255, 255, ${borderPulse * 0.3 + 0.15})`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = "#6ee7ff";
    ctx.font = "bold 15px 'Space Grotesk', Arial";
    ctx.textAlign = "left";
    ctx.fillText("🗺️ World Preview", x + 12, y + 24);

    ctx.font = "12px 'Space Grotesk', Arial";
    ctx.fillStyle = "#9fb2d7";
    ctx.fillText(`Seed ${this.config.seed} • ${this.config.worldSize}x${this.config.worldSize}`, x + 12, y + 42);

    const previewWorld = this.ensurePreviewWorld();
    const gridTopOffset = this.useMobileLayout ? 28 : 50;
    const availableWidth = width - 24;
    const availableHeight = height - gridTopOffset - 16;

    if (!previewWorld) {
      // Animated loading text
      const loadingAlpha = 0.5 + Math.sin((performance.now() - this.menuOpenTime) * 0.005) * 0.3;
      ctx.save();
      ctx.globalAlpha = loadingAlpha;
      ctx.fillStyle = "#9fb2d7";
      ctx.font = "13px 'Space Grotesk', Arial";
      ctx.fillText("Generating preview...", x + 12, y + gridTopOffset + 30);
      ctx.restore();
      return;
    }

    const gridSize = previewWorld.size;
    const widthFactor = Math.sqrt(3) * (gridSize + 0.5);
    const heightFactor = 1.5 * gridSize + 0.5;
    const cellSize = Math.max(4, Math.min(availableWidth / widthFactor, availableHeight / heightFactor));
    const hex = createHexGeometry(cellSize);
    const bounds = getHexWorldBounds(gridSize, hex);
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxY - bounds.minY;
    const originX = x + (width - worldWidth) / 2;
    const originY = y + gridTopOffset + (availableHeight - worldHeight) / 2;
    const offsetX = originX - bounds.minX;
    const offsetY = originY - bounds.minY;

    previewWorld.cells.forEach((row) =>
      row.forEach((cell) => {
        const center = getHexCenter(cell.x, cell.y, hex, offsetX, offsetY);
        traceHexPath(ctx, center, hex);
        ctx.fillStyle = this.getPreviewTerrainColor(cell.terrain);
        ctx.fill();
      }),
    );

    // Pulsing village center marker
    const villagePulse = 0.6 + Math.sin((performance.now() - this.menuOpenTime) * 0.004) * 0.4;
    ctx.save();
    ctx.shadowColor = `rgba(249, 115, 22, ${villagePulse})`;
    ctx.shadowBlur = 15;
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = Math.max(1, cellSize * 0.18);
    const villageCenter = getHexCenter(previewWorld.villageCenter.x, previewWorld.villageCenter.y, hex, offsetX, offsetY);
    traceHexPath(ctx, villageCenter, hex);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "rgba(12, 17, 25, 0.7)";
    ctx.fillRect(x + 10, y + height - 26, width - 20, 18);
    ctx.font = "11px 'Space Grotesk', Arial";
    ctx.fillStyle = "#9fb2d7";
    ctx.fillText("Change seed or size to regenerate preview.", x + 15, y + height - 13);
  }

  private getPreviewTerrainColor(terrain: Terrain): string {
    switch (terrain) {
      case "ocean":
        return "#0a2540";
      case "beach":
        return "#c2b280";
      case "grassland":
        return "#2d5016";
      case "forest":
        return "#1a3d0f";
      case "desert":
        return "#9b7e46";
      case "tundra":
        return "#6b7b8c";
      case "snow":
        return "#e8e8e8";
      case "mountain":
        return "#4b4f5d";
      case "swamp":
        return "#3d4f2f";
      case "river":
        return "#1e4d7b";
      default:
        return "#111";
    }
  }

  private requestPreviewUpdate(): void {
    this.previewDirty = true;
  }

  private ensurePreviewWorld(): WorldEngine | null {
    if (!this.previewDirty) {
      return this.previewWorld;
    }
    const now = performance.now();
    if (now - this.lastPreviewUpdate < this.previewThrottleMs) {
      return this.previewWorld;
    }
    this.previewWorld = new WorldEngine(this.config.worldSize, this.config.seed);
    this.lastPreviewUpdate = now;
    this.previewDirty = false;
    return this.previewWorld;
  }

  private renderOptionButtons(
    options: Array<{ label: string; value: number | string; key: MenuButtonKey; icon?: string }>,
    y: number,
    currentValue: number | string,
    centerXOverride?: number,
    isDifficulty = false
  ) {
    const ctx = this.ctx;
    const centerX = centerXOverride ?? this.canvas.width / 2;

    // More compact buttons
    // Calculate button width based on available space if needed
    const maxButtonWidth = this.useMobileLayout ? (this.canvas.width - 40) / options.length - 10 : 100;
    const buttonWidth = Math.min(this.useMobileLayout ? 70 : 100, maxButtonWidth);
    const buttonHeight = this.useMobileLayout ? 42 : 50;
    const spacing = 8; // Reduced spacing

    const totalWidth = options.length * buttonWidth + (options.length - 1) * spacing;
    let startX = centerX - totalWidth / 2;

    options.forEach((option) => {
      const isSelected = option.value === currentValue;
      const isHovered = this.hoveredButton === option.key;

      this.setButtonRegion(option.key, startX, y, buttonWidth, buttonHeight);

      if (isSelected) {
        ctx.save();
        ctx.shadowColor = "rgba(110, 231, 255, 0.4)";
        ctx.shadowBlur = 15;
      }

      // Background
      ctx.fillStyle = isSelected
        ? "rgba(110, 231, 255, 0.2)"
        : isHovered
          ? "rgba(255, 255, 255, 0.08)"
          : "rgba(12, 17, 25, 0.8)";

      ctx.beginPath();
      ctx.roundRect(startX, y, buttonWidth, buttonHeight, 10);
      ctx.fill();

      if (isSelected) {
        ctx.shadowColor = "transparent";
        ctx.restore();
      }

      // Border
      ctx.strokeStyle = isSelected ? "#6ee7ff" : isHovered ? "rgba(110, 231, 255, 0.4)" : "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Icon
      if (option.icon) {
        ctx.font = this.useMobileLayout ? "16px Arial" : "20px Arial";
        ctx.textAlign = "center";
        ctx.fillText(option.icon, startX + buttonWidth / 2, y + 24);
      }

      // Label
      ctx.fillStyle = isSelected ? "#eaf0ff" : isHovered ? "#9fb2d7" : "#9fb2d7";
      ctx.font = this.useMobileLayout ? (isSelected ? "bold 11px 'Space Grotesk', Arial" : "11px 'Space Grotesk', Arial") : (isSelected ? "bold 12px 'Space Grotesk', Arial" : "12px 'Space Grotesk', Arial");
      ctx.textAlign = "center";
      ctx.fillText(option.label, startX + buttonWidth / 2, y + 42);

      startX += buttonWidth + spacing;
    });
  }

  private renderDifficultyButtons(y: number, centerX: number) {
    const ctx = this.ctx;

    const buttonWidth = this.useMobileLayout ? 70 : 100;
    const buttonHeight = this.useMobileLayout ? 75 : 95;
    const spacing = 8;

    const options: Array<{ value: "easy" | "normal" | "hard"; key: MenuButtonKey; chest: HTMLImageElement | null; label: string }> = [
      { value: "easy", key: "difficultyEasy", chest: this.goldChestImage, label: "Easy" },
      { value: "normal", key: "difficultyNormal", chest: this.silverChestImage, label: "Normal" },
      { value: "hard", key: "difficultyHard", chest: this.copperChestImage, label: "Hard" }
    ];

    const totalWidth = options.length * buttonWidth + (options.length - 1) * spacing;
    let startX = centerX - totalWidth / 2;

    options.forEach((option) => {
      const isSelected = option.value === this.config.difficulty;
      const isHovered = this.hoveredButton === option.key;

      this.setButtonRegion(option.key, startX, y, buttonWidth, buttonHeight);

      // Add glow for selected
      if (isSelected) {
        ctx.save();
        ctx.shadowColor = "rgba(110, 231, 255, 0.4)";
        ctx.shadowBlur = 15;
      }

      // Background
      ctx.fillStyle = isSelected
        ? "rgba(110, 231, 255, 0.2)"
        : isHovered
          ? "rgba(255, 255, 255, 0.08)"
          : "rgba(12, 17, 25, 0.8)";

      ctx.beginPath();
      ctx.roundRect(startX, y, buttonWidth, buttonHeight, 10);
      ctx.fill();

      if (isSelected) {
        ctx.shadowColor = "transparent";
        ctx.restore();
      }

      // Border
      ctx.strokeStyle = isSelected ? "#6ee7ff" : isHovered ? "rgba(110, 231, 255, 0.4)" : "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Draw chest icon if loaded
      if (option.chest && option.chest.complete) {
        const iconSize = this.useMobileLayout ? 40 : 50;
        const iconX = startX + buttonWidth / 2 - iconSize / 2;
        const iconY = y + 8;
        ctx.drawImage(option.chest, iconX, iconY, iconSize, iconSize);
      }

      // Label
      ctx.fillStyle = isSelected ? "#eaf0ff" : isHovered ? "#9fb2d7" : "#9fb2d7";
      ctx.font = this.useMobileLayout ? (isSelected ? "bold 10px 'Space Grotesk', Arial" : "10px 'Space Grotesk', Arial") : (isSelected ? "bold 11px 'Space Grotesk', Arial" : "11px 'Space Grotesk', Arial");
      ctx.textAlign = "center";
      const labelY = this.useMobileLayout ? y + 62 : y + 72;
      ctx.fillText(option.label, startX + buttonWidth / 2, labelY);

      startX += buttonWidth + spacing;
    });
  }

  setMobileMode(isMobile: boolean) {
    this.useMobileLayout = isMobile;
    this.requestPreviewUpdate();
  }

  isMenuVisible(): boolean {
    return this.isVisible;
  }

  getConfig(): WorldGenerationConfig {
    return { ...this.config };
  }

  show() {
    this.isVisible = true;
    this.menuOpenTime = performance.now();
    this.lastAnimationTime = this.menuOpenTime;
    this.initParticles();
    this.attachKeyListener();
  }

  hide() {
    this.isVisible = false;
    this.detachKeyListener();
  }
  private renderFooter(centerX: number, canvasHeight: number) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(159, 178, 215, 0.5)";
    ctx.font = "11px 'Space Grotesk', Arial";
    ctx.textAlign = "center";
    ctx.fillText("v1.0.0 - Alpha Build", centerX, canvasHeight - 20);
  }
}
