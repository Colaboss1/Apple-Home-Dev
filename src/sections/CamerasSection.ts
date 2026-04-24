import { CustomizationManager } from '../utils/CustomizationManager';
import { CardManager } from '../utils/CardManager';
import { Entity, CardConfig } from '../types/types';
import { DashboardConfig } from '../config/DashboardConfig';
import { localize } from '../utils/LocalizationService';
import { RTLHelper } from '../utils/RTLHelper';
import { DragAndDropManager } from '../utils/DragAndDropManager';

export class CamerasSection {
  private customizationManager: CustomizationManager;
  private cardManager: CardManager;

  constructor(cm: CustomizationManager, cardManager?: CardManager) {
    this.customizationManager = cm;
    this.cardManager = cardManager || new CardManager(cm);
  }

  async render(container: HTMLElement, cameras: Entity[], hass: any, onTallToggle?: (eid: string, aid: string) => void | Promise<void | boolean>, ctx: string = 'home', enableNav: boolean = true, sid: string = 'cameras_section'): Promise<void> {
    if (!cameras?.length) return;
    const sorted = await this.sortCamerasByOrder(cameras, sid, ctx);
    const title = document.createElement('div'); title.className = 'apple-home-section-title';
    if (enableNav) {
      const wrap = document.createElement('div'); wrap.className = 'clickable-section-title';
      wrap.innerHTML = `<span>${localize('section_titles.cameras')}</span><ha-icon icon="${RTLHelper.isRTL() ? 'mdi:chevron-left' : 'mdi:chevron-right'}" class="section-arrow"></ha-icon>`;
      wrap.addEventListener('click', () => this.navigateToPath('cameras'));
      title.appendChild(wrap);
    } else title.innerHTML = `<span>${localize('section_titles.cameras')}</span>`;
    container.appendChild(title);
    const carouselContainer = document.createElement('div'); carouselContainer.className = 'carousel-container';
    const grid = document.createElement('div'); grid.className = 'carousel-grid cameras'; grid.dataset.areaId = sid; grid.dataset.sectionType = 'cameras';
    for (const e of sorted) {
      const cfg = this.createEntityCard(e.entity_id, hass, e);
      if (cfg) {
        cfg.section_type = 'cameras'; cfg.is_tall = true; (cfg as any).camera_view = 'snapshot'; (cfg as any).refresh_interval = 10000;
        await this.createAndAppendCard(cfg, grid, hass, onTallToggle, ctx);
      }
    }
    carouselContainer.appendChild(grid); this.setupDragScroll(carouselContainer); container.appendChild(carouselContainer);
  }

  private createEntityCard(eid: string, hass: any, entity?: Entity): CardConfig | null {
    const s = hass.states[eid]; if (!s) return null;
    const name = s.attributes?.friendly_name || eid.split('.')[1].replace(/_/g, ' '), dom = eid.split('.')[0];
    let tall = DashboardConfig.isDefaultTallDomain(dom); if (entity && typeof (entity as any).is_tall !== 'undefined') tall = (entity as any).is_tall;
    return { type: 'custom:apple-home-card', entity: eid, name, domain: dom, is_tall: tall };
  }

  private async createAndAppendCard(cfg: any, container: HTMLElement, hass: any, onTallToggle?: (eid: string, aid: string) => void | Promise<void | boolean>, ctx: string = 'home'): Promise<void> {
    try {
      let el: HTMLElement;
      if (cfg.type === 'custom:apple-home-card') {
        el = document.createElement('apple-home-card') as HTMLElement;
        const tall = true; // Cameras in carousel are always tall snapshots
        const c = { ...cfg, is_tall: tall };
        if (cfg.camera_view) c.camera_view = cfg.camera_view;
        if (cfg.refresh_interval) c.refresh_interval = cfg.refresh_interval;
        (el as any).setConfig(c); (el as any).hass = hass;
      } else {
        const type = cfg.type.replace('custom:', '');
        if (customElements.get(type)) { el = document.createElement(type); if (el && typeof (el as any).setConfig === 'function') { (el as any).setConfig(cfg); (el as any).hass = hass; } }
        else { el = document.createElement('div'); el.className = 'error-placeholder'; el.innerHTML = `<div style="color:red;padding:10px;background:rgba(255,0,0,0.1);border-radius:10px;">Unknown: ${cfg.type}</div>`; }
      }
      const wrap = document.createElement('div'); wrap.className = 'entity-card-wrapper'; wrap.dataset.entityId = cfg.entity;
      if (cfg.is_tall) wrap.classList.add('tall');
      const ctrls = document.createElement('div'); ctrls.className = 'entity-controls';
      const hide = document.createElement('button'); hide.className = 'entity-control-btn entity-hide-btn'; hide.dataset.action = 'hide-entity'; hide.innerHTML = `<ha-icon icon="mdi:minus"></ha-icon>`;
      hide.addEventListener('click', (e) => { e.stopPropagation(); wrap.dispatchEvent(new CustomEvent('apple-home-hide-entity', { bubbles: true, composed: true, detail: { entityId: cfg.entity, areaId: container.dataset.areaId || 'unknown' } })); });
      wrap.appendChild(hide); wrap.appendChild(ctrls); wrap.appendChild(el!); container.appendChild(wrap);
    } catch (err) { console.error('Error creating card in CamerasSection:', err); }
  }

  private navigateToPath(p: string) {
    const cur = window.location.pathname; let base = '';
    if (cur.startsWith('/lovelace/') || cur === '/lovelace') base = '/lovelace/';
    else { const parts = cur.split('/').filter(x => x.length > 0); base = parts.length > 0 ? `/${parts[0]}/` : '/lovelace/'; }
    const url = `${base}${p.startsWith('/') ? p.slice(1) : p}`;
    if (url !== cur) { window.history.pushState(null, '', url); window.dispatchEvent(new Event('location-changed', { bubbles: true, composed: true })); }
  }

  private async sortCamerasByOrder(ents: Entity[], aid: string, ctx: string = 'home'): Promise<Entity[]> {
    try { const saved = this.customizationManager.getSavedCarouselOrderWithContext(aid, 'cameras', ctx); if (saved?.length) { const map = new Map(ents.map(e => [e.entity_id, e])), ord: Entity[] = []; saved.forEach((id: string) => { if (map.has(id)) { ord.push(map.get(id)!); map.delete(id); } }); ord.push(...Array.from(map.values())); return ord; } } catch {} return ents;
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
