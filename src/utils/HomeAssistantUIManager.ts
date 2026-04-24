import { CustomizationManager } from './CustomizationManager';
import { DashboardStateManager } from './DashboardStateManager';
import { localize } from './LocalizationService';

export interface HomeAssistantUIState { headerVisible: boolean; sidebarVisible: boolean; }

export class HomeAssistantUIManager {
  private static instance: HomeAssistantUIManager | null = null;
  private state: HomeAssistantUIState;
  private headerElement: HTMLElement | null = null;
  private huiRootElement: HTMLElement | null = null;
  private initialized = false;
  private customizationManager: CustomizationManager | null = null;
  private originalState: HomeAssistantUIState | null = null;
  private dashboardStateManager: DashboardStateManager | null = null;
  private listenerSetup = false;
  private lastSidebarState: boolean | null = null;
  private dashboardStateListener?: (isActive: boolean, dashboardKey?: string | null) => void;
  private restoreTimeout: number | null = null;

  private constructor() { this.state = { headerVisible: true, sidebarVisible: true }; }

  public static getInstance(): HomeAssistantUIManager { if (!HomeAssistantUIManager.instance) { HomeAssistantUIManager.instance = new HomeAssistantUIManager(); HomeAssistantUIManager.instance.initialize(); } return HomeAssistantUIManager.instance; }
  public static initializeWithCustomizations(cm: CustomizationManager): HomeAssistantUIManager { const i = HomeAssistantUIManager.getInstance(); i.setCustomizationManager(cm); return i; }

  private setCustomizationManager(cm: CustomizationManager): void { this.customizationManager = cm; if (!this.listenerSetup) { this.setupDashboardStateListener(); this.listenerSetup = true; } }
  private async initialize(): Promise<void> { if (this.initialized) return; await customElements.whenDefined("home-assistant"); await customElements.whenDefined("home-assistant-main"); this.applyUIState(); this.initialized = true; }

  private deepQuery(root: any, sel: string): HTMLElement | null {
    const s = [root];
    while (s.length) {
      const n = s.pop(); if (!n) continue; const f = n.querySelector?.(sel); if (f) return f;
      n.children && s.push(...n.children); n.shadowRoot && s.push(n.shadowRoot);
    } return null;
  }

  private collapseHeader(hide: boolean = true): void {
    const hr = document.querySelector("home-assistant"), hui = this.deepQuery(hr, "hui-root"), h = hui?.shadowRoot?.querySelector(".header");
    if (!hui || !h) return; this.huiRootElement = hui as HTMLElement; this.headerElement = h as HTMLElement;
    try {
      if (hide) { this.headerElement.style.display = "none"; this.huiRootElement.style.setProperty("--mdc-top-app-bar-height", "0px"); this.huiRootElement.style.setProperty("--header-height", "0px"); const v = this.huiRootElement.shadowRoot?.querySelector("#view") as HTMLElement; if (v) v.style.setProperty("padding-top", "0px"); }
      else { this.headerElement.style.display = ""; this.huiRootElement.style.removeProperty("--mdc-top-app-bar-height"); this.huiRootElement.style.removeProperty("--header-height"); const v = this.huiRootElement.shadowRoot?.querySelector("#view") as HTMLElement; if (v) v.style.removeProperty("padding-top"); }
      this.huiRootElement.dispatchEvent(new Event("iron-resize", { bubbles: true, composed: true }));
    } catch {}
  }

  private collapseSidebar(hide: boolean = true): void {
    if (this.lastSidebarState === hide) return; this.lastSidebarState = hide;
    try {
      const ha = document.querySelector("home-assistant"), m = ha?.shadowRoot?.querySelector("home-assistant-main");
      if (!m) { this.lastSidebarState = null; return; }
      if (hide) m.dispatchEvent(new CustomEvent("hass-dock-sidebar", { detail: { dock: "always_hidden" }, bubbles: true, composed: true }));
      else this.dockAfterDrawerClosed(m, "docked");
    } catch { this.lastSidebarState = null; }
  }

  private async dockAfterDrawerClosed(m: Element, target: string = "docked"): Promise<void> {
    const d = m.shadowRoot?.querySelector("ha-drawer"); if (!((d as any)?.mdcFoundation?.isOpen?.() || (d as any)?.open === true)) { m.dispatchEvent(new CustomEvent("hass-dock-sidebar", { detail: { dock: target }, bubbles: true, composed: true })); return; }
    const wait = () => new Promise<void>((res) => {
      let done = false; const fin = () => { if (done) return; done = true; cln(); res(); }; const clns: (() => void)[] = [];
      if (d) { const onCls = () => fin(); d.addEventListener("MDCDrawer:closed", onCls, { once: true }); clns.push(() => d.removeEventListener("MDCDrawer:closed", onCls)); }
      const bObs = new MutationObserver(() => { if (document.body.style.overflow !== "hidden" && getComputedStyle(document.body).overflow !== "hidden") fin(); }); bObs.observe(document.body, { attributes: true, attributeFilter: ["style"] }); clns.push(() => bObs.disconnect());
      const mObs = new MutationObserver(() => { if (!m.hasAttribute("modal")) fin(); }); mObs.observe(m, { attributes: true, attributeFilter: ["modal"] }); clns.push(() => mObs.disconnect());
      const cln = () => clns.forEach(f => f());
    });
    m.dispatchEvent(new CustomEvent("hass-toggle-menu", { detail: { open: false }, bubbles: true, composed: true })); await wait();
    if (document.body.style.overflow === "hidden") m.dispatchEvent(new CustomEvent("hass-toggle-menu", { detail: { open: false }, bubbles: true, composed: true }));
    m.dispatchEvent(new CustomEvent("hass-dock-sidebar", { detail: { dock: target }, bubbles: true, composed: true }));
  }

  private applyUIState(): void { this.collapseHeader(!this.state.headerVisible); this.collapseSidebar(!this.state.sidebarVisible); }

  public async toggleHeader(): Promise<boolean> {
    this.state.headerVisible = !this.state.headerVisible;
    if (this.customizationManager) await this.customizationManager.setHeaderVisibility(!this.state.headerVisible);
    this.collapseHeader(!this.state.headerVisible); return this.state.headerVisible;
  }

  public async toggleSidebar(): Promise<boolean> {
    this.state.sidebarVisible = !this.state.sidebarVisible;
    if (this.customizationManager) await this.customizationManager.setSidebarVisibility(!this.state.sidebarVisible);
    this.lastSidebarState = null; this.collapseSidebar(!this.state.sidebarVisible); return this.state.sidebarVisible;
  }

  public isHeaderVisible(): boolean { return this.state.headerVisible; }
  public isSidebarVisible(): boolean { return this.state.sidebarVisible; }
  public getHeaderToggleText(): string { return this.state.headerVisible ? localize('toggles.hide_header') : localize('toggles.show_header'); }
  public getSidebarToggleText(): string { return this.state.sidebarVisible ? localize('toggles.hide_sidebar') : localize('toggles.show_sidebar'); }

  private setupDashboardStateListener(): void {
    if (!this.customizationManager) return; this.dashboardStateManager = DashboardStateManager.getInstance();
    this.originalState = { headerVisible: true, sidebarVisible: true };
    if (this.dashboardStateManager.isDashboardActive()) this.applyDashboardUISettings();
    this.dashboardStateListener = (active: boolean) => {
      if (active) { if (this.restoreTimeout !== null) { clearTimeout(this.restoreTimeout); this.restoreTimeout = null; } requestAnimationFrame(() => this.applyDashboardUISettings()); }
      else { this.restoreTimeout = window.setTimeout(() => { this.restoreOriginalUIState(); this.restoreTimeout = null; }, 300); }
    };
    this.dashboardStateManager.addListener(this.dashboardStateListener);
  }

  private applyDashboardUISettings(): void {
    if (!this.customizationManager) return;
    this.state.headerVisible = !this.customizationManager.isHeaderHidden(); this.state.sidebarVisible = !this.customizationManager.isSidebarHidden();
    this.collapseHeader(!this.state.headerVisible); this.collapseSidebar(!this.state.sidebarVisible);
  }

  public reapplyDashboardSettings(): void { if (this.customizationManager) { this.applyDashboardUISettings(); if (!this.headerElement) setTimeout(() => this.applyDashboardUISettings(), 500); } }

  private restoreOriginalUIState(): void {
    if (!this.originalState) return;
    if (!this.originalState.headerVisible || !this.state.headerVisible) { this.state.headerVisible = true; this.collapseHeader(false); }
    if (!this.originalState.sidebarVisible || !this.state.sidebarVisible) { this.lastSidebarState = null; this.state.sidebarVisible = true; this.collapseSidebar(false); }
  }

  public cleanup(): void {
    this.listenerSetup = false; this.lastSidebarState = null;
    if (this.restoreTimeout !== null) { clearTimeout(this.restoreTimeout); this.restoreTimeout = null; }
    if (this.dashboardStateManager && this.dashboardStateListener) { this.dashboardStateManager.removeListener(this.dashboardStateListener); this.dashboardStateListener = undefined; }
    this.dashboardStateManager = null; this.restoreOriginalUIState();
  }

  public static resetInstance(): void { if (HomeAssistantUIManager.instance) { HomeAssistantUIManager.instance.cleanup(); HomeAssistantUIManager.instance.collapseHeader(false); HomeAssistantUIManager.instance.collapseSidebar(false); HomeAssistantUIManager.instance = null; } }
}
