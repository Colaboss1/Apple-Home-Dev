import { CustomizationManager } from './CustomizationManager';
import { DashboardConfig } from '../config/DashboardConfig';
import { DashboardStateManager } from './DashboardStateManager';

export interface BackgroundConfig { type: 'preset' | 'custom'; backgroundImage?: string; }

export class BackgroundManager {
  private customizationManager: CustomizationManager;
  private currentBackground: BackgroundConfig;
  private dashboardRefreshHandler?: (e: Event) => void;
  private static activeInstances = new Set<BackgroundManager>();
  static readonly PRESET_BACKGROUNDS = {
    'default': DashboardConfig.getDashboardBackground(),
    'sunset': 'linear-gradient(135deg,rgba(255,149,113,.8) 0%,rgba(255,112,166,.8) 20%,rgba(255,95,192,.8) 40%,rgba(198,113,255,.8) 60%,rgba(142,140,255,.8) 80%,rgba(115,152,255,.8) 100%)',
    'ocean': 'linear-gradient(135deg,rgba(29,151,255,.8) 0%,rgba(0,199,255,.8) 25%,rgba(0,229,195,.8) 50%,rgba(73,255,144,.8) 75%,rgba(146,254,157,.8) 100%)',
    'forest': 'linear-gradient(135deg,rgba(46,160,67,.8) 0%,rgba(81,198,103,.8) 25%,rgba(116,235,139,.8) 50%,rgba(151,255,175,.8) 75%,rgba(186,255,201,.8) 100%)',
    'purple': 'linear-gradient(135deg,rgba(88,86,214,.8) 0%,rgba(139,69,255,.8) 25%,rgba(185,103,255,.8) 50%,rgba(231,137,255,.8) 75%,rgba(255,171,255,.8) 100%)',
    'fire': 'linear-gradient(135deg,rgba(255,94,77,.8) 0%,rgba(255,154,0,.8) 25%,rgba(255,206,84,.8) 50%,rgba(255,238,173,.8) 75%,rgba(255,255,255,.8) 100%)'
  };
  static readonly DEFAULT_BACKGROUND = 'default';
  private dashboardStateListener?: (a: boolean, k?: string | null) => void;

  constructor(cm: CustomizationManager) {
    this.customizationManager = cm; this.currentBackground = this.getBackgroundConfig();
    if (BackgroundManager.activeInstances.size === 0) { this.dashboardStateListener = (a: boolean) => this.handleDashboardStateChange(a); DashboardStateManager.getInstance().addListener(this.dashboardStateListener); }
    this.setupDashboardRefreshListener(); BackgroundManager.activeInstances.add(this);
  }

  private setupDashboardRefreshListener(): void {
    this.dashboardRefreshHandler = () => { const cfg = this.getBackgroundConfig(); if (JSON.stringify(cfg) !== JSON.stringify(this.currentBackground)) { this.currentBackground = cfg; if (DashboardStateManager.getInstance().isDashboardActive()) this.applyBackgroundToBody(this.currentBackground); } };
    document.addEventListener('apple-home-dashboard-refresh', this.dashboardRefreshHandler);
  }

  private handleDashboardStateChange(a: boolean): void { a ? this.applyBackgroundToBody(this.currentBackground) : this.removeBackground(); }
  static clearBackgrounds(): void { document.querySelector('#apple-home-body-background')?.remove(); }

  private getBackgroundConfig(): BackgroundConfig {
    const c = this.customizationManager.getCustomizations().background;
    return c ? { type: c.type || 'preset', backgroundImage: c.value || c.backgroundImage || BackgroundManager.DEFAULT_BACKGROUND } : { type: 'preset', backgroundImage: BackgroundManager.DEFAULT_BACKGROUND };
  }

  async setBackground(c: BackgroundConfig): Promise<void> { this.currentBackground = c; await this.customizationManager.setCustomization('background', { type: c.type, value: c.backgroundImage }); this.applyBackgroundToBody(c); }
  applyBackgroundOnly(c: BackgroundConfig): void { this.currentBackground = c; this.applyBackgroundToBody(c); }

  private applyBackgroundToBody(c: BackgroundConfig): void {
    if (!DashboardStateManager.getInstance().isDashboardActive()) return;
    const s = c.type === 'custom' && c.backgroundImage ? c.backgroundImage : (c.type === 'preset' && c.backgroundImage ? BackgroundManager.getPresetBackground(c.backgroundImage) : BackgroundManager.getDashboardBackground());
    document.querySelector('#apple-home-body-background')?.remove();
    const el = document.createElement('style'); el.id = 'apple-home-body-background';
    el.textContent = `body::after{content:"";position:fixed;top:0;left:0;height:100vh;width:100vw;z-index:-1;background:${s} center center;background-size:cover;background-repeat:no-repeat}`;
    document.head.appendChild(el);
  }

  initializeBackground(): void { this.customizationManager.setDashboardActive(true); this.applyBackgroundToBody(this.getCurrentBackground()); }
  async setCustomBackground(url: string): Promise<void> { await this.setBackground({ type: 'custom', backgroundImage: url }); }
  async setPresetBackground(n: string): Promise<void> { await this.setBackground({ type: 'preset', backgroundImage: n }); }
  async resetToDefault(): Promise<void> { await this.setBackground({ type: 'preset', backgroundImage: BackgroundManager.DEFAULT_BACKGROUND }); }
  getCurrentBackground(): BackgroundConfig { return { ...this.currentBackground }; }
  isUsingCustomBackground(): boolean { return this.currentBackground.type === 'custom' && !!this.currentBackground.backgroundImage; }
  static getDashboardBackground(): string { return BackgroundManager.PRESET_BACKGROUNDS[BackgroundManager.DEFAULT_BACKGROUND]; }
  static getPresetBackground(n: string): string { return BackgroundManager.PRESET_BACKGROUNDS[n as keyof typeof BackgroundManager.PRESET_BACKGROUNDS] || BackgroundManager.getDashboardBackground(); }
  static getPresetNames(): string[] { return Object.keys(BackgroundManager.PRESET_BACKGROUNDS); }
  static async imageToDataUrl(f: File): Promise<string> { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(`url(${r.result as string})`); r.onerror = rej; r.readAsDataURL(f); }); }
  private removeBackground(): void { document.querySelector('#apple-home-body-background')?.remove(); }

  cleanup(): void {
    if (this.dashboardStateListener) { DashboardStateManager.getInstance().removeListener(this.dashboardStateListener); this.dashboardStateListener = undefined; }
    if (this.dashboardRefreshHandler) { document.removeEventListener('apple-home-dashboard-refresh', this.dashboardRefreshHandler); this.dashboardRefreshHandler = undefined; }
    BackgroundManager.activeInstances.delete(this);
    if (BackgroundManager.activeInstances.size === 0) { this.removeBackground(); this.customizationManager.setDashboardActive(false); }
  }
}
