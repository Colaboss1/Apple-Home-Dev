import { CustomizationManager } from './CustomizationManager';
import { DashboardConfig } from '../config/DashboardConfig';
import { localize } from './LocalizationService';
import { BackgroundManager } from './BackgroundManager';
import { HomeAssistantUIManager } from './HomeAssistantUIManager';
import { injectLiquidGlassStyles, LiquidGlassClasses } from './LiquidGlassStyles';

export interface HomeSettingsData { favoriteAccessories: string[]; excludedFromDashboard: string[]; excludedFromHome: string[]; includedSwitches: string[]; extraAccessories: string[]; weatherEntity?: string; backgroundType: 'preset' | 'custom'; customBackground?: string; presetBackground?: string; hideHeader?: boolean; hideSidebar?: boolean; showSwitches?: boolean; showEnergy?: boolean; }

export class HomeSettingsManager {
  private modal?: HTMLElement;
  private customizationManager: CustomizationManager;
  private onSaveCallback: () => void;
  private hass: any;
  private requiresRender: boolean = false;
  private settings: HomeSettingsData = { favoriteAccessories: [], excludedFromDashboard: [], excludedFromHome: [], includedSwitches: [], extraAccessories: [], weatherEntity: undefined, backgroundType: 'preset', presetBackground: BackgroundManager.DEFAULT_BACKGROUND, showSwitches: false, showEnergy: false };
  private tempSettings: HomeSettingsData = { favoriteAccessories: [], excludedFromDashboard: [], excludedFromHome: [], includedSwitches: [], extraAccessories: [], weatherEntity: undefined, backgroundType: 'preset', presetBackground: BackgroundManager.DEFAULT_BACKGROUND, showSwitches: false, showEnergy: false };
  private availableEntities: any[] = [];
  private allEntitiesForInclusion: any[] = [];

  constructor(cm: CustomizationManager, cb: () => void) { this.customizationManager = cm; this.onSaveCallback = cb; }

  public async showHomeSettingsModal(hass: any) { this.hass = hass; await this.loadSettings(); await this.loadAvailableEntities(); this.createModal(); this.setupEventListeners(); this.showModal(); }

  private async loadSettings() {
    await this.customizationManager.ensureCustomizationsLoaded();
    const c = this.customizationManager.getCustomizations(), bm = new BackgroundManager(this.customizationManager), cur = bm.getCurrentBackground();
    this.settings = { favoriteAccessories: c.home?.favorites || [], excludedFromDashboard: c.home?.excluded_from_dashboard || [], excludedFromHome: c.home?.excluded_from_home || [], includedSwitches: c.home?.included_switches || [], extraAccessories: c.home?.extra_accessories || [], weatherEntity: c.home?.weather_entity || undefined, backgroundType: cur.type, customBackground: cur.type === 'custom' ? cur.backgroundImage : undefined, presetBackground: cur.type === 'preset' ? cur.backgroundImage : BackgroundManager.DEFAULT_BACKGROUND, hideHeader: c.ui?.hide_header || false, hideSidebar: c.ui?.hide_sidebar || false, showSwitches: c.home?.show_switches || false, showEnergy: c.home?.show_energy || false };
    this.tempSettings = { ...this.settings, favoriteAccessories: [...this.settings.favoriteAccessories], excludedFromDashboard: [...this.settings.excludedFromDashboard], excludedFromHome: [...this.settings.excludedFromHome], includedSwitches: [...this.settings.includedSwitches], extraAccessories: [...this.settings.extraAccessories] };
  }

  private async loadAvailableEntities() {
    if (!this.hass) return;
    this.availableEntities = Object.values(this.hass.states).filter((s: any) => { const d = s.entity_id.split('.')[0], r = this.hass.entities?.[s.entity_id]; return DashboardConfig.isSupportedDomain(d) && !r?.hidden_by && !r?.disabled_by; }).map((s: any) => ({ entity_id: s.entity_id, friendly_name: s.attributes.friendly_name || s.entity_id, domain: s.entity_id.split('.')[0], state: s.state, attributes: s.attributes, area_id: s.attributes.area_id || null })).sort((a, b) => a.friendly_name.localeCompare(b.friendly_name));
    this.allEntitiesForInclusion = Object.values(this.hass.states).filter((s: any) => { const d = s.entity_id.split('.')[0], r = this.hass.entities?.[s.entity_id]; if (r?.hidden_by || r?.disabled_by || !s.state || ['unavailable', 'unknown'].includes(s.state.toLowerCase()) || DashboardConfig.isSupportedDomain(d)) return false; return !['automation', 'person', 'zone', 'device_tracker', 'sun', 'weather', 'persistent_notification', 'conversation', 'tts', 'stt', 'update', 'calendar', 'group', 'image', 'notify', 'number', 'select', 'text', 'time', 'date', 'datetime'].includes(d); }).map((s: any) => ({ entity_id: s.entity_id, friendly_name: s.attributes.friendly_name || s.entity_id, domain: s.entity_id.split('.')[0], state: s.state, attributes: s.attributes, area_id: s.attributes.area_id || null })).sort((a, b) => a.friendly_name.localeCompare(b.friendly_name));
  }

  private formatPresetName(p: string): string { return localize(`wallpaper_presets.${p}`) || (p.charAt(0).toUpperCase() + p.slice(1)); }

  private createModal() {
    this.modal = document.createElement('div'); this.modal.className = 'apple-home-settings-modal';
    this.modal.innerHTML = `<div class="modal-backdrop"></div><div class="modal-content"><div class="modal-header"><button class="modal-cancel ${LiquidGlassClasses.modalCancel}"><ha-icon icon="mdi:close"></ha-icon></button><h2>${localize('settings.title')}</h2><button class="modal-done ${LiquidGlassClasses.modalDone}"><ha-icon icon="mdi:check"></ha-icon><div class="save-spinner"></div></button></div><div class="modal-body">${this.renderSettingsContent()}</div></div>`;
    this.addModalStyles(); document.body.appendChild(this.modal);
  }

  private renderSettingsContent(): string {
    return `<div class="settings-section"><h3 class="settings-section-header">${localize('settings.favorite_accessories')}</h3><div class="settings-card"><div class="entity-selector" data-setting="favoriteAccessories"><div class="autocomplete-container"><input type="text" class="autocomplete-input" placeholder="${localize('settings.search_accessories')}"/><div class="autocomplete-results"></div></div><div class="selected-entities">${this.renderSelectedEntities(this.tempSettings.favoriteAccessories)}</div></div></div><p class="settings-section-description">${localize('settings.favorite_accessories_description')}</p></div><div class="settings-section"><h3 class="settings-section-header">${localize('settings.exclude_from_home')}</h3><div class="settings-card"><div class="entity-selector" data-setting="excludedFromHome"><div class="autocomplete-container"><input type="text" class="autocomplete-input" placeholder="${localize('settings.search_accessories')}"/><div class="autocomplete-results"></div></div><div class="selected-entities">${this.renderSelectedEntities(this.tempSettings.excludedFromHome)}</div></div></div><p class="settings-section-description">${localize('settings.exclude_from_home_description')}</p></div><div class="settings-section"><h3 class="settings-section-header">${localize('settings.exclude_from_dashboard')}</h3><div class="settings-card"><div class="entity-selector" data-setting="excludedFromDashboard"><div class="autocomplete-container"><input type="text" class="autocomplete-input" placeholder="${localize('settings.search_accessories')}"/><div class="autocomplete-results"></div></div><div class="selected-entities">${this.renderSelectedEntities(this.tempSettings.excludedFromDashboard)}</div></div></div><p class="settings-section-description">${localize('settings.exclude_from_dashboard_description')}</p></div><div class="settings-section"><div class="settings-card switch-card"><div class="switch-setting-row"><span class="option-text">${localize('settings.show_switches_cards')}</span><div class="ui-setting-toggle" id="switches-toggle"><div class="toggle-switch"></div></div></div></div><p class="settings-section-description">${localize('settings.show_switches_cards_description')}</p></div><div class="settings-section"><div class="settings-card switch-card"><div class="switch-setting-row"><span class="option-text">${localize('settings.show_energy')}</span><div class="ui-setting-toggle" id="energy-toggle"><div class="toggle-switch"></div></div></div></div><p class="settings-section-description">${localize('settings.show_energy_description')}</p></div><div class="settings-section" id="included-switches-section" style="display:${this.tempSettings.showSwitches?'none':'block'}"><h3 class="settings-section-header">${localize('settings.include_specific_switches')}</h3><div class="settings-card"><div class="entity-selector" data-setting="includedSwitches"><div class="autocomplete-container"><input type="text" class="autocomplete-input" placeholder="${localize('settings.search_switches')}"/><div class="autocomplete-results"></div></div><div class="selected-entities">${this.renderSelectedEntities(this.tempSettings.includedSwitches)}</div></div></div><p class="settings-section-description">${localize('settings.include_switches_description')}</p></div><div class="settings-section"><h3 class="settings-section-header">${localize('settings.extra_accessories')}</h3><div class="settings-card"><div class="entity-selector" data-setting="extraAccessories"><div class="autocomplete-container"><input type="text" class="autocomplete-input" placeholder="${localize('settings.search_entities')}"/><div class="autocomplete-results"></div></div><div class="selected-entities">${this.renderSelectedEntitiesForInclusion(this.tempSettings.extraAccessories)}</div></div></div><p class="settings-section-description">${localize('settings.extra_accessories_description')}</p></div><div class="settings-section"><h3 class="settings-section-header">${localize('settings.weather_entity')}</h3><div class="settings-card"><div class="entity-selector" data-setting="weatherEntity"><div class="autocomplete-container"><input type="text" class="autocomplete-input" placeholder="${localize('settings.search_weather_entity')}"/><div class="autocomplete-results"></div></div><div class="selected-entities">${this.renderSelectedWeatherEntity(this.tempSettings.weatherEntity)}</div></div></div><p class="settings-section-description">${localize('settings.weather_entity_description')}</p></div><div class="settings-section"><h3 class="settings-section-header">${localize('settings.home_wallpaper')}</h3><div class="settings-card"><div class="wallpaper-options"><div class="wallpaper-option-row" data-action="upload"><span class="option-text upload-text">${localize('settings.take_photo')}</span></div><div class="wallpaper-option-row" data-action="presets"><span class="option-text">${localize('settings.choose_from_existing')}</span><ha-icon icon="mdi:chevron-right" class="option-arrow"></ha-icon></div></div><div class="current-wallpaper-preview"><div class="wallpaper-preview-image" id="current-wallpaper-preview"></div></div><input type="file" id="background-file-input" accept="image/*" style="display:none"></div></div><div class="settings-section"><div class="settings-card switch-card"><div class="switch-setting-row"><span class="option-text">${localize('settings.hide_ha_header')}</span><div class="ui-setting-toggle" id="header-toggle"><div class="toggle-switch"></div></div></div></div></div><div class="settings-section"><div class="settings-card switch-card" data-setting="sidebar"><div class="switch-setting-row"><span class="option-text">${localize('settings.hide_ha_sidebar')}</span><div class="ui-setting-toggle" id="sidebar-toggle"><div class="toggle-switch"></div></div></div></div></div>`;
  }

  private renderSelectedEntities(ids: string[]): string {
    return ids.map(id => {
      const e = this.availableEntities.find(x => x.entity_id === id) || this.allEntitiesForInclusion.find(x => x.entity_id === id); if (!e) return '';
      return `<div class="selected-entity-chip" data-entity-id="${id}"><span class="entity-name">${e.friendly_name}</span><ha-icon icon="mdi:close" class="remove-entity"></ha-icon></div>`;
    }).join('');
  }

  private renderSelectedEntitiesForInclusion(ids: string[]): string {
    return ids.map(id => {
      const e = this.allEntitiesForInclusion.find(x => x.entity_id === id) || this.availableEntities.find(x => x.entity_id === id);
      return `<div class="selected-entity-chip" data-entity-id="${id}"><span class="entity-name">${e?.friendly_name || id}</span><ha-icon icon="mdi:close" class="remove-entity"></ha-icon></div>`;
    }).join('');
  }

  private renderSelectedWeatherEntity(id?: string): string {
    if (!id) return ''; const s = this.hass?.states?.[id];
    return `<div class="selected-entity-chip" data-entity-id="${id}"><span class="entity-name">${s?.attributes?.friendly_name || id}</span><ha-icon icon="mdi:close" class="remove-entity"></ha-icon></div>`;
  }

  private addModalStyles() {
    injectLiquidGlassStyles(); if (document.querySelector('#apple-home-settings-styles')) return; const s = document.createElement('style'); s.id = 'apple-home-settings-styles';
    s.textContent = `.apple-home-settings-modal{position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .3s ease}.apple-home-settings-modal.show{opacity:1}.modal-backdrop{position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.4);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}.modal-content{position:relative;width:700px;max-width:90vw;max-height:85vh;background:#1c1c1e;border-radius:var(--apple-modal-radius,20px);overflow-y:auto;overflow-x:hidden;box-shadow:0 20px 40px rgba(0,0,0,.5);transform:scale(.9);opacity:0;transition:all .3s cubic-bezier(.25,.46,.45,.94)}.apple-home-settings-modal.show .modal-content{transform:scale(1);opacity:1}.modal-header{background:transparent;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;position:sticky;top:0;z-index:10}.modal-header::before{content:'';position:absolute;top:0;left:0;right:0;bottom:-30px;background:linear-gradient(to bottom,#1c1c1e 0%,rgba(28,28,30,.95) 30%,rgba(28,28,30,.7) 60%,rgba(28,28,30,0) 100%);z-index:-1;pointer-events:none}.modal-header h2{margin:0;font-size:17px;font-weight:600;color:#fff;text-align:center;flex:1}.modal-body{padding:0 0 20px}.settings-section{padding:10px 20px;position:relative;min-width:0;max-width:100%}.settings-section-header{margin:0 0 8px;font-size:13px;font-weight:400;letter-spacing:.5px;color:rgba(255,255,255,.6)}.settings-section-description{margin:8px 0 0;font-size:14px;color:rgba(255,255,255,.6);line-height:1.4}.settings-card{background:rgba(44,44,46,.6);border-radius:var(--apple-input-radius,10px);padding:0 16px 16px;position:relative}.settings-card.switch-card{padding:0 16px}.switch-setting-row{display:flex;justify-content:space-between;align-items:center;min-height:50px}.autocomplete-input{width:100%;box-sizing:border-box;padding:12px 16px;background:rgba(39,39,39,.8);border:1px solid rgba(84,84,88,.8);border-radius:var(--apple-input-radius,10px);color:#fff;font-size:14px;outline:none;margin-top:16px}.autocomplete-input:focus{border-color:#ffaf00}.autocomplete-input::placeholder{color:rgba(255,255,255,.4)}.autocomplete-results{position:absolute;top:100%;left:0;right:0;background:rgba(44,44,46,.95);border:1px solid rgba(84,84,88,.8);border-radius:var(--apple-input-radius,10px);max-height:200px;overflow-y:auto;z-index:1000;display:none;box-shadow:0 10px 30px rgba(0,0,0,.5);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);min-width:200px}.autocomplete-results.show{display:block}.autocomplete-result{padding:12px 16px;cursor:pointer;border-bottom:.5px solid rgba(84,84,88,.2)}.autocomplete-result:hover{background:rgba(84,84,88,.3)}.autocomplete-result-name{color:#fff;font-size:14px;font-weight:500}.autocomplete-result-id{color:rgba(255,255,255,.6);font-size:12px;margin-top:2px}.selected-entities{display:flex;flex-wrap:wrap;gap:8px;min-height:0;padding:0}.selected-entities:has(div){margin-top:16px}.selected-entity-chip{display:flex;align-items:center;background:rgba(255,175,0,.2);border:1px solid rgba(255,175,0,.4);border-radius:var(--apple-card-radius,25px);padding:6px 6px 6px 14px;gap:8px}.entity-name{color:#fff;font-size:13px;font-weight:500}.remove-entity{color:rgba(255,255,255,.6);cursor:pointer;width:16px;height:16px;--mdc-icon-size:16px;display:flex;align-items:center;justify-content:center}@media (max-width:480px){.apple-home-settings-modal{align-items:flex-end}.modal-content{width:100vw;height:calc(100dvh - env(safe-area-inset-top) - 20px);max-width:100vw;max-height:calc(100dvh - env(safe-area-inset-top) - 20px);border-radius:var(--apple-modal-radius,20px) var(--apple-modal-radius,20px) 0 0;transform:translateY(100%);opacity:1;margin:0}.apple-home-settings-modal.show .modal-content{transform:translateY(0)}.settings-section{padding:16px}}.wallpaper-option-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(84,84,88,.8);cursor:pointer;height:25px}.option-text{font-size:17px;font-weight:400;color:#fff}.upload-text{color:#ff9500}.option-arrow{--mdc-icon-size:30px;color:rgba(255,255,255,.5)}.current-wallpaper-preview{display:flex;justify-content:center}.wallpaper-preview-image{width:120px;height:200px;background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;border:1px solid rgba(255,255,255,.1)}.ui-setting-toggle{width:51px;height:22px;background:rgba(60,60,67,.45);border-radius:11px;position:relative;cursor:pointer}.ui-setting-toggle.active{background:#30d158}.toggle-switch{width:27px;height:18px;background:#fff;border-radius:9px;position:absolute;top:2px;left:2px;transition:transform .25s cubic-bezier(.23,1,.32,1);box-shadow:0 1px 2px rgba(0,0,0,.1)}.ui-setting-toggle.active .toggle-switch{transform:translateX(20px)}.modal-done .save-spinner{display:none;width:18px;height:18px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite}.apple-home-settings-modal.saving .modal-done ha-icon{display:none}.apple-home-settings-modal.saving .modal-done .save-spinner{display:block}@keyframes spin{to{transform:rotate(360deg)}}`;
    document.head.appendChild(s);
  }

  private setupEventListeners() {
    if (!this.modal) return;
    this.modal.querySelector('.modal-cancel')?.addEventListener('click', () => this.closeModal());
    this.modal.querySelector('.modal-done')?.addEventListener('click', () => this.saveAndClose());
    this.modal.querySelector('.modal-backdrop')?.addEventListener('click', () => this.closeModal());
    this.setupAutocomplete(); this.setupRemoveButtons(); document.addEventListener('keydown', this.handleEscapeKey); this.setupBackgroundEventListeners();
  }

  private setupAutocomplete() {
    this.modal?.querySelectorAll('.entity-selector')?.forEach(selector => {
      const input = selector.querySelector('.autocomplete-input') as HTMLInputElement, results = selector.querySelector('.autocomplete-results') as HTMLElement, setting = selector.getAttribute('data-setting') as keyof HomeSettingsData;
      if (!input || !results || !setting) return;
      input.addEventListener('input', (e) => this.showAutocompleteResults((e.target as HTMLInputElement).value.toLowerCase().trim(), results, setting));
      input.addEventListener('focus', (e) => this.showAutocompleteResults((e.target as HTMLInputElement).value.toLowerCase().trim(), results, setting));
      document.addEventListener('click', (e) => { if (!selector.contains(e.target as Node)) results.classList.remove('show'); });
      const resize = () => { if (results.classList.contains('show')) this.positionAutocompleteResults(results); };
      window.addEventListener('resize', resize); (results as any)._cleanup = () => window.removeEventListener('resize', resize);
    });
  }

  private showAutocompleteResults(query: string, results: HTMLElement, setting: keyof HomeSettingsData) {
    const selected = this.tempSettings[setting]; let list: any[];
    if (setting === 'weatherEntity') list = Object.values(this.hass.states).filter((s: any) => s.entity_id.startsWith('weather.')).map((s: any) => ({ entity_id: s.entity_id, friendly_name: s.attributes.friendly_name || s.entity_id, domain: 'weather', state: s.state, attributes: s.attributes })).sort((a, b) => a.friendly_name.localeCompare(b.friendly_name));
    else if (setting === 'extraAccessories') list = this.allEntitiesForInclusion;
    else if (['favoriteAccessories', 'excludedFromDashboard', 'excludedFromHome'].includes(setting)) { const extras = new Set(this.tempSettings.extraAccessories); list = [...this.availableEntities, ...this.allEntitiesForInclusion.filter(e => extras.has(e.entity_id))]; }
    else list = this.availableEntities;
    let filtered = list.filter(e => {
      const match = query === '' || e.friendly_name.toLowerCase().includes(query) || e.entity_id.toLowerCase().includes(query), notSel = setting === 'weatherEntity' ? e.entity_id !== selected : (!Array.isArray(selected) || !selected.includes(e.entity_id));
      if (setting === 'favoriteAccessories' && e.domain === 'camera') return false;
      if (!this.tempSettings.showSwitches && e.domain === 'switch' && ['favoriteAccessories', 'excludedFromDashboard', 'excludedFromHome'].includes(setting)) { const isOutlet = e.attributes?.device_class === 'outlet' || e.entity_id.toLowerCase().includes('outlet') || e.friendly_name.toLowerCase().includes('outlet'); if (!isOutlet && !this.tempSettings.includedSwitches?.includes(e.entity_id)) return false; }
      if (setting === 'includedSwitches') { if (e.domain !== 'switch' || e.attributes?.device_class === 'outlet' || e.entity_id.toLowerCase().includes('outlet') || e.friendly_name.toLowerCase().includes('outlet')) return false; if (!e.state || ['unavailable', 'unknown', 'none', 'null', ''].includes(e.state.toLowerCase())) return false; }
      if (setting === 'extraAccessories' && (!e.state || ['unavailable', 'unknown'].includes(e.state.toLowerCase()))) return false;
      return match && notSel;
    }).slice(0, 10);
    if (filtered.length === 0 && query !== '') { results.innerHTML = '<div class="autocomplete-result"><div class="autocomplete-result-name">No entities found</div></div>'; this.positionAutocompleteResults(results); results.classList.add('show'); return; }
    if (query === '' && filtered.length === 0) { results.classList.remove('show'); return; }
    results.innerHTML = filtered.map(e => `<div class="autocomplete-result" data-entity-id="${e.entity_id}"><div class="autocomplete-result-name">${e.friendly_name}</div><div class="autocomplete-result-id">${e.entity_id}</div></div>`).join('');
    results.querySelectorAll('.autocomplete-result').forEach(r => r.addEventListener('click', (e) => { const id = (e.currentTarget as HTMLElement).getAttribute('data-entity-id'); if (id) { this.addEntityToSetting(id, setting); results.classList.remove('show'); const i = results.parentElement?.querySelector('.autocomplete-input') as HTMLInputElement; if (i) i.value = ''; } }));
    this.positionAutocompleteResults(results); results.classList.add('show');
  }

  private positionAutocompleteResults(results: HTMLElement) { const i = results.parentElement?.querySelector('.autocomplete-input') as HTMLInputElement; if (i) { const r = i.getBoundingClientRect(); if (results.style.minWidth !== `${r.width}px`) results.style.minWidth = `${r.width}px`; } }

  private refreshAutocompleteResults() {
    this.modal?.querySelectorAll('.entity-selector')?.forEach(selector => {
      const input = selector.querySelector('.autocomplete-input') as HTMLInputElement, results = selector.querySelector('.autocomplete-results') as HTMLElement, setting = selector.getAttribute('data-setting') as keyof HomeSettingsData;
      if (input && results && setting && results.classList.contains('show')) this.showAutocompleteResults(input.value.toLowerCase().trim(), results, setting);
    });
  }

  private addEntityToSetting(id: string, setting: keyof HomeSettingsData) { if (setting === 'weatherEntity') { this.tempSettings.weatherEntity = id; this.updateSelectedEntitiesDisplay(setting); return; } const v = this.tempSettings[setting]; if (Array.isArray(v) && !v.includes(id)) { v.push(id); this.updateSelectedEntitiesDisplay(setting); } }
  private removeEntityFromSetting(id: string, setting: keyof HomeSettingsData) { if (setting === 'weatherEntity') { this.tempSettings.weatherEntity = undefined; this.updateSelectedEntitiesDisplay(setting); return; } const v = this.tempSettings[setting]; if (Array.isArray(v)) { const i = v.indexOf(id); if (i > -1) { v.splice(i, 1); this.updateSelectedEntitiesDisplay(setting); } } }

  private updateSelectedEntitiesDisplay(setting: keyof HomeSettingsData) {
    const sel = this.modal?.querySelector(`[data-setting="${setting}"]`)?.querySelector('.selected-entities');
    if (sel) { if (setting === 'weatherEntity') { sel.innerHTML = this.renderSelectedWeatherEntity(this.tempSettings.weatherEntity); this.setupRemoveButtons(); return; } const v = this.tempSettings[setting]; if (Array.isArray(v)) { sel.innerHTML = setting === 'extraAccessories' ? this.renderSelectedEntitiesForInclusion(v) : this.renderSelectedEntities(v); this.setupRemoveButtons(); } }
  }

  private setupRemoveButtons() { this.modal?.querySelectorAll('.remove-entity').forEach(b => b.addEventListener('click', (e) => { const chip = (e.target as HTMLElement).closest('.selected-entity-chip'), id = chip?.getAttribute('data-entity-id'), s = (e.target as HTMLElement).closest('.entity-selector')?.getAttribute('data-setting') as keyof HomeSettingsData; if (id && s) this.removeEntityFromSetting(id, s); })); }
  private showModal() { if (!this.modal) return; document.body.style.overflow = 'hidden'; requestAnimationFrame(() => this.modal?.classList.add('show')); }

  private closeModal() {
    if (!this.modal) return; this.modal.querySelectorAll('.autocomplete-results').forEach(r => (r as any)._cleanup?.());
    document.body.style.overflow = ''; this.modal.classList.remove('show');
    setTimeout(() => { document.removeEventListener('keydown', this.handleEscapeKey); if (this.modal?.parentNode) this.modal.parentNode.removeChild(this.modal); this.modal = undefined; }, 300);
  }

  private async saveAndClose() {
    if (this.modal) this.modal.classList.add('saving');
    this.requiresRender = JSON.stringify(this.settings.favoriteAccessories) !== JSON.stringify(this.tempSettings.favoriteAccessories) || JSON.stringify(this.settings.excludedFromDashboard) !== JSON.stringify(this.tempSettings.excludedFromDashboard) || JSON.stringify(this.settings.excludedFromHome) !== JSON.stringify(this.tempSettings.excludedFromHome) || JSON.stringify(this.settings.includedSwitches) !== JSON.stringify(this.tempSettings.includedSwitches) || JSON.stringify(this.settings.extraAccessories) !== JSON.stringify(this.tempSettings.extraAccessories) || this.settings.showSwitches !== this.tempSettings.showSwitches || this.settings.showEnergy !== this.tempSettings.showEnergy || this.settings.weatherEntity !== this.tempSettings.weatherEntity;
    this.settings = { ...this.tempSettings, favoriteAccessories: [...this.tempSettings.favoriteAccessories], excludedFromDashboard: [...this.tempSettings.excludedFromDashboard], excludedFromHome: [...this.tempSettings.excludedFromHome], includedSwitches: [...this.tempSettings.includedSwitches], extraAccessories: [...this.tempSettings.extraAccessories] };
    if (this.modal) { this.modal.style.transition = 'opacity 0.3s ease-out'; this.modal.style.opacity = '0'; }
    try { await this.saveSettings(); } catch {} this.applyVisualChanges();
    setTimeout(() => { document.body.style.overflow = ''; document.removeEventListener('keydown', this.handleEscapeKey); if (this.modal?.parentNode) this.modal.parentNode.removeChild(this.modal); this.modal = undefined; if (this.onSaveCallback && this.requiresRender) this.onSaveCallback(); }, 300);
  }

  private applyVisualChanges() { new BackgroundManager(this.customizationManager).applyBackgroundOnly({ type: this.settings.backgroundType, backgroundImage: this.settings.backgroundType === 'custom' ? this.settings.customBackground : this.settings.presetBackground }); HomeAssistantUIManager.initializeWithCustomizations(this.customizationManager).reapplyDashboardSettings(); }

  private async saveSettings() {
    const h = this.customizationManager.getCustomization('home') || {}, ui = this.customizationManager.getCustomization('ui') || {};
    h.favorites = this.settings.favoriteAccessories; h.excluded_from_dashboard = this.settings.excludedFromDashboard; h.excluded_from_home = this.settings.excludedFromHome; h.included_switches = this.settings.includedSwitches; h.extra_accessories = this.settings.extraAccessories; h.weather_entity = this.settings.weatherEntity; h.show_switches = this.settings.showSwitches; h.show_energy = this.settings.showEnergy;
    ui.hide_header = this.settings.hideHeader; ui.hide_sidebar = this.settings.hideSidebar;
    await this.customizationManager.batchSetCustomizations({ home: h, ui, background: { type: this.settings.backgroundType, value: this.settings.backgroundType === 'custom' ? this.settings.customBackground : this.settings.presetBackground } });
  }

  private setupBackgroundEventListeners() {
    if (!this.modal) return;
    this.modal.querySelectorAll('.wallpaper-option-row').forEach(row => row.addEventListener('click', (e) => { const a = (e.currentTarget as HTMLElement).dataset.action; if (a === 'upload') document.getElementById('background-file-input')?.click(); else if (a === 'presets') this.openPresetsView(); }));
    (this.modal.querySelector('#background-file-input') as HTMLInputElement)?.addEventListener('change', async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) await this.handleBackgroundFileUpload(f); });
    this.modal.querySelector('#header-toggle')?.addEventListener('click', (e) => { e.stopPropagation(); this.tempSettings.hideHeader = !this.tempSettings.hideHeader; this.updateUIToggle('header-toggle', !!this.tempSettings.hideHeader); });
    this.modal.querySelector('#sidebar-toggle')?.addEventListener('click', (e) => { e.stopPropagation(); this.tempSettings.hideSidebar = !this.tempSettings.hideSidebar; this.updateUIToggle('sidebar-toggle', !!this.tempSettings.hideSidebar); });
    this.modal.querySelector('#switches-toggle')?.addEventListener('click', (e) => { e.stopPropagation(); this.tempSettings.showSwitches = !this.tempSettings.showSwitches; this.updateUIToggle('switches-toggle', !!this.tempSettings.showSwitches); const s = this.modal?.querySelector('#included-switches-section') as HTMLElement; if (s) s.style.display = this.tempSettings.showSwitches ? 'none' : 'block'; this.refreshAutocompleteResults(); });
    this.modal.querySelector('#energy-toggle')?.addEventListener('click', (e) => { e.stopPropagation(); this.tempSettings.showEnergy = !this.tempSettings.showEnergy; this.updateUIToggle('energy-toggle', !!this.tempSettings.showEnergy); });
    setTimeout(() => { this.updateCurrentWallpaperPreview(); this.initializeUIToggles(); }, 100);
  }

  private updateCurrentWallpaperPreview() { const p = this.modal?.querySelector('#current-wallpaper-preview') as HTMLElement; if (!p) return; const s = this.tempSettings.backgroundType === 'custom' ? this.tempSettings.customBackground : (this.tempSettings.backgroundType === 'preset' ? BackgroundManager.getPresetBackground(this.tempSettings.presetBackground!) : BackgroundManager.DEFAULT_BACKGROUND); p.style.removeProperty('background'); p.style.removeProperty('background-image'); if (s?.startsWith('url(')) p.style.setProperty('background-image', s); else p.style.setProperty('background', s!); }
  private updateUIToggle(id: string, active: boolean) { const t = this.modal?.querySelector(`#${id}`) as HTMLElement; if (t) active ? t.classList.add('active') : t.classList.remove('active'); }
  private initializeUIToggles() { this.updateUIToggle('header-toggle', !!this.tempSettings.hideHeader); this.updateUIToggle('sidebar-toggle', !!this.tempSettings.hideSidebar); this.updateUIToggle('switches-toggle', !!this.tempSettings.showSwitches); this.updateUIToggle('energy-toggle', !!this.tempSettings.showEnergy); }

  private openPresetsView() {
    const m = document.createElement('div'); m.className = 'presets-selection-modal'; m.innerHTML = `<div class="modal-backdrop"></div><div class="modal-content presets-content"><div class="modal-header"><button class="modal-cancel ${LiquidGlassClasses.modalCancel}"><ha-icon icon="mdi:close"></ha-icon></button><h2>${localize('ui_actions.choose_wallpaper')}</h2><button class="modal-done ${LiquidGlassClasses.modalDone}"><ha-icon icon="mdi:check"></ha-icon></button></div><div class="modal-body"><div class="presets-grid">${BackgroundManager.getPresetNames().map(n => `<div class="preset-option ${this.tempSettings.backgroundType==='preset'&&this.tempSettings.presetBackground===n?'selected':''}" data-preset="${n}"><div class="preset-preview" style="background:${BackgroundManager.getPresetBackground(n)}"></div><div class="preset-name">${this.formatPresetName(n)}</div></div>`).join('')}</div></div></div>`;
    this.addPresetsModalStyles(); document.body.appendChild(m); this.setupPresetsModalEventListeners(m); requestAnimationFrame(() => m.classList.add('show'));
  }

  private addPresetsModalStyles() {
    if (document.querySelector('#presets-modal-styles')) return; const s = document.createElement('style'); s.id = 'presets-modal-styles';
    s.textContent = `.presets-selection-modal{position:fixed;top:0;left:0;right:0;bottom:0;z-index:10001;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .3s ease}.presets-selection-modal.show{opacity:1}.presets-selection-modal .modal-backdrop{position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.4);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}.presets-content{position:relative;width:700px;max-width:90vw;max-height:85vh;background:#1c1c1e;border-radius:var(--apple-modal-radius,20px);overflow-y:auto;overflow-x:hidden;box-shadow:0 20px 40px rgba(0,0,0,.5);transform:scale(.9);opacity:0;transition:all .3s cubic-bezier(.25,.46,.45,.94)}.presets-selection-modal.show .presets-content{transform:scale(1);opacity:1}.presets-content .modal-header{background:transparent;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;position:sticky;top:0;z-index:10}.presets-content .modal-header::before{content:'';position:absolute;top:0;left:0;right:0;bottom:-30px;background:linear-gradient(to bottom,#1c1c1e 0%,rgba(28,28,30,.95) 30%,rgba(28,28,30,.7) 60%,rgba(28,28,30,0) 100%);z-index:-1;pointer-events:none}.presets-content .modal-header h2{margin:0;font-size:17px;font-weight:600;color:#fff;text-align:center;flex:1}.presets-content .modal-body{padding:20px}.presets-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px}.preset-option{cursor:pointer;border-radius:var(--apple-card-radius,25px);padding:8px;background:rgba(255,255,255,.05);transition:all .3s ease;border:2px solid transparent;position:relative}.preset-option:hover{background:rgba(255,255,255,.08);transform:translateY(-2px)}.preset-option.selected{border-color:#ffaf00;background:rgba(255,175,0,.1)}.preset-option.selected::after{content:'✓';position:absolute;top:8px;right:8px;background:#ffaf00;color:#fff;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold}.preset-preview{width:100%;height:100px;border-radius:var(--apple-input-radius,10px);background-size:cover!important;background-position:center!important;margin-bottom:8px}.preset-name{text-align:center;font-size:14px;font-weight:500;color:#fff}@media (max-width:480px){.presets-selection-modal{align-items:flex-end}.presets-content{width:100vw;height:calc(100dvh - env(safe-area-inset-top) - 20px);max-width:100vw;max-height:calc(100dvh - env(safe-area-inset-top) - 20px);border-radius:var(--apple-modal-radius,20px) var(--apple-modal-radius,20px) 0 0;transform:translateY(100%);opacity:1;margin:0}.presets-selection-modal.show .presets-content{transform:translateY(0)}}`;
    document.head.appendChild(s);
  }

  private setupPresetsModalEventListeners(m: HTMLElement) {
    const orig = { backgroundType: this.tempSettings.backgroundType, presetBackground: this.tempSettings.presetBackground, customBackground: this.tempSettings.customBackground };
    m.querySelector('.modal-cancel')?.addEventListener('click', () => { this.tempSettings = { ...this.tempSettings, ...orig }; this.updateCurrentWallpaperPreview(); this.closePresetsModal(m); });
    m.querySelector('.modal-done')?.addEventListener('click', () => { this.updateCurrentWallpaperPreview(); this.closePresetsModal(m); });
    m.querySelector('.modal-backdrop')?.addEventListener('click', () => { this.tempSettings = { ...this.tempSettings, ...orig }; this.updateCurrentWallpaperPreview(); this.closePresetsModal(m); });
    m.querySelectorAll('.preset-option').forEach(o => o.addEventListener('click', (e) => { const p = (e.currentTarget as HTMLElement).dataset.preset; if (p) { this.tempSettings.backgroundType = 'preset'; this.tempSettings.presetBackground = p; m.querySelectorAll('.preset-option').forEach(x => x.classList.remove('selected')); (e.currentTarget as HTMLElement).classList.add('selected'); this.updateCurrentWallpaperPreview(); } }));
  }

  private closePresetsModal(m: HTMLElement) { m.classList.remove('show'); setTimeout(() => { m.parentNode?.removeChild(m); document.querySelector('#presets-modal-styles')?.remove(); }, 300); }

  private async handleBackgroundFileUpload(file: File) {
    if (!file || !file.type.startsWith('image/')) { alert(localize('errors.invalid_image')); return; }
    if (file.size > 5 * 1024 * 1024) { alert(localize('errors.file_size_limit')); return; }
    try { const url = await BackgroundManager.imageToDataUrl(file); this.tempSettings.customBackground = url; this.tempSettings.backgroundType = 'custom'; this.updateCurrentWallpaperPreview(); } catch { alert(localize('errors.image_processing')); }
  }

  private handleEscapeKey = (e: KeyboardEvent) => { if (e.key === 'Escape') this.closeModal(); };

  public destroy() { this.closeModal(); document.querySelector('#apple-home-settings-styles')?.remove(); }
}
