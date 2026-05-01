import { CustomizationManager } from '../utils/CustomizationManager';
import { DataService } from '../utils/DataService';
import { DashboardConfig } from '../config/DashboardConfig';
import { ScenesSection } from '../sections/ScenesSection';
import { CamerasSection } from '../sections/CamerasSection';
import { AreaSection } from '../sections/AreaSection';
import { FavoritesSection } from '../sections/FavoritesSection';
import { WeatherSection } from '../sections/WeatherSection';
import { EnergySection } from '../sections/EnergySection';
import { StatusSection } from '../sections/StatusSection';
import { Entity, Area } from '../types/types';
import { localize } from '../utils/LocalizationService';

export class HomePage {
  private customizationManager?: CustomizationManager;
  private scenesSection?: ScenesSection;
  private camerasSection?: CamerasSection;
  private areaSection?: AreaSection;
  private favoritesSection?: FavoritesSection;
  private weatherSection?: WeatherSection;
  private energySection?: EnergySection;
  private statusSection?: StatusSection;
  private _hass?: any;
  private _title?: string;
  private _config?: any;

  constructor() {}

  set hass(hass: any) {
    this._hass = hass;
    if (this.statusSection) this.statusSection.hass = hass;
  }

  async setConfig(config: any) {
    this._config = config;
    this._title = config.title;
    if (config.customizations && this._hass) {
      this.customizationManager = CustomizationManager.getInstance(this._hass);
      await this.customizationManager.setCustomizations(config.customizations);
      this.initializeSections();
    }
  }

  private initializeSections() {
    if (this.customizationManager) {
      this.scenesSection = new ScenesSection(this.customizationManager);
      this.camerasSection = new CamerasSection(this.customizationManager);
      this.areaSection = new AreaSection(this.customizationManager);
      this.favoritesSection = new FavoritesSection(this.customizationManager);
      this.weatherSection = new WeatherSection(this.customizationManager);
      this.energySection = new EnergySection(this.customizationManager);
      this.statusSection = new StatusSection(this.customizationManager);
    }
  }

  private createHomeTitle(title: string): HTMLElement {
    const el = document.createElement('h1');
    el.className = 'apple-page-title';
    el.textContent = title;
    return el;
  }

  async render(container: HTMLElement, hass: any, title: string, onTallToggle?: (eid: string, aid: string) => void | Promise<void | boolean>): Promise<void> {
    const permanent = ['.apple-home-header', '.permanent-chips'];
    Array.from(container.children).forEach(c => { if (!permanent.some(s => c.matches(s))) c.remove(); });

    const homeTitle = this.createHomeTitle(title);
    const chips = container.querySelector('.permanent-chips');
    if (chips) container.insertBefore(homeTitle, chips); else container.appendChild(homeTitle);

    try {
      const [areas, entities, devices, showSwitches, includedSwitches, extraAccessories] = await Promise.all([
        DataService.getAreas(hass), DataService.getEntities(hass), DataService.getDevices(hass),
        this.customizationManager?.getShowSwitches().then(v => v || false) ?? Promise.resolve(false),
        this.customizationManager?.getIncludedSwitches().then(v => v || []) ?? Promise.resolve([] as string[]),
        this.customizationManager?.getExtraAccessories().then(v => v || []) ?? Promise.resolve([] as string[])
      ]);
      
      const supported = entities.filter(e => {
        const dom = e.entity_id.split('.')[0];
        if (extraAccessories.includes(e.entity_id)) return true;
        if (e.entity_category === 'config' || e.entity_category === 'diagnostic') return false;
        if (!DashboardConfig.isSupportedDomain(dom)) return false;
        if (dom === 'switch') {
          const s = hass.states[e.entity_id];
          if (showSwitches) return DashboardConfig.getDeviceGroup(dom, e.entity_id, s?.attributes, showSwitches) !== undefined;
          return DashboardConfig.isOutlet(e.entity_id, s?.attributes) || includedSwitches.includes(e.entity_id);
        }
        return true;
      });

      const excludedDash = new Set(await this.customizationManager?.getExcludedFromDashboard() || []);
      const excludedHome = new Set(await this.customizationManager?.getExcludedFromHome() || []);
      const filtered = supported.filter(e => !excludedDash.has(e.entity_id));

      if (this.statusSection) {
        const statusEnts = entities.filter(e => {
          if (e.entity_category === 'config' || e.entity_category === 'diagnostic') return false;
          const dom = e.entity_id.split('.')[0];
          if (!DashboardConfig.isStatusDomain(dom)) return false;
          return !excludedDash.has(e.entity_id);
        });
        await this.statusSection.render(container, statusEnts, hass);
      }

      const scenes: Entity[] = [], cameras: Entity[] = [], regular: Entity[] = [];
      for (const e of filtered) {
        if (excludedHome.has(e.entity_id)) continue;
        const dom = e.entity_id.split('.')[0];
        if (DashboardConfig.isScenesDomain(dom)) scenes.push(e);
        else if (DashboardConfig.isCamerasDomain(dom)) cameras.push(e);
        else if (!DashboardConfig.isSpecialSectionDomain(dom)) regular.push(e);
      }
      
      const entitiesByArea = DataService.groupEntitiesByArea(regular, areas, devices);
      if (!this.customizationManager) throw new Error('CustomizationManager missing');
      
      const customizedAreas = this.applyCustomizations(entitiesByArea, this.customizationManager.getCustomizations());
      await this.renderSectionsInOrder(container, customizedAreas, scenes, cameras, filtered, hass, onTallToggle);
    } catch (e) { console.error('Error rendering HomePage:', e); }
  }

  private async renderSectionsInOrder(container: HTMLElement, areas: { [aid: string]: Entity[] }, scenes: Entity[], cameras: Entity[], all: Entity[], hass: any, onTallToggle?: (eid: string, aid: string) => void | Promise<void | boolean>): Promise<void> {
    if (!this.customizationManager || !this.scenesSection || !this.camerasSection || !this.areaSection || !this.favoritesSection || !this.weatherSection || !this.energySection) throw new Error('Sections missing');
    
    const order = this.customizationManager.getSavedSectionOrder(), hidden = this.customizationManager.getHiddenSections();
    const available = new Map<string, (target?: HTMLElement) => Promise<void>>();

    const wEntity = await this.customizationManager.getWeatherEntity();
    if (wEntity && hass.states[wEntity]) available.set('weather_section', async (t) => { await this.weatherSection!.render(t || container, hass); });

    const showE = await this.customizationManager.getShowEnergy();
    if (showE && EnergySection.hasEnergySensors(hass)) available.set('energy_section', async (t) => { await this.energySection!.render(t || container, hass); });

    if (await this.customizationManager.hasFavoriteAccessories()) available.set('favorites_section', async (t) => { await this.favoritesSection!.render(t || container, all, hass, onTallToggle); });
    if (scenes.length > 0) available.set('scenes_section', async (t) => { await this.scenesSection!.render(t || container, scenes, hass, onTallToggle); });
    if (cameras.length > 0) available.set('cameras_section', async (t) => { await this.camerasSection!.render(t || container, cameras, hass, onTallToggle); });

    for (const aid of Object.keys(areas)) {
      if (areas[aid].length > 0) available.set(aid, async (t) => { await this.areaSection!.renderSingleArea(t || container, aid, areas[aid], hass, onTallToggle, 'home'); });
    }

    let ids: string[] = [];
    if (order.length > 0) {
      ids = order.filter(id => available.has(id));
      for (const sid of available.keys()) { if (!ids.includes(sid)) { if (sid === 'weather_section' || sid === 'energy_section') ids.unshift(sid); else ids.push(sid); } }
    } else {
      ids = Array.from(available.keys()).sort((a, b) => {
        const p: Record<string, number> = { 'weather_section': -3, 'energy_section': -2, 'cameras_section': -1, 'scenes_section': 0, 'favorites_section': 1 };
        return (p[a] ?? 10) - (p[b] ?? 10) || a.localeCompare(b);
      });
    }

    const rendered = new Set<string>();
    for (let i = 0; i < ids.length; i++) {
      const sid = ids[i]; if (rendered.has(sid) || hidden.includes(sid) || !available.has(sid)) continue;
      if ((sid === 'weather_section' || sid === 'energy_section') && available.has('weather_section') && available.has('energy_section')) {
        const other = sid === 'weather_section' ? 'energy_section' : 'weather_section';
        if (!rendered.has(other) && !hidden.includes(other)) {
          let next = null; for (let j = i + 1; j < ids.length; j++) { if (!rendered.has(ids[j]) && !hidden.includes(ids[j]) && available.has(ids[j])) { next = ids[j]; break; } }
          if (next === other) {
            const wrap = document.createElement('div'); wrap.className = 'weather-energy-row'; wrap.style.display = 'flex'; wrap.style.gap = '12px'; container.appendChild(wrap);
            await available.get(sid)!(wrap); await available.get(other)!(wrap);
            rendered.add(sid); rendered.add(other); continue;
          }
        }
      }
      await available.get(sid)!(); rendered.add(sid);
    }
  }

  private applyCustomizations(areas: { [aid: string]: Entity[] }, cust: any): { [aid: string]: Entity[] } {
    const res: { [aid: string]: Entity[] } = {};
    const ids = Object.keys(areas);
    let sorted = ids;
    if (cust.home?.sections?.order) sorted = [...ids].sort((a, b) => {
      const ia = cust.home.sections.order.indexOf(a), ib = cust.home.sections.order.indexOf(b);
      return (ia !== -1 && ib !== -1) ? ia - ib : (ia !== -1 ? -1 : (ib !== -1 ? 1 : 0));
    });
    for (const aid of sorted) {
      const ents = [...areas[aid]]; const ord = cust.home?.entities_order?.[aid];
      if (Array.isArray(ord) && ord.length > 0) ents.sort((a, b) => {
        const ia = ord.indexOf(a.entity_id), ib = ord.indexOf(b.entity_id);
        return (ia !== -1 && ib !== -1) ? ia - ib : (ia !== -1 ? -1 : (ib !== -1 ? 1 : 0));
      });
      if (cust.home?.tall_cards) ents.forEach(e => { if (cust.home.tall_cards.includes(e.entity_id)) (e as any).is_tall = true; else if (cust.home.tall_cards.includes(`!${e.entity_id}`)) (e as any).is_tall = false; });
      res[aid] = ents;
    }
    return res;
  }
}
