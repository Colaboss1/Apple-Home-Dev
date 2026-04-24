import { DashboardConfig, DeviceGroup } from '../config/DashboardConfig';
import { EntityState } from '../types/types';
import { localize } from '../utils/LocalizationService';
import { RTLHelper } from '../utils/RTLHelper';
import { EnergySection } from './EnergySection';

export interface ChipConfig { group: DeviceGroup; enabled: boolean; show_when_zero?: boolean; navigation_path?: string; }
export interface ChipsConfig { climate?: ChipConfig; lights?: ChipConfig; security?: ChipConfig; media?: ChipConfig; water?: ChipConfig; energy?: ChipConfig; }
export interface ChipData { group: DeviceGroup; icon: string; groupName: string; statusText: string; iconColor: string; backgroundColor: string; textColor: string; enabled: boolean; navigationPath?: string; }

export class AppleChips {
  private config?: ChipsConfig;
  private _hass?: any;
  private chips: ChipData[] = [];
  private activeGroup?: DeviceGroup;
  private container?: HTMLElement;
  private lastRenderedHash?: string;
  private editMode: boolean = false;
  private customizationManager?: any;
  private onRenderCallback?: () => void;
  private statusTextCache = new Map<string, string>();
  private showSwitches: boolean = false;
  private includedSwitches: string[] = [];

  constructor(container: HTMLElement, customizationManager?: any) { this.container = container; this.customizationManager = customizationManager; this.updateSettings(); }

  private async updateSettings() { if (this.customizationManager) { this.showSwitches = await this.customizationManager.getShowSwitches() || false; this.includedSwitches = await this.customizationManager.getIncludedSwitches() || []; } }
  private getHiddenSections(): string[] { return this.customizationManager?.getHiddenSections() || []; }

  private getEntityAreaId(eid: string): string | null {
    if (!this._hass) return null; const reg = this._hass.entities?.[eid]; if (reg?.area_id) return reg.area_id;
    if (reg?.device_id) { const dev = this._hass.devices?.[reg.device_id]; if (dev?.area_id) return dev.area_id; }
    return 'no_area';
  }

  private isEntityInHiddenArea(eid: string): boolean {
    const hidden = this.getHiddenSections(); if (hidden.length === 0) return false;
    const aid = this.getEntityAreaId(eid); return aid ? hidden.includes(aid) : false;
  }

  static getDefaultConfig(): ChipsConfig { return { climate: { group: DeviceGroup.CLIMATE, enabled: true, show_when_zero: true }, lights: { group: DeviceGroup.LIGHTING, enabled: true, show_when_zero: true }, security: { group: DeviceGroup.SECURITY, enabled: true, show_when_zero: true }, media: { group: DeviceGroup.MEDIA, enabled: true, show_when_zero: true }, water: { group: DeviceGroup.WATER, enabled: false, show_when_zero: false }, energy: { group: DeviceGroup.ENERGY, enabled: true, show_when_zero: false } }; }

  setConfig(config: ChipsConfig) { this.config = { ...AppleChips.getDefaultConfig(), ...config }; this.updateSettings(); if (this._hass) this.render(); }

  set hass(hass: any) {
    if (hass && this._hass && this.hasRelevantEntityChanges(hass)) { this._hass = hass; if (this.config) this.render(); }
    else if (!this._hass) { this._hass = hass; if (this.config) this.render(); }
    else this._hass = hass;
  }

  private static readonly RELEVANT_DOMAINS = new Set(['light', 'switch', 'climate', 'alarm_control_panel', 'lock', 'media_player', 'water_heater']);
  private static readonly WATER_KEYWORDS = ['water', 'leak', 'flood'];

  private hasRelevantEntityChanges(newHass: any): boolean {
    if (!this._hass || !this.config) return true;
    for (const eid of Object.keys(newHass.states)) {
      const dom = eid.substring(0, eid.indexOf('.'));
      if (!AppleChips.RELEVANT_DOMAINS.has(dom)) { if (dom !== 'binary_sensor' && dom !== 'sensor') continue; if (!AppleChips.WATER_KEYWORDS.some(kw => eid.includes(kw)) && newHass.states[eid]?.attributes?.device_class !== 'moisture' && (dom !== 'sensor' || newHass.states[eid]?.attributes?.device_class !== 'power')) continue; }
      const old = this._hass.states[eid], cur = newHass.states[eid]; if (!old || !cur || old.state !== cur.state) return true;
      if ((dom === 'climate' || dom === 'water_heater') && old.attributes?.current_temperature !== cur.attributes?.current_temperature) return true;
    }
    return false;
  }

  get hass() { return this._hass; }
  isConfigured(): boolean { return !!this.config; }
  getConfig(): ChipsConfig | undefined { return this.config; }
  getActiveGroup(): DeviceGroup | undefined { return this.activeGroup; }
  setActiveGroup(group: DeviceGroup | undefined) { this.activeGroup = group; if (this._hass && this.config) this.render(); }
  setEditMode(editMode: boolean) { this.editMode = editMode; if (this._hass && this.config) this.render(); }
  setOnRenderCallback(callback: () => void) { this.onRenderCallback = callback; }
  getEditMode(): boolean { return this.editMode; }

  applySavedChipsOrder(chips: ChipData[]): ChipData[] {
    if (!this.customizationManager) return chips; const saved = this.customizationManager.getSavedChipsOrder(); if (saved.length === 0) return chips;
    const map = new Map(chips.map(c => [c.group, c])), ordered: ChipData[] = [], used = new Set();
    saved.forEach((g: string) => { if (map.has(g)) { ordered.push(map.get(g)!); used.add(g); } });
    chips.forEach(c => { if (!used.has(c.group)) ordered.push(c); }); return ordered;
  }

  private render() {
    if (!this._hass || !this.config || !this.container) return; this.updateChipData();
    if (this.chips.length === 0) { this.container.innerHTML = ''; this.lastRenderedHash = ''; return; }
    const hash = JSON.stringify({ chips: this.chips.map(c => ({ group: c.group, statusText: c.statusText })), activeGroup: this.activeGroup, editMode: this.editMode });
    if (this.lastRenderedHash === hash) return;
    this.container.innerHTML = this.generateHTML(); this.attachEventListeners(); this.lastRenderedHash = hash;
    if (this.onRenderCallback) this.onRenderCallback();
  }

  private updateChipData() {
    if (!this._hass || !this.config) return; this.chips = [];
    const all = Object.values(this._hass.states).filter((e: any) => { const reg = this._hass.entities?.[e.entity_id]; if (reg && (reg.hidden_by || reg.disabled_by || reg.entity_category === 'config' || reg.entity_category === 'diagnostic')) return false; return !this.isEntityInHiddenArea(e.entity_id); }) as EntityState[];
    const groups = [{ g: DeviceGroup.CLIMATE, c: this.config.climate }, { g: DeviceGroup.LIGHTING, c: this.config.lights }, { g: DeviceGroup.SECURITY, c: this.config.security }, { g: DeviceGroup.MEDIA, c: this.config.media }, { g: DeviceGroup.WATER, c: this.config.water }, { g: DeviceGroup.ENERGY, c: this.config.energy }];
    for (const { g, c } of groups) {
      if (!c?.enabled) continue;
      const ents = all.filter(e => { const dom = e.entity_id.split('.')[0], s = this._hass?.states[e.entity_id]; if (dom === 'switch') { if (this.showSwitches) return DashboardConfig.getDeviceGroup(dom, e.entity_id, s?.attributes, true) === g; const isOutlet = DashboardConfig.isOutlet(e.entity_id, s?.attributes), isInc = this.includedSwitches.includes(e.entity_id); return (isOutlet || isInc) ? DashboardConfig.getDeviceGroup(dom, e.entity_id, s?.attributes, true) === g : false; } return DashboardConfig.getDeviceGroup(dom, e.entity_id, s?.attributes, this.showSwitches) === g; });
      if (g === DeviceGroup.WATER) ents.push(...all.filter(e => e.entity_id.includes('water') || e.entity_id.includes('leak') || e.entity_id.includes('flood') || e.attributes.device_class === 'moisture'));
      if (ents.length > 0 || (g === DeviceGroup.ENERGY && EnergySection.hasEnergySensors(this._hass))) {
        const style = DashboardConfig.getGroupStyle(g), inactive = DashboardConfig.getEntityData({ entity_id: 'light.dummy', state: 'off', attributes: {} } as EntityState, 'light', false);
        this.chips.push({ group: g, icon: style.icon, groupName: typeof style.name === 'function' ? style.name() : style.name, statusText: this.getGroupStatusText(g, ents), iconColor: style.iconColor, backgroundColor: inactive.backgroundColor, textColor: '#ffffff', enabled: c.enabled, navigationPath: c.navigation_path || g });
      }
    }
    this.chips = this.applySavedChipsOrder(this.chips);
  }

  private generateHTML(): string {
    const style = DashboardConfig.getGroupStyle(DeviceGroup.MEDIA);
    return `<style>:host{--media-active-icon-color:${style.activeIconColor || style.iconColor};--chip-background-color:var(--apple-chip-bg-inactive,rgba(0,0,0,.35))}.apple-chips-section{display:block;margin-top:8px;width:100%}.chips-carousel-container{overflow-x:auto;overflow-y:hidden;margin-inline-start:calc(-1*var(--apple-page-padding,22px));margin-inline-end:calc(-1*var(--apple-page-padding,22px));-webkit-overflow-scrolling:touch;scrollbar-width:none;-ms-overflow-style:none}.chips-carousel-container::-webkit-scrollbar{display:none}.chips-grid{display:inline-flex;gap:10px;align-items:center;padding-inline-start:var(--apple-page-padding,22px);padding-inline-end:var(--apple-page-padding,22px);min-width:100%;box-sizing:border-box;height:44px}.chips-carousel-container.rtl{direction:rtl}.chips-carousel-container.ltr{direction:ltr}.chip-wrapper{flex-shrink:0;position:relative}.chip-wrapper.edit-mode{animation:apple-home-shake .25s linear infinite;touch-action:none}.chip-wrapper.drag-placeholder{background:transparent!important;border:none!important;opacity:1;pointer-events:none;display:flex;align-items:center;min-height:var(--apple-chip-height,32px)}.chip{display:flex;align-items:center;gap:var(--apple-chip-gap,8px);padding:var(--apple-chip-padding,6px 16px 6px 6px);border-radius:50px;background:var(--chip-background-color);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif;cursor:pointer;transition:background-color .2s ease,opacity .2s ease;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;min-height:var(--apple-chip-height,32px);white-space:nowrap;position:relative;transform:scale(1)}.chip:active{transform:scale(.95);opacity:.8;transition:transform .1s cubic-bezier(.4,0,.2,1),opacity .1s cubic-bezier(.4,0,.2,1)}.chips-carousel-container.rtl .chip{padding:3px 8px 3px 16px}.chip-wrapper:not(.dragging){transition:transform .3s cubic-bezier(.4,0,.2,1)}.chip-wrapper.dragging{animation:none!important}.chip.active{background:var(--apple-chip-bg-active,rgba(255,255,255,.9))!important;backdrop-filter:none;-webkit-backdrop-filter:none}.chip.active .chip-group-name{color:var(--apple-text-active,#1f1f1f)!important}.chip.active .chip-status{color:rgba(31,31,31,.7)!important}.chip.active[data-group="media"] .chip-icon,.chip.active[data-group="media"] .chip-icon ha-icon{color:var(--media-active-icon-color)!important}.chip-icon{width:var(--apple-chip-icon-size,26px);height:var(--apple-chip-icon-size,26px);display:flex;align-items:center;justify-content:center;align-self:center;background-color:var(--chip-icon-color);color:#fff;border-radius:50%;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,.1)}.chip-icon ha-icon{width:16px;height:16px;--mdc-icon-size:16px;color:#fff;display:flex;align-items:center;justify-content:center}.chip-content{display:flex;flex-direction:column;gap:0}.chip-group-name{font-size:var(--apple-chip-name-size,13px);font-weight:600;color:#fff;line-height:1.2;letter-spacing:-.2px}.chip-status{font-size:var(--apple-chip-status-size,11px);font-weight:500;color:rgba(255,255,255,.7);line-height:1.2}@media (max-width:479px){.chips-grid{gap:var(--apple-chip-gap,8px)}.chip{padding:var(--apple-chip-padding,4px 14px 4px 8px);min-height:var(--apple-chip-height,32px)}.chip-icon{width:var(--apple-chip-icon-size,20px);height:var(--apple-chip-icon-size,20px)}.chip-icon ha-icon{width:var(--apple-chip-icon-size,20px);height:var(--apple-chip-icon-size,20px);--mdc-icon-size:var(--apple-chip-icon-size,20px)}.chip-group-name{font-size:var(--apple-chip-name-size,13px)}.chip-status{font-size:var(--apple-chip-status-size,11px)}}@media (max-width:359px){.chips-grid{gap:6px}.chip{padding:3px 12px 3px 6px;min-height:30px;gap:6px}.chip-icon{width:var(--apple-chip-icon-size,18px);height:var(--apple-chip-icon-size,18px)}.chip-icon ha-icon{width:var(--apple-chip-icon-size,18px);height:var(--apple-chip-icon-size,18px);--mdc-icon-size:var(--apple-chip-icon-size,18px)}.chip-group-name{font-size:var(--apple-chip-name-size,12px)}.chip-status{font-size:10px}}@media (max-width:479px){.chips-carousel-container.rtl .chip{padding:4px 8px 4px 14px}}@media (max-width:359px){.chips-carousel-container.rtl .chip{padding:3px 6px 3px 12px}}@media (prefers-reduced-motion:reduce){.chip-wrapper.edit-mode{animation:none!important}.chip,.chip-wrapper{transition:none!important}}@keyframes apple-home-shake{0%{transform:translate(0,0) rotate(0deg)}25%{transform:translate(-.5px,.5px) rotate(-.5deg)}50%{transform:translate(.5px,-.2px) rotate(.5deg)}75%{transform:translate(.5px,.5px) rotate(-.5deg)}100%{transform:translate(0,0) rotate(0deg)}}.chip-wrapper.edit-mode:nth-child(even){animation-duration:.25s;animation-delay:-.1s}.chip-wrapper.edit-mode:nth-child(odd){animation-duration:.27s;animation-delay:-.2s}.chip-wrapper.edit-mode:nth-child(3n){animation-duration:.23s;animation-delay:-.15s}</style><div class="apple-chips-section"><div class="chips-carousel-container ${RTLHelper.isRTL() ? 'rtl' : 'ltr'}"><div class="chips-grid" data-area-id="chips" data-section-type="chips">${this.chips.map(c => `<div class="chip-wrapper ${this.editMode ? 'edit-mode' : ''}" data-entity-id="${c.group}" data-chip-id="${c.group}"><div class="chip ${c.group === this.activeGroup ? 'active' : ''}" data-group="${c.group}" style="--chip-background-color:${c.backgroundColor};--chip-icon-color:${c.iconColor};"${c.navigationPath ? ` data-navigation="${c.navigationPath}"` : ''}><div class="chip-icon"><ha-icon icon="${c.icon}"></ha-icon></div><div class="chip-content"><span class="chip-group-name">${c.groupName}</span><span class="chip-status">${c.statusText}</span></div></div></div>`).join('')}</div></div></div>`;
  }

  private attachEventListeners() { if (this.container) this.container.querySelectorAll('.chip').forEach((c: any) => c.addEventListener('click', this.handleChipClick.bind(this))); }
  clearContainer() { if (this.container) { this.container.innerHTML = ''; this.lastRenderedHash = ''; this.statusTextCache.clear(); } }

  private handleChipClick(e: Event) {
    if (this.editMode) { e.preventDefault(); e.stopPropagation(); return; }
    const c = e.currentTarget as HTMLElement, g = c.dataset.group as DeviceGroup, n = c.dataset.navigation; if (!g && !n) return;
    if (g === this.activeGroup) { this.navigateToPath('home'); return; }
    const target = n || g; if (target?.trim()) this.navigateToPath(target);
  }

  private navigateToPath(p: string) {
    if (!p?.trim()) return; const cur = window.location.pathname; let base = '';
    if (cur.startsWith('/lovelace/') || cur === '/lovelace') base = '/lovelace/'; else { const parts = cur.split('/').filter(x => x.length > 0); base = parts.length > 0 ? `/${parts[0]}/` : '/lovelace/'; }
    const url = `${base}${p.startsWith('/') ? p.slice(1) : p}`; if (url.includes('/config/') && !base.includes('/config/')) return;
    window.history.pushState(null, '', url); window.dispatchEvent(new Event('location-changed', { bubbles: true, composed: true }));
  }

  private getGroupStatusText(g: DeviceGroup, ents: EntityState[]): string {
    const key = `${g}:${ents.map(e => `${e.entity_id}:${e.state}:${e.attributes?.current_temperature || ''}`).join(';')}`;
    if (this.statusTextCache.has(key)) return this.statusTextCache.get(key)!;
    let txt: string;
    switch (g) {
      case DeviceGroup.LIGHTING: const onL = ents.filter(e => e.state === 'on'); txt = onL.length > 0 ? `${onL.length} ${localize('status.on')}` : localize('status.off'); break;
      case DeviceGroup.CLIMATE: const cEnts = ents.filter(e => e.entity_id.startsWith('climate.') || e.entity_id.startsWith('water_heater.')); txt = '--°'; if (cEnts.length > 0) { const temps = cEnts.map(e => e.attributes.current_temperature).filter(t => t != null).sort((a, b) => a - b); if (temps.length > 0) { const min = Math.round(temps[0]), max = Math.round(temps[temps.length - 1]); txt = temps.length === 1 ? `${min}°` : `${min}-${max}°`; } } break;
      case DeviceGroup.SECURITY: const armed = ents.filter(e => e.entity_id.startsWith('alarm_control_panel.') && (e.state === 'armed_away' || e.state === 'armed_home')), unl = ents.filter(e => e.entity_id.startsWith('lock.') && e.state === 'unlocked'); if (armed.length > 0 && unl.length > 0) txt = `${localize('status.armed')}, ${unl.length} ${localize('status.unlocked')}`; else if (armed.length > 0) txt = localize('status.armed'); else if (unl.length > 0) txt = `${unl.length} ${localize('status.unlocked')}`; else txt = localize('chip_status.secure'); break;
      case DeviceGroup.MEDIA: const pl = ents.filter(e => e.state === 'playing'), tvOn = ents.filter(e => (e.attributes.device_class === 'tv' || e.entity_id.includes('tv') || e.attributes.source_list) && e.state === 'on'); if (pl.length > 0) txt = `${pl.length} ${localize('status.playing')}`; else if (tvOn.length > 0) txt = `${tvOn.length} ${tvOn.length > 1 ? localize('chip_status.tvs') : localize('chip_status.tv')} ${localize('status.on')}`; else txt = localize('status.off'); break;
      case DeviceGroup.WATER: const actW = ents.filter(e => e.state === 'on' || e.state === 'detected'); txt = actW.length > 0 ? `${actW.length} ${localize('chip_status.active')}` : localize('status.off'); break;
      case DeviceGroup.ENERGY: const pwr = EnergySection.getTotalPower(this._hass); txt = pwr !== null ? (pwr >= 1000 ? `${(pwr / 1000).toFixed(1)} kW` : `${Math.round(pwr)} W`) : localize('energy.active'); break;
      default: txt = localize('status.off'); break;
    }
    if (this.statusTextCache.size > 20) this.statusTextCache.delete(this.statusTextCache.keys().next().value);
    this.statusTextCache.set(key, txt); return txt;
  }
}
