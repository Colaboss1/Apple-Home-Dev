export class DashboardStateManager {
  private static instance: DashboardStateManager | null = null;
  private isActive = false;
  private registeredDashboardKeys: Set<string> = new Set();
  private currentDashboardKey: string | null = null;
  private listeners: Set<(isActive: boolean, dashboardKey: string | null) => void> = new Set();
  private navigationListenersSetup = false;
  private lastProcessedPath: string = '';

  private constructor() { this.setupNavigationListeners(); }

  static getInstance(): DashboardStateManager { if (!DashboardStateManager.instance) DashboardStateManager.instance = new DashboardStateManager(); return DashboardStateManager.instance; }

  registerDashboard(key: string): void { this.registeredDashboardKeys.add(key); const cur = this.extractDashboardKey(window.location.pathname); if (cur === key) this.setDashboardActive(key); }
  unregisterDashboard(key: string): void { this.registeredDashboardKeys.delete(key); if (this.currentDashboardKey === key) this.setDashboardInactive(); }
  addListener(cb: (isActive: boolean, dashboardKey?: string | null) => void): void { this.listeners.add(cb); }
  removeListener(cb: (isActive: boolean, dashboardKey?: string | null) => void): void { this.listeners.delete(cb); }
  isDashboardActive(): boolean { return this.isActive; }
  getCurrentDashboardKey(): string | null { return this.currentDashboardKey; }
  getRegisteredDashboardKeys(): string[] { return Array.from(this.registeredDashboardKeys); }

  private extractDashboardKey(path: string): string | null {
    const m = path.match(/^\/([^\/]+)/); if (!m) return null; const k = m[1];
    if (['config', 'developer-tools', 'hacs', 'dev-tools', 'api', 'logbook', 'history', 'profile', 'media-browser', 'energy', 'map', 'todo', 'calendar', 'auth', '_my_redirect'].includes(k)) return null;
    return k;
  }

  private isCurrentUrlInAppleHomeDashboard(): { isInDashboard: boolean; dashboardKey: string | null } {
    const k = this.extractDashboardKey(window.location.pathname);
    return (k && this.registeredDashboardKeys.has(k)) ? { isInDashboard: true, dashboardKey: k } : { isInDashboard: false, dashboardKey: null };
  }

  setDashboardActive(key: string): void {
    const was = this.isActive, prev = this.currentDashboardKey; this.isActive = true; this.currentDashboardKey = key;
    if (!was || prev !== key) this.notifyListeners(true, key);
  }

  setDashboardInactive(): void { const was = this.isActive; this.isActive = false; this.currentDashboardKey = null; if (was) this.notifyListeners(false, null); }

  private setupNavigationListeners(): void {
    if (this.navigationListenersSetup) return; this.navigationListenersSetup = true;
    window.addEventListener('popstate', () => this.handleNavigationChange());
    window.addEventListener('hashchange', () => this.handleNavigationChange());
    if (!(window as any).__appleHomeDashboardHistoryIntercepted) {
      (window as any).__appleHomeDashboardHistoryIntercepted = true;
      const p = history.pushState, r = history.replaceState;
      history.pushState = function(...args) { p.apply(history, args); setTimeout(() => DashboardStateManager.getInstance().handleNavigationChange(), 0); };
      history.replaceState = function(...args) { r.apply(history, args); setTimeout(() => DashboardStateManager.getInstance().handleNavigationChange(), 0); };
    }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(() => this.handleNavigationChange(), 50); });
  }

  handleNavigationChange(): void {
    const p = window.location.pathname; if (p === this.lastProcessedPath) return; this.lastProcessedPath = p;
    const { isInDashboard, dashboardKey } = this.isCurrentUrlInAppleHomeDashboard();
    if (isInDashboard && dashboardKey) this.setDashboardActive(dashboardKey); else if (this.isActive) this.setDashboardInactive();
  }

  checkCurrentState(): void { this.handleNavigationChange(); }

  private notifyListeners(active: boolean, key: string | null): void { this.listeners.forEach(cb => { try { cb(active, key); } catch {} }); }
  destroy(): void { this.listeners.clear(); this.registeredDashboardKeys.clear(); this.currentDashboardKey = null; this.isActive = false; DashboardStateManager.instance = null; }
}
