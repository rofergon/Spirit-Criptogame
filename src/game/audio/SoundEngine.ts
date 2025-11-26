type TrackName = "main" | "attack";

interface TrackConfig {
  src: string;
  loop?: boolean;
}

/**
 * Minimal, scalable sound engine for background/attack loops.
 * Uses simple HTMLAudioElement fading between tracks.
 */
export class SoundEngine {
  private tracks: Record<TrackName, HTMLAudioElement>;
  private current: HTMLAudioElement | null = null;
  private fadeHandle: number | null = null;
  private muted = false;
  private menuTrack: HTMLAudioElement;
  private pendingUnlock: (() => void) | null = null;

  constructor() {
    this.tracks = {
      main: this.createAudio({ src: "/assets/audio/Wood and Iron Dawn.mp3", loop: true }),
      attack: this.createAudio({ src: "/assets/audio/Under_Siege.mp3", loop: true }),
    };
    this.menuTrack = this.createAudio({ src: "/assets/audio/The Forest Beckons.mp3", loop: true });
  }

  /**
   * Start/restore main loop with a gentle fade-in.
   */
  playMainLoop() {
    void this.switchTo("main", { fadeInMs: 2000, fadeOutMs: 500, targetVolume: 0.8 });
  }

  /**
   * Play attack loop (raids/beasts) with a quick ramp.
   */
  playAttackLoop() {
    void this.switchTo("attack", { fadeInMs: 400, fadeOutMs: 300, targetVolume: 0.9 });
  }

  /**
   * Play menu theme (used before simulation starts).
   */
  playMenu() {
    void this.switchToMenu({ fadeInMs: 1200, fadeOutMs: 600, targetVolume: 0.8 });
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    Object.values(this.tracks).forEach((audio) => {
      audio.muted = muted;
    });
    this.menuTrack.muted = muted;
  }

  isMuted() {
    return this.muted;
  }

  private createAudio(config: TrackConfig) {
    const audio = new Audio(config.src);
    audio.loop = config.loop ?? false;
    audio.volume = 0;
    audio.muted = this.muted;
    audio.preload = "auto";
    return audio;
  }

  private async switchTo(
    name: TrackName,
    opts: { fadeInMs: number; fadeOutMs: number; targetVolume: number },
  ) {
    const target = this.tracks[name];
    if (!target) return;

    if (this.fadeHandle !== null) {
      cancelAnimationFrame(this.fadeHandle);
      this.fadeHandle = null;
    }

    const previous = this.current && this.current !== target ? this.current : null;
    this.current = target;

    const played = await this.tryPlay(name, opts);
    if (!played) return;

    target.volume = 0;
    const start = performance.now();
    const fade = (time: number) => {
      const elapsed = time - start;
      const fadeInProgress = Math.min(1, elapsed / opts.fadeInMs);
      target.volume = opts.targetVolume * fadeInProgress;

      if (previous) {
        const fadeOutProgress = Math.min(1, elapsed / opts.fadeOutMs);
        previous.volume = opts.targetVolume * (1 - fadeOutProgress);
        if (fadeOutProgress >= 1) {
          previous.pause();
        }
      }

      if (fadeInProgress < 1 || (previous && previous.volume > 0.01)) {
        this.fadeHandle = requestAnimationFrame(fade);
      }
    };

    this.fadeHandle = requestAnimationFrame(fade);
  }

  private async switchToMenu(opts: { fadeInMs: number; fadeOutMs: number; targetVolume: number }) {
    if (this.fadeHandle !== null) {
      cancelAnimationFrame(this.fadeHandle);
      this.fadeHandle = null;
    }

    const previous = this.current && this.current !== this.menuTrack ? this.current : null;
    this.current = this.menuTrack;

    const played = await this.tryPlay("menu", opts);
    if (!played) return;

    this.menuTrack.volume = 0;
    const start = performance.now();
    const fade = (time: number) => {
      const elapsed = time - start;
      const fadeInProgress = Math.min(1, elapsed / opts.fadeInMs);
      this.menuTrack.volume = opts.targetVolume * fadeInProgress;

      if (previous) {
        const fadeOutProgress = Math.min(1, elapsed / opts.fadeOutMs);
        previous.volume = opts.targetVolume * (1 - fadeOutProgress);
        if (fadeOutProgress >= 1) {
          previous.pause();
        }
      }

      if (fadeInProgress < 1 || (previous && previous.volume > 0.01)) {
        this.fadeHandle = requestAnimationFrame(fade);
      }
    };

    this.fadeHandle = requestAnimationFrame(fade);
  }

  private async tryPlay(
    name: TrackName | "menu",
    opts: { fadeInMs: number; fadeOutMs: number; targetVolume: number },
  ) {
    const target =
      name === "menu"
        ? this.menuTrack
        : this.tracks[name];
    try {
      target.currentTime = 0;
      await target.play();
      this.clearPendingUnlock();
      return true;
    } catch (error: any) {
      // Autoplay blocked; wait for first interaction then retry.
      if (error?.name === "NotAllowedError") {
        this.queueAutoplayUnlock(() => {
          if (name === "menu") {
            void this.switchToMenu(opts);
          } else {
            void this.switchTo(name, opts);
          }
        });
      }
      return false;
    }
  }

  private queueAutoplayUnlock(callback: () => void) {
    if (this.pendingUnlock) return;
    const handler = () => {
      this.clearPendingUnlock();
      callback();
    };
    window.addEventListener("pointerdown", handler, { once: true });
    window.addEventListener("keydown", handler, { once: true });
    this.pendingUnlock = () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }

  private clearPendingUnlock() {
    if (this.pendingUnlock) {
      this.pendingUnlock();
      this.pendingUnlock = null;
    }
  }
}
