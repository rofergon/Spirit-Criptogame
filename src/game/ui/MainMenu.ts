export interface WorldGenerationConfig {
  seed: number;
  worldSize: number;
  difficulty: "easy" | "normal" | "hard";
  startingCitizens: number;
}

export class MainMenu {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isVisible: boolean = true;
  
  // Opciones configurables
  private config: WorldGenerationConfig = {
    seed: Math.floor(Math.random() * 1000000),
    worldSize: 120,
    difficulty: "normal",
    startingCitizens: 5
  };
  
  private hoveredButton: string | null = null;
  private focusedInput: string | null = null;
  private seedInputValue: string = "";
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D");
    this.ctx = ctx;
    this.seedInputValue = this.config.seed.toString();
    
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e));
    this.canvas.addEventListener("click", (e) => this.handleClick(e));
    
    // Capturar entrada de teclado para el input de semilla
    window.addEventListener("keydown", (e) => {
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
    });
  }
  
  private applySeedInput() {
    const parsed = parseInt(this.seedInputValue) || Math.floor(Math.random() * 1000000);
    this.config.seed = parsed;
    this.seedInputValue = parsed.toString();
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
        break;
      
      case "randomSeed":
        this.config.seed = Math.floor(Math.random() * 1000000);
        this.seedInputValue = this.config.seed.toString();
        this.focusedInput = null;
        break;
      
      case "seedInput":
        this.focusedInput = "seed";
        break;
      
      case "sizeSmall":
        this.config.worldSize = 80;
        break;
      
      case "sizeNormal":
        this.config.worldSize = 120;
        break;
      
      case "sizeLarge":
        this.config.worldSize = 160;
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
  
  private getButtonAt(x: number, y: number): string | null {
    const centerX = this.canvas.width / 2;
    const startY = 280;
    
    // Botón Start
    if (x >= centerX - 150 && x <= centerX + 150 && 
        y >= startY + 440 && y <= startY + 500) {
      return "start";
    }
    
    // Input de semilla
    if (x >= centerX - 200 && x <= centerX + 50 &&
        y >= startY + 20 && y <= startY + 60) {
      return "seedInput";
    }
    
    // Botón Random Seed
    if (x >= centerX + 60 && x <= centerX + 200 &&
        y >= startY + 20 && y <= startY + 60) {
      return "randomSeed";
    }
    
    // Botones de tamaño
    const sizeY = startY + 120;
    if (y >= sizeY && y <= sizeY + 40) {
      if (x >= centerX - 180 && x <= centerX - 70) return "sizeSmall";
      if (x >= centerX - 60 && x <= centerX + 60) return "sizeNormal";
      if (x >= centerX + 70 && x <= centerX + 180) return "sizeLarge";
    }
    
    // Botones de dificultad
    const diffY = startY + 220;
    if (y >= diffY && y <= diffY + 40) {
      if (x >= centerX - 180 && x <= centerX - 70) return "difficultyEasy";
      if (x >= centerX - 60 && x <= centerX + 60) return "difficultyNormal";
      if (x >= centerX + 70 && x <= centerX + 180) return "difficultyHard";
    }
    
    return null;
  }
  
  render() {
    if (!this.isVisible) return;
    
    const ctx = this.ctx;
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    // Fondo oscuro con gradiente
    const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, "#0f172a");
    gradient.addColorStop(1, "#1e293b");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Título principal
    ctx.fillStyle = "#f0e7dc";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText("🏛️ GENERACIÓN DE MUNDO", centerX, 120);
    
    ctx.font = "18px Arial";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Configura tu civilización antes de comenzar", centerX, 160);
    
    // Panel de configuración
    const panelX = centerX - 300;
    const panelY = 200;
    const panelWidth = 600;
    const panelHeight = 520;
    
    ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    
    ctx.strokeStyle = "rgba(233, 204, 152, 0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
    
    let currentY = panelY + 40;
    
    // ===== SEMILLA =====
    ctx.fillStyle = "#e9cc98";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "left";
    ctx.fillText("🌱 Semilla del Mundo:", panelX + 20, currentY);
    
    currentY += 30;
    
    // Input de semilla
    const inputX = panelX + 20;
    const inputY = currentY;
    const inputWidth = 250;
    const inputHeight = 40;
    
    const isInputHovered = this.hoveredButton === "seedInput";
    const isInputFocused = this.focusedInput === "seed";
    
    ctx.fillStyle = isInputFocused ? "rgba(59, 130, 246, 0.2)" : 
                    isInputHovered ? "rgba(100, 116, 139, 0.3)" : 
                    "rgba(15, 23, 42, 0.6)";
    ctx.fillRect(inputX, inputY, inputWidth, inputHeight);
    
    ctx.strokeStyle = isInputFocused ? "#3b82f6" : 
                      isInputHovered ? "#64748b" : "#475569";
    ctx.lineWidth = 2;
    ctx.strokeRect(inputX, inputY, inputWidth, inputHeight);
    
    ctx.fillStyle = "#f0e7dc";
    ctx.font = "20px 'Courier New'";
    ctx.textAlign = "left";
    ctx.fillText(this.seedInputValue || "0", inputX + 10, inputY + 26);
    
    // Cursor parpadeante
    if (isInputFocused && Math.floor(Date.now() / 500) % 2 === 0) {
      const textWidth = ctx.measureText(this.seedInputValue).width;
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(inputX + 10 + textWidth + 2, inputY + 10, 2, 20);
    }
    
    // Botón Random
    const randomX = inputX + inputWidth + 10;
    const randomWidth = 140;
    const isRandomHovered = this.hoveredButton === "randomSeed";
    
    ctx.fillStyle = isRandomHovered ? "rgba(139, 92, 246, 0.3)" : "rgba(139, 92, 246, 0.15)";
    ctx.fillRect(randomX, inputY, randomWidth, inputHeight);
    
    ctx.strokeStyle = isRandomHovered ? "#8b5cf6" : "#6d28d9";
    ctx.lineWidth = 2;
    ctx.strokeRect(randomX, inputY, randomWidth, inputHeight);
    
    ctx.fillStyle = isRandomHovered ? "#a78bfa" : "#8b5cf6";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("🎲 Aleatorio", randomX + randomWidth / 2, inputY + 25);
    
    currentY += 80;
    
    // ===== TAMAÑO DEL MUNDO =====
    ctx.fillStyle = "#e9cc98";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "left";
    ctx.fillText("🗺️ Tamaño del Mundo:", panelX + 20, currentY);
    
    currentY += 30;
    
    const sizeOptions = [
      { label: "Pequeño", value: 80, key: "sizeSmall" },
      { label: "Normal", value: 120, key: "sizeNormal" },
      { label: "Grande", value: 160, key: "sizeLarge" }
    ];
    
    this.renderOptionButtons(sizeOptions, currentY, this.config.worldSize);
    
    currentY += 70;
    
    // ===== DIFICULTAD =====
    ctx.fillStyle = "#e9cc98";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "left";
    ctx.fillText("⚔️ Dificultad:", panelX + 20, currentY);
    
    currentY += 30;
    
    const difficultyOptions = [
      { label: "Fácil", value: "easy", key: "difficultyEasy", desc: "8 ciudadanos" },
      { label: "Normal", value: "normal", key: "difficultyNormal", desc: "5 ciudadanos" },
      { label: "Difícil", value: "hard", key: "difficultyHard", desc: "3 ciudadanos" }
    ];
    
    this.renderDifficultyButtons(difficultyOptions, currentY);
    
    currentY += 90;
    
    // ===== INFORMACIÓN =====
    ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
    ctx.fillRect(panelX + 20, currentY, panelWidth - 40, 80);
    
    ctx.strokeStyle = "rgba(59, 130, 246, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 20, currentY, panelWidth - 40, 80);
    
    ctx.fillStyle = "#93c5fd";
    ctx.font = "13px Arial";
    ctx.textAlign = "left";
    ctx.fillText("ℹ️ Información:", panelX + 35, currentY + 22);
    
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "12px Arial";
    ctx.fillText(`• La misma semilla genera el mismo mundo`, panelX + 35, currentY + 42);
    ctx.fillText(`• Mundos más grandes = más exploración`, panelX + 35, currentY + 58);
    ctx.fillText(`• Puedes copiar la semilla para compartir mundos`, panelX + 35, currentY + 74);
    
    currentY += 100;
    
    // ===== BOTÓN START =====
    const startButtonY = currentY;
    const startButtonWidth = 300;
    const startButtonHeight = 60;
    const startButtonX = centerX - startButtonWidth / 2;
    
    const isStartHovered = this.hoveredButton === "start";
    
    const startGradient = ctx.createLinearGradient(
      startButtonX, startButtonY,
      startButtonX, startButtonY + startButtonHeight
    );
    
    if (isStartHovered) {
      startGradient.addColorStop(0, "#10b981");
      startGradient.addColorStop(1, "#059669");
    } else {
      startGradient.addColorStop(0, "#059669");
      startGradient.addColorStop(1, "#047857");
    }
    
    ctx.fillStyle = startGradient;
    ctx.fillRect(startButtonX, startButtonY, startButtonWidth, startButtonHeight);
    
    ctx.strokeStyle = isStartHovered ? "#34d399" : "#10b981";
    ctx.lineWidth = 3;
    ctx.strokeRect(startButtonX, startButtonY, startButtonWidth, startButtonHeight);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText("🚀 COMENZAR PARTIDA", centerX, startButtonY + 38);
    
    // Footer
    ctx.fillStyle = "#64748b";
    ctx.font = "12px Arial";
    ctx.fillText("Presiona ESC durante el juego para pausar", centerX, this.canvas.height - 30);
  }
  
  private renderOptionButtons(
    options: Array<{ label: string; value: number; key: string }>,
    y: number,
    currentValue: number
  ) {
    const ctx = this.ctx;
    const centerX = this.canvas.width / 2;
    const buttonWidth = 110;
    const buttonHeight = 40;
    const spacing = 10;
    
    const totalWidth = options.length * buttonWidth + (options.length - 1) * spacing;
    let startX = centerX - totalWidth / 2;
    
    options.forEach((option) => {
      const isSelected = option.value === currentValue;
      const isHovered = this.hoveredButton === option.key;
      
      if (isSelected) {
        ctx.fillStyle = "rgba(59, 130, 246, 0.4)";
      } else if (isHovered) {
        ctx.fillStyle = "rgba(100, 116, 139, 0.3)";
      } else {
        ctx.fillStyle = "rgba(30, 41, 59, 0.6)";
      }
      
      ctx.fillRect(startX, y, buttonWidth, buttonHeight);
      
      ctx.strokeStyle = isSelected ? "#3b82f6" : isHovered ? "#64748b" : "#475569";
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(startX, y, buttonWidth, buttonHeight);
      
      ctx.fillStyle = isSelected ? "#93c5fd" : "#cbd5e1";
      ctx.font = isSelected ? "bold 14px Arial" : "14px Arial";
      ctx.textAlign = "center";
      ctx.fillText(option.label, startX + buttonWidth / 2, y + 17);
      
      ctx.font = "11px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`${option.value}x${option.value}`, startX + buttonWidth / 2, y + 32);
      
      startX += buttonWidth + spacing;
    });
  }
  
  private renderDifficultyButtons(
    options: Array<{ label: string; value: string; key: string; desc: string }>,
    y: number
  ) {
    const ctx = this.ctx;
    const centerX = this.canvas.width / 2;
    const buttonWidth = 110;
    const buttonHeight = 50;
    const spacing = 10;
    
    const totalWidth = options.length * buttonWidth + (options.length - 1) * spacing;
    let startX = centerX - totalWidth / 2;
    
    options.forEach((option) => {
      const isSelected = option.value === this.config.difficulty;
      const isHovered = this.hoveredButton === option.key;
      
      let color = "#64748b";
      if (option.value === "easy") color = "#10b981";
      if (option.value === "normal") color = "#f59e0b";
      if (option.value === "hard") color = "#ef4444";
      
      if (isSelected) {
        ctx.fillStyle = `${color}40`;
      } else if (isHovered) {
        ctx.fillStyle = `${color}20`;
      } else {
        ctx.fillStyle = "rgba(30, 41, 59, 0.6)";
      }
      
      ctx.fillRect(startX, y, buttonWidth, buttonHeight);
      
      ctx.strokeStyle = isSelected ? color : isHovered ? `${color}80` : "#475569";
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(startX, y, buttonWidth, buttonHeight);
      
      ctx.fillStyle = isSelected ? color : "#cbd5e1";
      ctx.font = isSelected ? "bold 14px Arial" : "14px Arial";
      ctx.textAlign = "center";
      ctx.fillText(option.label, startX + buttonWidth / 2, y + 20);
      
      ctx.font = "10px Arial";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(option.desc, startX + buttonWidth / 2, y + 36);
      
      startX += buttonWidth + spacing;
    });
  }
  
  isMenuVisible(): boolean {
    return this.isVisible;
  }
  
  getConfig(): WorldGenerationConfig {
    return { ...this.config };
  }
  
  show() {
    this.isVisible = true;
  }
  
  hide() {
    this.isVisible = false;
  }
}
