import { CustomizationManager } from '../utils/CustomizationManager';
import { CardManager } from '../utils/CardManager';
import { Entity, CardConfig } from '../types/types';
import { DashboardConfig } from '../config/DashboardConfig';
import { localize } from '../utils/LocalizationService';
import { RTLHelper } from '../utils/RTLHelper';
import { DragAndDropManager } from '../utils/DragAndDropManager';

export class ScenesSection {
  private customizationManager: CustomizationManager;
  private cardManager: CardManager;

  constructor(cm: CustomizationManager, cardManager?: CardManager) {
    this.customizationManager = cm;
    this.cardManager = cardManager || new CardManager(cm);
  }

  async render(container: HTMLElement, scenes: Entity[], hass: any, onTallToggle?: (eid: string, aid: string) => void | Promise<void | boolean>, ctx: string = 'home', enableNav: boolean = true): Promise<void> {
    if (!scenes?.length) return;
    const sorted = await this.sortScenesByLastUsed(scenes, hass, 'scenes_section', ctx);
    const title = document.createElement('div'); title.className = 'apple-home-section-title';
    if (enableNav) {
      const wrap = document.createElement('div'); wrap.className = 'clickable-section-title';
      wrap.innerHTML = `<span>${localize('section_titles.scenes')}</span><ha-icon icon="${RTLHelper.isRTL() ? 'mdi:chevron-left' : 'mdi:chevron-right'}" class="section-arrow"></ha-icon>`;
      wrap.addEventListener('click', () => this.navigateToPath('scenes'));
      title.appendChild(wrap);
    } else title.innerHTML = `<span>${localize('section_titles.scenes')}</span>`;
    container.appendChild(title);
    const carouselContainer = document.createElement('div'); carouselContainer.className = 'carousel-container';
    const grid = document.createElement('div'); grid.className = 'carousel-grid scenes';
    grid.dataset.areaId = 'scenes_section'; grid.dataset.sectionType = 'scenes';
    for (const e of sorted) {
      const cfg = this.createEntityCard(e.entity_id, hass, e);
      if (cfg) { cfg.section_type = 'scenes'; await this.createAndAppendCard(cfg, grid, hass, onTallToggle, ctx); }
    }
    carouselContainer.appendChild(grid); this.setupDragScroll(carouselContainer); container.appendChild(carouselContainer);
  }

  private async sortScenesByLastUsed(ents: Entity[], hass: any, aid: string, ctx: string = 'home'): Promise<Entity[]> {
    try {
      const saved = this.customizationManager.getSavedCarouselOrderWithContext(aid, 'scenes', ctx);
      if (saved?.length) {
        const map = new Map(ents.map(e => [e.entity_id, e])), ordered: Entity[] = [];
        saved.forEach((id: string) => { if (map.has(id)) { ordered.push(map.get(id)!); map.delete(id); } });
        const remaining = Array.from(map.values());
        if (remaining.length) ordered.push(...(await this.sortScenesByLastUsed(remaining, hass, aid)));
        return ordered;
      }
      const withLast = await Promise.all(ents.map(async (e) => {
        const s = hass.states[e.entity_id];
        let last: Date | null = s?.attributes?.last_triggered ? new Date(s.attributes.last_triggered) : (s?.last_changed ? new Date(s.last_changed) : (s?.last_updated ? new Date(s.last_updated) : null));
        return { e, last: (last && last.getTime() > 0) ? last : null };
      }));
      withLast.sort((a, b) => {
        if (!a.last && !b.last) return (hass.states[a.e.entity_id]?.attributes?.friendly_name || a.e.entity_id).localeCompare(hass.states[b.e.entity_id]?.attributes?.friendly_name || b.e.entity_id);
        if (!a.last) return 1; if (!b.last) return -1;
        const diff = b.last.getTime() - a.last.getTime();
        return diff !== 0 ? diff : (hass.states[a.e.entity_id]?.attributes?.friendly_name || a.e.entity_id).localeCompare(hass.states[b.e.entity_id]?.attributes?.friendly_name || b.e.entity_id);
      });
      return withLast.map(i => i.e);
    } catch { return [...ents].sort((a, b) => (hass.states[a.entity_id]?.attributes?.friendly_name || a.entity_id).localeCompare(hass.states[b.entity_id]?.attributes?.friendly_name || b.entity_id)); }
  }

  private createEntityCard(eid: string, hass: any, entity?: Entity): CardConfig | null {
    const s = hass.states[eid]; if (!s) return null; const dom = eid.split('.')[0];
    let tall = DashboardConfig.isDefaultTallDomain(dom); if (entity && typeof (entity as any).is_tall !== 'undefined') tall = (entity as any).is_tall;
    const c: CardConfig = { type: 'custom:apple-home-card', entity: eid, name: s.attributes?.friendly_name || eid.split('.')[1].replace(/_/g, ' '), domain: dom, is_tall: tall };
    if (DashboardConfig.isScenesDomain(dom) && !s.attributes?.icon) (c as any).default_icon = 'mdi:home';
    return c;
  }

  private async createAndAppendCard(cfg: any, container: HTMLElement, hass: any, onTallToggle?: (eid: string, aid: string) => void | Promise<void | boolean>, ctx: string = 'home'): Promise<void> {
    try {
      let el: HTMLElement;
      if (cfg.type === 'custom:apple-home-card') {
        el = document.createElement('apple-home-card') as HTMLElement;
        const tall = this.cardManager.shouldCardBeTall(cfg.entity, container.dataset.areaId || 'unknown', ctx);
        const finalCfg = { ...cfg, is_tall: tall }; if (cfg.default_icon) finalCfg.default_icon = cfg.default_icon;
        (el as any).setConfig(finalCfg); (el as any).hass = hass;
      } else {
        const type = cfg.type.replace('custom:', '');
        if (customElements.get(type)) { el = document.createElement(type); if (el && typeof (el as any).setConfig === 'function') { (el as any).setConfig(cfg); (el as any).hass = hass; } }
        else { el = document.createElement('div'); el.className = 'error-placeholder'; el.innerHTML = `<div style="color:red;padding:10px;background:rgba(255,0,0,0.1);border-radius:10px;">Unknown: ${cfg.type}</div>`; }
      }
      const wrap = document.createElement('div'); wrap.className = 'entity-card-wrapper'; wrap.dataset.entityId = cfg.entity;
      const isTall = this.cardManager.shouldCardBeTall(cfg.entity, container.dataset.areaId || 'unknown', ctx); if (isTall) wrap.classList.add('tall');
      const ctrls = document.createElement('div'); ctrls.className = 'entity-controls';
      const hide = document.createElement('button'); hide.className = 'entity-control-btn entity-hide-btn'; hide.dataset.action = 'hide-entity'; hide.innerHTML = `<ha-icon icon="mdi:minus"></ha-icon>`;
      hide.addEventListener('click', (e) => { e.stopPropagation(); wrap.dispatchEvent(new CustomEvent('apple-home-hide-entity', { bubbles: true, composed: true, detail: { entityId: cfg.entity, areaId: container.dataset.areaId || 'unknown' } })); });
      wrap.appendChild(hide); wrap.appendChild(ctrls); wrap.appendChild(el!); container.appendChild(wrap);
    } catch (err) { console.error('Error creating card in ScenesSection:', err); }
  }

  private navigateToPath(p: string) {
    const cur = window.location.pathname; let base = '';
    if (cur.startsWith('/lovelace/') || cur === '/lovelace') base = '/lovelace/';
    else { const parts = cur.split('/').filter(x => x.length > 0); base = parts.length > 0 ? `/${parts[0]}/` : '/lovelace/'; }
    const url = `${base}${p.startsWith('/') ? p.slice(1) : p}`;
    if (url !== cur) { window.history.pushState(null, '', url); window.dispatchEvent(new Event('location-changed', { bubbles: true, composed: true })); }
  }

  private setupDragScroll(c: HTMLElement): void {
    let down = false, sX: number, sL: number, dragged = false;
    const upd = () => { const over = c.scrollWidth > c.clientWidth; c.style.cursor = over ? 'grab' : ''; return over; };
    setTimeout(upd, 100);
    c.addEventListener('mousedown', (e) => { if (DragAndDropManager.isReordering || e.button !== 0 || !upd()) return; down = true; dragged = false; c.style.cursor = 'grabbing'; sX = e.pageX - c.offsetLeft; sL = c.scrollLeft; });
    c.addEventListener('mouseleave', () => { down = false; upd(); }); c.addEventListener('mouseup', () => { down = false; upd(); });
    c.addEventListener('mousemove', (e) => { if (!down || DragAndDropManager.isReordering) { if (DragAndDropManager.isReordering) down = false; return; } e.preventDefault(); const walk = (e.pageX - c.offsetLeft) - sX; if (Math.abs(walk) > 5) dragged = true; c.scrollLeft = sL - walk; });
    c.addEventListener('click', (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);
  }
}
