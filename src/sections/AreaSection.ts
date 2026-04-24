import { CustomizationManager } from '../utils/CustomizationManager';
import { CardManager } from '../utils/CardManager';
import { DataService } from '../utils/DataService';
import { Entity, CardConfig, Area } from '../types/types';
import { DashboardConfig } from '../config/DashboardConfig';
import { localize } from '../utils/LocalizationService';
import { RTLHelper } from '../utils/RTLHelper';

export class AreaSection {
  private customizationManager: CustomizationManager;
  private cardManager: CardManager;
  private _areasCache: Area[] | null = null;
  private _areasCacheHass: any = null;

  constructor(cm: CustomizationManager, cardManager?: CardManager) {
    this.customizationManager = cm;
    this.cardManager = cardManager || new CardManager(cm);
  }

  private async getCachedAreas(hass: any): Promise<Area[]> {
    if (this._areasCache && this._areasCacheHass === hass) return this._areasCache;
    this._areasCache = await DataService.getAreas(hass);
    this._areasCacheHass = hass;
    return this._areasCache;
  }

  async renderSingleArea(container: HTMLElement, aid: string, entities: Entity[], hass: any, onTallToggle?: (eid: string, aid: string) => void | Promise<void | boolean>, ctx: string = 'home', enableNav: boolean = true): Promise<void> {
    if (!entities?.length) return;
    let name = aid; if (aid !== 'no_area') { try { const areas = await this.getCachedAreas(hass); name = areas.find((a: Area) => a.area_id === aid)?.name || aid; } catch {} } else name = localize('section_titles.default_room');
    const title = document.createElement('div'); title.className = 'area-title';
    if (enableNav) {
      const wrap = document.createElement('div'); wrap.className = 'clickable-section-title';
      wrap.innerHTML = `<span>${name}</span><ha-icon icon="${RTLHelper.isRTL() ? 'mdi:chevron-left' : 'mdi:chevron-right'}" class="section-arrow"></ha-icon>`;
      wrap.addEventListener('click', () => this.navigateToPath(`room-${aid}`));
      title.appendChild(wrap);
    } else title.innerHTML = `<span>${name}</span>`;
    container.appendChild(title);
    const grid = document.createElement('div'); grid.className = 'area-entities'; grid.dataset.areaId = aid;
    const saved = this.customizationManager.getSavedCardOrderWithContext(aid, ctx);
    let ordered = saved?.length ? this.customizationManager.applySavedCardOrder(entities, saved) : [...entities];
    for (const e of ordered) {
      const cfg = this.createEntityCard(e.entity_id, hass, name, e);
      if (cfg) await this.createAndAppendCard(cfg, grid, hass, onTallToggle, ctx);
    }
    container.appendChild(grid);
  }

  private createEntityCard(eid: string, hass: any, areaName?: string, entity?: Entity): CardConfig | null {
    const s = hass.states[eid]; if (!s) return null;
    let name = s.attributes?.friendly_name || eid.split('.')[1].replace(/_/g, ' '); const dom = eid.split('.')[0];
    if (areaName && name.includes(areaName)) {
      const esc = areaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), clean = name.replace(new RegExp(`^${esc}\\s+`, 'i'), '').replace(new RegExp(`\\s+${esc}$`, 'i'), '').replace(new RegExp(`\\s+${esc}\\s+`, 'i'), ' ').trim();
      if (clean && clean.toLowerCase() !== areaName.toLowerCase()) name = clean;
    }
    let tall = DashboardConfig.isDefaultTallDomain(dom);
    if (entity && typeof (entity as any).is_tall !== 'undefined') tall = (entity as any).is_tall;
    else if (this.cardManager) tall = this.cardManager.shouldCardBeTall(eid, 'unknown', 'home');
    const c: CardConfig = { type: 'custom:apple-home-card', entity: eid, name, domain: dom, is_tall: tall };
    if (DashboardConfig.isScenesDomain(dom) && !s.attributes?.icon) (c as any).default_icon = 'mdi:home';
    return c;
  }

  private async createAndAppendCard(cfg: any, container: HTMLElement, hass: any, onTallToggle?: (eid: string, aid: string) => void | Promise<void | boolean>, ctx: string = 'home'): Promise<void> {
    try {
      let el: HTMLElement;
      if (cfg.type === 'custom:apple-home-card') {
        el = document.createElement('apple-home-card') as HTMLElement;
        const tall = this.cardManager.shouldCardBeTall(cfg.entity, container.dataset.areaId || 'unknown', ctx);
        const finalCfg = { ...cfg, is_tall: tall };
        if (cfg.default_icon) finalCfg.default_icon = cfg.default_icon;
        (el as any).setConfig(finalCfg); (el as any).hass = hass;
      } else {
        const type = cfg.type.replace('custom:', '');
        if (customElements.get(type)) { el = document.createElement(type); if (el && typeof (el as any).setConfig === 'function') { (el as any).setConfig(cfg); (el as any).hass = hass; } }
        else { el = document.createElement('div'); el.className = 'error-placeholder'; el.innerHTML = `<div style="color:red;padding:10px;background:rgba(255,0,0,0.1);border-radius:10px;">Unknown: ${cfg.type}</div>`; }
      }
      const wrap = document.createElement('div'); wrap.className = 'entity-card-wrapper';
      wrap.dataset.entityId = cfg.entity; wrap.dataset.areaId = container.dataset.areaId || 'unknown';
      const isTall = this.cardManager.shouldCardBeTall(cfg.entity, container.dataset.areaId || 'unknown', ctx);
      if (isTall) wrap.classList.add('tall');
      const ctrls = document.createElement('div'); ctrls.className = 'entity-controls';
      const domain = cfg.entity ? cfg.entity.split('.')[0] : '';
      if (!['camera', 'scene', 'script', 'automation'].includes(domain)) {
        ctrls.innerHTML = `<button class="entity-control-btn tall-toggle ${isTall ? 'active' : ''}" data-action="toggle-tall"><ha-icon icon="mdi:${isTall ? 'arrow-collapse' : 'arrow-expand'}"></ha-icon></button>`;
        const btn = ctrls.querySelector('.tall-toggle') as HTMLButtonElement;
        if (btn && onTallToggle) btn.addEventListener('click', (e) => { e.stopPropagation(); onTallToggle(cfg.entity, container.dataset.areaId || 'unknown'); });
      }
      const hide = document.createElement('button'); hide.className = 'entity-control-btn entity-hide-btn';
      hide.dataset.action = 'hide-entity'; hide.innerHTML = `<ha-icon icon="mdi:minus"></ha-icon>`;
      hide.addEventListener('click', (e) => {
        e.stopPropagation();
        wrap.dispatchEvent(new CustomEvent('apple-home-hide-entity', { bubbles: true, composed: true, detail: { entityId: cfg.entity, areaId: container.dataset.areaId || 'unknown' } }));
      });
      wrap.appendChild(hide); wrap.appendChild(ctrls); wrap.appendChild(el!); container.appendChild(wrap);
    } catch (err) { console.error('Error creating card:', err); }
  }

  private navigateToPath(p: string) {
    const cur = window.location.pathname;
    let base = '';
    if (cur.startsWith('/lovelace/') || cur === '/lovelace') base = '/lovelace/';
    else { const parts = cur.split('/').filter(x => x.length > 0); base = parts.length > 0 ? `/${parts[0]}/` : '/lovelace/'; }
    const url = `${base}${p.startsWith('/') ? p.slice(1) : p}`;
    if (url !== cur) {
      window.history.pushState(null, '', url);
      window.dispatchEvent(new Event('location-changed', { bubbles: true, composed: true }));
    }
  }
}
