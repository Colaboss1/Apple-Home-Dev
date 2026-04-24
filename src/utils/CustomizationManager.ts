import { DashboardConfig } from '../config/DashboardConfig';
import { localize } from './LocalizationService';
import { DashboardStateManager } from './DashboardStateManager';

interface CustomizationStructure { home: Record<string, any>; pages: Record<string, any>; ui: Record<string, any>; background: Record<string, any>; }

export class CustomizationManager {
  private static instance: CustomizationManager | null = null;
  private customizations: any = { home: {}, pages: {}, ui: {}, background: {} };
  private _hass?: any;
  private isLoaded = false;
  private currentDashboardKey: string | null = null;
  private dashboardStateListener?: (isActive: boolean, dashboardKey?: string | null) => void;
  private saveQueue: Promise<any> = Promise.resolve();
  private isSaving = false;

  constructor(hass?: any) {
    this._hass = hass;
    this.dashboardStateListener = async (active: boolean, key?: string | null) => {
      if (active && this._hass && key) {
        if (this.currentDashboardKey !== key || !this.isLoaded) { try { this.currentDashboardKey = key; await this.setCustomizations(await this.loadCustomizations()); this.triggerGlobalDashboardRefresh(); } catch {} }
      } else if (!active) this.currentDashboardKey = null;
    };
    DashboardStateManager.getInstance().addListener(this.dashboardStateListener);
  }

  static getInstance(hass?: any): CustomizationManager { if (!CustomizationManager.instance) CustomizationManager.instance = new CustomizationManager(hass); if (hass && !CustomizationManager.instance._hass) CustomizationManager.instance._hass = hass; return CustomizationManager.instance; }
  async setCustomizations(c: any) { this.customizations = JSON.parse(JSON.stringify(this.migrateToNewStructure(c || {}))); this.isLoaded = true; }

  private migrateToNewStructure(old: any): any {
    if (!old || typeof old !== 'object') return { home: {}, pages: {}, ui: { hide_header: false, hide_sidebar: false, mobile_view: false, ipad_mode: false }, background: {} };
    if (old.home || old.pages) return { home: old.home || {}, pages: old.pages || {}, ui: old.ui || {}, background: old.background || {} };
    const n: any = { home: { excluded_from_dashboard: old.areas?.excludedFromDashboard || [], excluded_from_home: old.areas?.excludedFromHome || [], sections: { order: old.areas?.sectionsOrder || [], hidden: old.areas?.hiddenSections || [] }, favorites: old.areas?.favoriteAccessories || old.areas?.favorites || [], chips_order: old.areas?.chipsOrder || old.areas?.chips_order || [], tall_cards: old.entities?.tallCards || old.entities?.tall_cards || [], entities_order: {} as any }, pages: {} as any, ui: { hide_header: old.ui?.hideHeader || old.ui?.hide_header || false, hide_sidebar: old.ui?.hideSidebar || old.ui?.hide_sidebar || false, mobile_view: old.ui?.mobile_view || false, ipad_mode: old.ui?.ipad_mode || false }, background: old.background || { type: 'preset', value: 'default' } };
    if (old.entities) {
      Object.keys(old.entities).forEach(aid => {
        const d = old.entities[aid]; if (d.cardOrder) n.home.entities_order[aid] = d.cardOrder; if (d.camerasOrder) n.home.entities_order.cameras = d.camerasOrder; if (d.scenesOrder) n.home.entities_order.scenes = d.scenesOrder;
        if (d.cardOrder_room || d.lightingOrder || d.climateOrder || d.securityOrder || d.mediaOrder) { n.pages[aid] = {}; if (d.cardOrder_room) n.pages[aid].order = d.cardOrder_room; if (d.lightingOrder) n.pages[aid].lighting_order = d.lightingOrder; if (d.climateOrder) n.pages[aid].climate_order = d.climateOrder; if (d.securityOrder) n.pages[aid].security_order = d.securityOrder; if (d.mediaOrder) n.pages[aid].media_order = d.mediaOrder; if (d.tallCards || d.tall_cards) n.pages[aid].tall_cards = d.tallCards || d.tall_cards; }
      });
    } return n;
  }

  async ensureCustomizationsLoaded(): Promise<void> { if (!this.isLoaded && this._hass) await this.setCustomizations(await this.loadCustomizations()); }
  getCustomizations() { return this.customizations; }
  setHass(hass: any) { this._hass = hass; }
  async saveCardOrder(aid: string, ord: string[], dom?: string) { await this.saveCardOrderWithContext(aid, ord, 'home', dom); }

  async saveCardOrderWithContext(aid: string, ord: string[], ctx: string = 'home', dom?: string) {
    if (ctx === 'home') { const h = this.getCustomization('home'); if (!h.entities_order) h.entities_order = {}; h.entities_order[aid] = ord; await this.setCustomization('home', h); }
    else if (ctx === 'cameras') { const p = this.getCustomization('pages'); if (!p.cameras) p.cameras = {}; p.cameras.order = ord; await this.setCustomization('pages', p); }
    else if (ctx === 'scenes') { const p = this.getCustomization('pages'); if (!p.scenes) p.scenes = {}; p.scenes.order = ord; await this.setCustomization('pages', p); }
    else { const p = this.getCustomization('pages'); if (!p[aid]) p[aid] = {}; if (dom) p[aid][`${dom.toLowerCase()}_order`] = ord; else p[aid].order = ord; await this.setCustomization('pages', p); }
  }

  getSavedCardOrder(aid: string, dom?: string): string[] { return this.getSavedCardOrderWithContext(aid, 'home', dom); }

  getSavedCardOrderWithContext(aid: string, ctx: string = 'home', dom?: string): string[] {
    if (ctx === 'home') return this.getCustomization('home').entities_order?.[aid] || [];
    if (ctx === 'cameras') return this.getCustomization('pages').cameras?.order || [];
    if (ctx === 'scenes') return this.getCustomization('pages').scenes?.order || [];
    const p = this.getCustomization('pages'); return dom ? p[aid]?.[`${dom.toLowerCase()}_order`] || [] : p[aid]?.order || [];
  }

  applySavedCardOrder(cards: any[], ord: string[]): any[] {
    const map = new Map(cards.map(c => [c.entity || c.entity_id, c])), res: any[] = [], used = new Set();
    ord.forEach(id => { if (map.has(id)) { res.push(map.get(id)); used.add(id); } });
    cards.forEach(c => { const id = c.entity || c.entity_id; if (id && !used.has(id)) res.push(c); }); return res;
  }

  async saveCustomizations() {
    if (!this._hass) return;
    this.saveQueue = this.saveQueue.then(async () => { this.isSaving = true; try { await this.saveCustomizationsToStorage(this._hass, this.customizations); } catch {} finally { this.isSaving = false; } });
    return this.saveQueue;
  }

  triggerGlobalDashboardRefresh() { const e = new CustomEvent('apple-home-dashboard-refresh', { detail: { customizations: this.customizations, timestamp: Date.now() }, bubbles: true, composed: true }); document.dispatchEvent(e); window.dispatchEvent(e); }

  async loadCustomizations(): Promise<any> {
    if (!this._hass) return { home: {}, pages: {}, ui: {}, background: {} };
    try { const res = await this._hass.callWS({ type: 'lovelace/config', url_path: await this.getCurrentDashboardKey(this._hass) }); return res?.customizations || { home: {}, pages: {}, ui: {}, background: {} }; }
    catch { return { home: {}, pages: {}, ui: {}, background: {} }; }
  }

  private async saveCustomizationsToStorage(hass: any, c: any): Promise<boolean> {
    try {
      const key = await this.getCurrentDashboardKey(hass), cfg = await hass.callWS({ type: 'lovelace/config', url_path: key });
      await hass.callWS({ type: 'lovelace/config/save', url_path: key, config: { ...cfg, customizations: c } });
      this.hideNotificationAfterSave(); return true;
    } catch { return false; }
  }

  private hideNotificationAfterSave(): void {
    const dis = () => { const ha = document.querySelector("home-assistant")?.shadowRoot?.querySelector("notification-manager")?.shadowRoot, t = ha?.querySelector("ha-toast") as any; if (t?.close) { t.close(); return true; } return false; };
    if (dis()) return; let a = 0; const i = setInterval(() => { if (dis() || ++a > 50) clearInterval(i); }, 100);
  }

  private async getCurrentDashboardKey(hass: any): Promise<string | null> {
    try { const m = window.location.pathname.match(/\/([^\/]+)/); return (m && m[1] !== 'lovelace') ? m[1] : null; }
    catch { return null; }
  }

  getComponentDashboardKey(): string { const m = window.location.pathname.match(/\/([^\/]+)/); return m ? m[1] : 'default'; }
  async saveCurrentLayout() { if (this._hass) try { await this.saveCustomizationsToStorage(this._hass, this.customizations); } catch { return { success: false, message: localize('errors.error_saving_layout') }; } }
  async saveLayoutToStorage(hass: any) { try { await this.saveCustomizationsToStorage(hass, this.customizations); } catch (e) { throw e; } }
  async updateCarouselOrder(aid: string, type: string, ord: string[]) { await this.updateCarouselOrderWithContext(aid, type, ord, 'home'); }

  async updateCarouselOrderWithContext(aid: string, type: string, ord: string[], ctx: string = 'home') {
    if (ctx === 'home') { const h = this.getCustomization('home'); if (!h.entities_order) h.entities_order = {}; h.entities_order[aid.replace('_section', '')] = ord; await this.setCustomization('home', h); }
    else if (ctx === 'cameras') { const p = this.getCustomization('pages'); if (!p.cameras) p.cameras = {}; p.cameras.order = ord; await this.setCustomization('pages', p); }
    else if (ctx === 'scenes') { const p = this.getCustomization('pages'); if (!p.scenes) p.scenes = {}; p.scenes.order = ord; await this.setCustomization('pages', p); }
    else { const p = this.getCustomization('pages'); if (!p[aid]) p[aid] = {}; p[aid].order = ord; await this.setCustomization('pages', p); }
  }

  getSavedCarouselOrder(aid: string, type: string): string[] { return this.getSavedCarouselOrderWithContext(aid, type, 'home'); }

  getSavedCarouselOrderWithContext(aid: string, type: string, ctx: string = 'home'): string[] {
    if (ctx === 'home') return this.getCustomization('home').entities_order?.[aid.replace('_section', '')] || [];
    if (ctx === 'cameras') return this.getCustomization('pages').cameras?.order || [];
    if (ctx === 'scenes') return this.getCustomization('pages').scenes?.order || [];
    return this.getCustomization('pages')[aid]?.order || [];
  }

  async saveSectionOrder(ord: string[]) { const h = this.getCustomization('home'); if (!h.sections) h.sections = {}; h.sections.order = ord; await this.setCustomization('home', h); }
  getSavedSectionOrder(): string[] { return this.getCustomization('home').sections?.order || []; }
  async saveHiddenSections(hid: string[]) { const h = this.getCustomization('home'); if (!h.sections) h.sections = {}; h.sections.hidden = hid; await this.setCustomization('home', h); }
  getHiddenSections(): string[] { return this.getCustomization('home').sections?.hidden || []; }
  isSectionVisible(sid: string): boolean { return !this.getHiddenSections().includes(sid); }
  async saveChipsOrder(ord: string[]) { const h = this.getCustomization('home'); h.chips_order = ord; await this.setCustomization('home', h); }
  getSavedChipsOrder(): string[] { return this.getCustomization('home').chips_order || []; }
  async getFavoriteAccessories(): Promise<string[]> { await this.ensureCustomizationsLoaded(); return this.getCustomization('home').favorites || []; }
  async getExcludedFromDashboard(): Promise<string[]> { await this.ensureCustomizationsLoaded(); return this.getCustomization('home').excluded_from_dashboard || []; }
  async getExcludedFromHome(): Promise<string[]> { await this.ensureCustomizationsLoaded(); return this.getCustomization('home').excluded_from_home || []; }
  async isEntityExcludedFromDashboard(eid: string): Promise<boolean> { return (await this.getExcludedFromDashboard()).includes(eid); }
  async isEntityExcludedFromHome(eid: string): Promise<boolean> { return (await this.getExcludedFromHome()).includes(eid); }

  async hideEntityFromHome(eid: string): Promise<void> {
    await this.ensureCustomizationsLoaded(); const h = this.getCustomization('home'); if (!h.excluded_from_home) h.excluded_from_home = [];
    if (!h.excluded_from_home.includes(eid)) { h.excluded_from_home.push(eid); await this.setCustomization('home', h); await this.saveCustomizations(); }
  }

  async hasFavoriteAccessories(): Promise<boolean> { return (await this.getFavoriteAccessories()).length > 0; }

  async removeFavorite(eid: string): Promise<void> {
    await this.ensureCustomizationsLoaded(); const h = this.getCustomization('home'); if (h.favorites?.includes(eid)) { h.favorites = h.favorites.filter((id: string) => id !== eid); await this.setCustomization('home', h); await this.saveCustomizations(); }
  }

  async getShowSwitches(): Promise<boolean> { await this.ensureCustomizationsLoaded(); return this.getCustomization('home').show_switches || false; }
  async getIncludedSwitches(): Promise<string[]> { await this.ensureCustomizationsLoaded(); return this.getCustomization('home').included_switches || []; }
  async getExtraAccessories(): Promise<string[]> { await this.ensureCustomizationsLoaded(); return this.getCustomization('home').extra_accessories || []; }
  async getWeatherEntity(): Promise<string | undefined> { await this.ensureCustomizationsLoaded(); return this.getCustomization('home').weather_entity || undefined; }
  async getShowEnergy(): Promise<boolean> { await this.ensureCustomizationsLoaded(); return this.getCustomization('home').show_energy || false; }
  setDashboardActive(a: boolean): void { this.currentDashboardKey = a ? this.extractDashboardKeyFromUrl() : null; }
  private extractDashboardKeyFromUrl(): string | null { const p = window.location.pathname, m = p.match(/^\/([^\/]+)/); return m ? m[1] : null; }
  isDashboardCurrentlyActive(): boolean { return DashboardStateManager.getInstance().isDashboardActive(); }
  getDashboardUrl(): string | null { return this.currentDashboardKey ? window.location.pathname : null; }
  isCurrentlyInDashboard(): boolean { return this.currentDashboardKey !== null; }
  getUISettings(): any { return this.customizations.ui || {}; }
  setUISettings(s: any): void { this.customizations = { ...this.customizations, ui: { ...s } }; }
  isHeaderHidden(): boolean { return this.getUISettings().hide_header === true; }
  isSidebarHidden(): boolean { return this.getUISettings().hide_sidebar === true; }
  isMobileViewActive(): boolean { return this.getUISettings().mobile_view === true; }
  isIpadModeActive(): boolean { return this.getUISettings().ipad_mode === true; }
  async setHeaderVisibility(h: boolean): Promise<void> { await this.ensureCustomizationsLoaded(); const s = this.getUISettings(); s.hide_header = h; this.setUISettings(s); await this.saveCustomizations(); }
  async setSidebarVisibility(h: boolean): Promise<void> { await this.ensureCustomizationsLoaded(); const s = this.getUISettings(); s.hide_sidebar = h; this.setUISettings(s); await this.saveCustomizations(); }
  async setMobileViewActive(a: boolean): Promise<void> { await this.ensureCustomizationsLoaded(); const s = this.getUISettings(); s.mobile_view = a; this.setUISettings(s); await this.saveCustomizations(); }
  async setIpadModeActive(a: boolean): Promise<void> { await this.ensureCustomizationsLoaded(); const s = this.getUISettings(); s.ipad_mode = a; this.setUISettings(s); await this.saveCustomizations(); }
  getCustomization(s: string): any { return this.customizations[s] || {}; }
  async setCustomization(s: string, o: any): Promise<void> { await this.ensureCustomizationsLoaded(); this.customizations = { ...this.customizations, [s]: o }; await this.saveCustomizations(); }

  async batchSetCustomizations(u: Record<string, any>): Promise<void> {
    await this.ensureCustomizationsLoaded(); for (const [s, d] of Object.entries(u)) this.customizations = { ...this.customizations, [s]: d }; await this.saveCustomizations();
  }

  setCustomizationLocal(s: string, o: any): void { this.customizations = { ...this.customizations, [s]: o }; }
  async updateCustomizationProperty(s: string, p: string, v: any): Promise<void> { const d = this.getCustomization(s); d[p] = v; await this.setCustomization(s, d); }

  static destroy(): void { if (CustomizationManager.instance) { if (CustomizationManager.instance.dashboardStateListener) { DashboardStateManager.getInstance().removeListener(CustomizationManager.instance.dashboardStateListener); CustomizationManager.instance.dashboardStateListener = undefined; } CustomizationManager.instance = null; } }
}
