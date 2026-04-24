import { CustomizationManager } from '../utils/CustomizationManager';
import { CardManager } from '../utils/CardManager';
import { DashboardConfig } from '../config/DashboardConfig';
import { Entity, CardConfig } from '../types/types';
import { localize } from '../utils/LocalizationService';

export class FavoritesSection {
  private customizationManager: CustomizationManager;
  private cardManager: CardManager;

  constructor(cm: CustomizationManager, cardManager?: CardManager) {
    this.customizationManager = cm;
    this.cardManager = cardManager || new CardManager(cm);
  }

  async render(container: HTMLElement, all: Entity[], hass: any, onTallToggle?: (eid: string, aid: string) => void | Promise<void | boolean>): Promise<void> {
    const favorites = await this.customizationManager.getFavoriteAccessories(); if (favorites.length === 0) return;
    const extra = await this.customizationManager.getExtraAccessories();
    const entities = favorites.map((id: string) => {
      const s = hass.states[id], reg = hass.entities?.[id]; if (!s || (reg && (reg.hidden_by || reg.disabled_by))) return null;
      const dom = id.split('.')[0]; if (!DashboardConfig.isSupportedDomain(dom) && !extra.includes(id)) return null;
      return { entity_id: id, name: s.attributes.friendly_name || id, area_id: 'favorites', domain: dom };
    }).filter(Boolean) as Entity[];
    if (entities.length === 0) return;
    const title = document.createElement('div'); title.className = 'apple-home-section-title';
    title.innerHTML = `<span>${localize('section_titles.favorites')}</span>`;
    container.appendChild(title);
    const grid = document.createElement('div'); grid.className = 'area-entities'; grid.dataset.areaId = 'favorites';
    container.appendChild(grid);
    const saved = this.customizationManager.getSavedCardOrderWithContext('favorites', 'home');
    const ordered = saved?.length ? this.customizationManager.applySavedCardOrder(entities, saved) : [...entities];
    for (const e of ordered) await this.createAndAppendCard(e, grid, hass, onTallToggle);
  }

  private async createAndAppendCard(e: Entity, container: HTMLElement, hass: any, onTallToggle?: (eid: string, aid: string) => void | Promise<void | boolean>): Promise<void> {
    try {
      const cfg = this.createEntityCard(e.entity_id, hass); if (!cfg) return;
      let el: HTMLElement;
      if (cfg.type === 'custom:apple-home-card') {
        el = document.createElement('apple-home-card') as HTMLElement;
        const tall = this.cardManager.shouldCardBeTall(cfg.entity, 'favorites', 'home');
        const finalCfg = { ...cfg, is_tall: tall }; if (cfg.default_icon) finalCfg.default_icon = cfg.default_icon;
        (el as any).setConfig(finalCfg); (el as any).hass = hass;
      } else {
        const type = cfg.type.replace('custom:', '');
        if (customElements.get(type)) { el = document.createElement(type); if (el && typeof (el as any).setConfig === 'function') { (el as any).setConfig(cfg); (el as any).hass = hass; } }
        else { el = document.createElement('div'); el.className = 'error-placeholder'; el.innerHTML = `<div style="color:red;padding:10px;background:rgba(255,0,0,0.1);border-radius:10px;">Unknown: ${cfg.type}</div>`; }
      }
      const wrap = document.createElement('div'); wrap.className = 'entity-card-wrapper'; wrap.dataset.entityId = cfg.entity;
      const isTall = this.cardManager.shouldCardBeTall(cfg.entity, 'favorites', 'home');
      if (isTall) wrap.classList.add('tall');
      const ctrls = document.createElement('div'); ctrls.className = 'entity-controls';
      const domain = cfg.entity ? cfg.entity.split('.')[0] : '';
      if (!['camera', 'scene', 'script', 'automation'].includes(domain)) {
        ctrls.innerHTML = `<button class="entity-control-btn tall-toggle ${isTall ? 'active' : ''}" data-action="toggle-tall"><ha-icon icon="mdi:${isTall ? 'arrow-collapse' : 'arrow-expand'}"></ha-icon></button>`;
        const btn = ctrls.querySelector('.tall-toggle') as HTMLButtonElement;
        if (btn && onTallToggle) btn.addEventListener('click', (ev) => { ev.stopPropagation(); onTallToggle(cfg.entity, 'favorites'); });
      }
      const hide = document.createElement('button'); hide.className = 'entity-control-btn entity-hide-btn'; hide.dataset.action = 'hide-entity'; hide.innerHTML = `<ha-icon icon="mdi:minus"></ha-icon>`;
      hide.addEventListener('click', (ev) => { ev.stopPropagation(); wrap.dispatchEvent(new CustomEvent('apple-home-hide-entity', { bubbles: true, composed: true, detail: { entityId: cfg.entity, areaId: 'favorites' } })); });
      wrap.appendChild(hide); wrap.appendChild(ctrls); wrap.appendChild(el!); container.appendChild(wrap);
    } catch (err) { console.error('Error creating card in FavoritesSection:', err); }
  }

  private createEntityCard(id: string, hass: any): CardConfig | null {
    const s = hass.states[id]; if (!s) return null; const dom = id.split('.')[0];
    const c: CardConfig = { type: 'custom:apple-home-card', entity: id, name: s.attributes?.friendly_name || id, domain: dom, is_tall: false };
    if (DashboardConfig.isScenesDomain(dom) && !s.attributes?.icon) (c as any).default_icon = 'mdi:home';
    return c;
  }
}
