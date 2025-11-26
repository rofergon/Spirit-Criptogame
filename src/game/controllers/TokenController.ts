import { convertFaithToHex, type TransactionStatus, getOnChainBalances } from "../wallet/hexConversionService";
import { isWalletConnected, connectOneWallet, getCurrentAccount, getWalletInstance } from "../wallet/walletConfig";
import type { HUDController } from "../ui/HUDController";
import type { SimulationSession } from "../core/SimulationSession";
import type { ToastNotification } from "../core/types";

// Snapshot of on-chain token balances
type OnChainSnapshot = { hex: number; theron: number };

/**
 * Dependencies required by the TokenController
 */
interface TokenDependencies {
  hud: HUDController;
  getSimulation: () => SimulationSession | null;
  logEvent: (message: string, notificationType?: ToastNotification["type"]) => void;
  onBalancesChanged: () => void;
}

/**
 * Manages token conversion from in-game Faith to on-chain HEX tokens
 * Handles wallet integration and balance polling
 */
export class TokenController {
  // Cached on-chain token balances
  private onChainBalances: OnChainSnapshot | null = null;
  // Polling interval for balance updates
  private onChainBalanceInterval: number | null = null;

  // UI elements
  private token1Pill = document.querySelector<HTMLDivElement>("#token1-pill");
  private tokenModal = document.querySelector<HTMLDivElement>("#token-modal");
  private tokenModalBackdrop = document.querySelector<HTMLDivElement>("#token-modal-backdrop");
  private tokenModalClose = document.querySelector<HTMLButtonElement>("#token-modal-close");
  private tokenModalCancel = document.querySelector<HTMLButtonElement>("#token-modal-cancel");
  private tokenModalConvertAll = document.querySelector<HTMLButtonElement>("#token-convert-all");
  private tokenModalFaithValue = document.querySelector<HTMLSpanElement>("#token-modal-faith");
  private tokenModalRate = document.querySelector<HTMLSpanElement>("#token-modal-rate");
  private tokenModalStatus = document.querySelector<HTMLParagraphElement>("#token-modal-status");

  constructor(private readonly deps: TokenDependencies) {}

  /**
   * Initialize token UI and start balance polling
   */
  init() {
    this.setupTokenUI();
    this.startOnChainBalancePolling();
  }

  /**
   * Clean up polling and close modal
   */
  destroy() {
    if (this.onChainBalanceInterval !== null) {
      window.clearInterval(this.onChainBalanceInterval);
      this.onChainBalanceInterval = null;
    }
    this.closeTokenModal();
  }

  /**
   * Reset cached balances
   */
  resetBalances() {
    this.onChainBalances = null;
  }

  /**
   * Get current token balances snapshot
   */
  getTokenSnapshot() {
    return this.onChainBalances ? { token1: this.onChainBalances.hex, token2: this.onChainBalances.theron } : null;
  }

  /**
   * Fetch latest on-chain balances and update UI
   */
  async refreshOnChainBalances() {
    const current = getCurrentAccount();
    const fallbackAccount = getWalletInstance()?.accounts?.[0];
    const account = current ?? fallbackAccount ?? null;
    if (!account?.address) return;
    try {
      const { hex, theron } = await getOnChainBalances(account.address);
      const token1El = document.querySelector<HTMLSpanElement>("#token1-value");
      const token2El = document.querySelector<HTMLSpanElement>("#token2-value");
      if (token1El) token1El.textContent = hex.toFixed(2);
      if (token2El) token2El.textContent = theron.toFixed(2);
      this.onChainBalances = { hex, theron };
      this.deps.onBalancesChanged();
    } catch (error) {
      console.warn("No se pudo refrescar balances on-chain:", error);
    }
  }

  /**
   * Set up token modal UI and event listeners
   */
  private setupTokenUI() {
    const open = (event?: KeyboardEvent | MouseEvent) => {
      if (event && event.type === "keydown") {
        const key = (event as KeyboardEvent).key;
        if (key !== "Enter" && key !== " ") return;
        event.preventDefault();
      }
      this.openTokenModal();
    };
    this.token1Pill?.addEventListener("click", open);
    this.token1Pill?.addEventListener("keydown", open);
    this.tokenModalConvertAll?.addEventListener("click", this.convertAllFaithToToken1);
    this.tokenModalClose?.addEventListener("click", this.closeTokenModal);
    this.tokenModalCancel?.addEventListener("click", this.closeTokenModal);
    this.tokenModalBackdrop?.addEventListener("click", this.closeTokenModal);
  }

  /**
   * Open the token conversion modal
   */
  private openTokenModal = () => {
    const simulation = this.deps.getSimulation();
    if (!simulation || !this.tokenModal || !this.tokenModalBackdrop) {
      return;
    }
    this.updateTokenModalStats();
    this.tokenModal.classList.remove("hidden");
    this.tokenModalBackdrop.classList.remove("hidden");
  };

  /**
   * Close the token conversion modal
   */
  private closeTokenModal = () => {
    this.tokenModal?.classList.add("hidden");
    this.tokenModalBackdrop?.classList.add("hidden");
  };

  /**
   * Update modal statistics (Faith amount, conversion rate)
   */
  private updateTokenModalStats() {
    const simulation = this.deps.getSimulation();
    if (!simulation) return;
    const faith = simulation.getFaithSnapshot().value;
    const rate = simulation.getFaithConversionRate();
    if (this.tokenModalFaithValue) {
      this.tokenModalFaithValue.textContent = Math.floor(faith).toString();
    }
    if (this.tokenModalRate) {
      this.tokenModalRate.textContent = `${rate} Faith → 1 HEX`;
    }
    if (this.tokenModalStatus) {
      if (faith <= 0) {
        this.tokenModalStatus.textContent = "No stored Faith to convert.";
      } else if (!isWalletConnected()) {
        this.tokenModalStatus.textContent = "Connect your OneWallet to convert Faith to HEX on-chain.";
      } else {
        this.tokenModalStatus.textContent = "Convert your Faith to HEX tokens on OneChain.";
      }
    }
  }

  /**
   * Start periodic polling of on-chain balances (every 30 seconds)
   */
  private startOnChainBalancePolling() {
    if (this.onChainBalanceInterval !== null) return;
    this.onChainBalanceInterval = window.setInterval(() => {
      void this.refreshOnChainBalances();
    }, 30_000);
  }

  /**
   * Convert all available Faith to HEX tokens via on-chain transaction
   */
  convertAllFaithToToken1 = async () => {
    const simulation = this.deps.getSimulation();
    if (!simulation) {
      return;
    }

    const faithAmount = Math.floor(simulation.getFaithSnapshot().value);

    if (faithAmount <= 0) {
      this.deps.hud.updateStatus("No Faith available to convert.");
      this.closeTokenModal();
      return;
    }

    if (!isWalletConnected()) {
      if (this.tokenModalStatus) {
        this.tokenModalStatus.textContent = "Connecting wallet...";
      }

      const connection = await connectOneWallet();
      if (!connection.success) {
        if (this.tokenModalStatus) {
          this.tokenModalStatus.textContent = connection.error || "Error connecting wallet";
        }
        this.deps.hud.showNotification("Could not connect wallet", "critical");
        return;
      }

      this.deps.hud.showNotification("Wallet connected successfully", "success");
      await this.refreshOnChainBalances();
    }

    const updateModalStatus = (status: TransactionStatus, message?: string) => {
      if (this.tokenModalStatus) {
        const statusMessages: Record<TransactionStatus, string> = {
          idle: "Preparing...",
          "connecting-wallet": "Connecting wallet...",
          "building-transaction": "Preparing transaction...",
          signing: "✍️ Please sign the transaction in OneWallet",
          executing: "⏳ Executing transaction on OneChain...",
          confirming: "🔄 Confirming...",
          success: "✅ Conversion successful!",
          error: "❌ Transaction error",
        };
        this.tokenModalStatus.textContent = message || statusMessages[status];
      }
    };

    if (this.tokenModalConvertAll) {
      this.tokenModalConvertAll.disabled = true;
      this.tokenModalConvertAll.textContent = "Procesando...";
    }

    try {
      const result = await convertFaithToHex(faithAmount, updateModalStatus);

      if (result.success && result.hexReceived) {
        simulation.convertFaithToToken1();

        this.deps.logEvent(
          `✨ Converted ${result.faithSpent} Faith into ${result.hexReceived} HEX tokens on-chain. ` +
            `TX: ${result.transactionDigest?.slice(0, 10)}...`,
        );
        this.deps.hud.showNotification(`¡${result.hexReceived} HEX tokens recibidos!`, "success", 6000);
        this.showConversionSuccessAnimation(result.hexReceived);
        await this.refreshOnChainBalances();
        this.deps.onBalancesChanged();

        setTimeout(() => {
          this.closeTokenModal();
        }, 2000);
      } else {
        this.deps.hud.showNotification(result.error || "Error al convertir Faith a HEX", "critical", 5000);
      }
    } catch (error: any) {
      console.error("Error en convertAllFaithToToken1:", error);
      if (this.tokenModalStatus) {
        this.tokenModalStatus.textContent = `Error: ${error.message || "Error desconocido"}`;
      }
      this.deps.hud.showNotification("Error al convertir Faith a HEX", "critical");
    } finally {
      if (this.tokenModalConvertAll) {
        this.tokenModalConvertAll.disabled = false;
        this.tokenModalConvertAll.textContent = "Convert all";
      }
    }
  };

  /**
   * Display animated success feedback with fireworks and coin flip
   */
  private showConversionSuccessAnimation(hexAmount: number) {
    if (!this.tokenModal) return;
    const anim = document.createElement("div");
    anim.className = "conversion-success-anim";
    anim.innerHTML = `
      <div class="fireworks">
        <div class="firework"></div>
        <div class="firework"></div>
        <div class="firework"></div>
        <div class="firework"></div>
        <div class="firework"></div>
        <div class="firework"></div>
      </div>
      <div class="coin-3d">
        <div class="face front"><img src="/assets/extracted_icons/Hex_Token.png" alt="HEX token" /></div>
        <div class="face back"><img src="/assets/extracted_icons/Hex_Token.png" alt="HEX token" /></div>
        <div class="edge"></div>
      </div>
      <div class="celebrate-text">+${hexAmount.toFixed(2)} HEX</div>
    `;
    this.tokenModal.appendChild(anim);
    setTimeout(() => anim.remove(), 4000);
  }
}
