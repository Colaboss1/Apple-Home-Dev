import { localize } from '../utils/LocalizationService';

export class AppleSidebar {
  private _hass: any;
  private container: HTMLElement;
  private activePage: string = 'home';
  private onNavigate?: (path: string) => void;
  private onClose?: () => void;
  private lastAreasRef: any = null;
  private _cachedRooms: any = null;
  private lastRoomsJson: string = '';
  private lastActivePage: string = '';
  private renderTimeout: any;
  private lastRenderTimestamp: number = 0;

  constructor(container: HTMLElement) { this.container = container; }

  set hass(h: any) {
    this._hass = h; this.updateActivePage(); const now = Date.now(), throttle = 200;
    if (now - this.lastRenderTimestamp < throttle) {
      if (!this.renderTimeout) this.renderTimeout = setTimeout(() => { this.smartRender(); this.renderTimeout = null; this.lastRenderTimestamp = Date.now(); }, throttle - (now - this.lastRenderTimestamp));
      return;
    }
    this.lastRenderTimestamp = now; this.smartRender();
  }

  setOnClose(cb: () => void) { this.onClose = cb; }
  setOnNavigate(cb: (p: string) => void) { this.onNavigate = cb; }

  private updateActivePage() {
    const p = window.location.pathname;
    if (p.includes('room-')) this.activePage = p.split('room-')[1]?.split('/')[0] || 'home';
    else if (p.includes('automation') || p.includes('scenes')) this.activePage = 'automation';
    else if (p.includes('cameras')) this.activePage = 'cameras';
    else { const s = p.split('/').filter(Boolean), l = s[s.length - 1]; if (['lighting', 'climate', 'security', 'media', 'vacuum', 'energy', 'water', 'other'].includes(l)) this.activePage = l; else this.activePage = 'home'; }
  }

  private extractRooms(): { id: string; name: string; icon: string }[] {
    if (!this._hass) return []; const as = this._hass.areas || {};
    if (this.lastAreasRef === as && this._cachedRooms) return this._cachedRooms;
    this.lastAreasRef = as;
    const rs = Object.keys(as).map(id => ({ id, name: as[id]?.name || id, icon: as[id]?.icon || 'mdi:sofa-outline' })).filter(r => this.count(r.id) > 0).sort((a, b) => a.name.localeCompare(b.name));
    if (this.count('no_area') > 0) rs.unshift({ id: 'no_area', name: localize('pages.default_room') || 'Standardraum', icon: 'mdi:home-outline' });
    this._cachedRooms = rs; return rs;
  }

  private smartRender() {
    if (!this.container) return; const rs = this.extractRooms(), json = JSON.stringify(rs);
    if (json === this.lastRoomsJson && this.activePage === this.lastActivePage) return;
    this.lastRoomsJson = json; this.lastActivePage = this.activePage; this.renderFull(rs);
  }

  private getStyles(): string {
    return `<style>.apple-sidebar-container{position:fixed;top:0;left:0;width:320px;height:100vh;height:100dvh;background:rgba(28,28,30,.98);border-right:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;box-sizing:border-box;z-index:9999;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,sans-serif;color:#fff;overflow:hidden;contain:strict;transform:translateZ(0);will-change:transform}.sidebar-scroll-area{flex:1;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;padding:0 20px 24px 20px;scrollbar-width:none}.sidebar-scroll-area::-webkit-scrollbar{display:none}.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:20px 20px 12px 20px;flex-shrink:0}.sidebar-title{font-size:22px;font-weight:700;letter-spacing:-.3px}.sidebar-toggle-btn{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.1);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .2s,transform .15s;color:rgba(255,255,255,.7);padding:0;flex-shrink:0}.sidebar-toggle-btn ha-icon{--mdc-icon-size:18px}.sidebar-toggle-btn:hover{background:rgba(255,255,255,.15)}.sidebar-toggle-btn:active{transform:scale(.88);background:rgba(255,255,255,.2)}.nav-section{margin-bottom:24px}.nav-section-title{font-size:11px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;padding-left:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif}.nav-item{display:flex;align-items:center;padding:9px 12px;border-radius:12px;cursor:pointer;transition:background-color .2s cubic-bezier(.4,0,.2,1),transform .2s cubic-bezier(.34,1.56,.64,1);margin-bottom:4px;-webkit-tap-highlight-color:transparent;user-select:none}.nav-item:hover{background:rgba(255,255,255,.06)}.nav-item:active{transform:scale(.97);background:rgba(255,255,255,.1)}.nav-item.active{background:rgba(255,255,255,.12)}.nav-item.active .nav-icon{color:#0a84ff}.nav-icon{width:30px;height:30px;display:flex;align-items:center;justify-content:center;margin-right:14px;color:#fff;flex-shrink:0;border-radius:8px;background:rgba(255,255,255,.1);transition:background-color .25s ease,color .25s ease}.nav-item[data-nav="home"] .nav-icon{background:#007aff}.nav-item[data-nav="lighting"] .nav-icon{background:#fc0;color:#000}.nav-item[data-nav="climate"] .nav-icon{background:#ff9500}.nav-item[data-nav="security"] .nav-icon{background:#4cd964}.nav-item[data-nav="media"] .nav-icon{background:#5856d6}.nav-item[data-nav="cameras"] .nav-icon{background:#8e8e93}.nav-icon ha-icon{--mdc-icon-size:18px}.nav-text{font-size:15px;font-weight:500;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nav-badge{margin-left:auto;background:rgba(255,255,255,.12);color:rgba(255,255,255,.6);font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;min-width:18px;text-align:center}.sidebar-divider{height:1px;background:rgba(255,255,255,.08);margin:8px 12px 16px 12px}</style>`;
  }

  private renderFull(rs: { id: string; name: string; icon: string }[]) {
    const p = window.location.pathname, m = p.match(/room-([^/]+)$/), urlid = m ? m[1] : null;
    this.container.innerHTML = ''; const wrap = document.createElement('div'); wrap.className = 'apple-sidebar-container';
    wrap.innerHTML = `${this.getStyles()}<div class="sidebar-header"><span class="sidebar-title">${localize('pages.my_home') || 'Zuhause'}</span><button class="sidebar-toggle-btn" id="close-sidebar-btn"><ha-icon icon="mdi:chevron-left"></ha-icon></button></div><div class="sidebar-scroll-area"><div class="nav-section"><div class="nav-item ${this.activePage === 'home' ? 'active' : ''}" data-nav="home"><div class="nav-icon"><ha-icon icon="mdi:home-variant-outline"></ha-icon></div><div class="nav-text">${localize('pages.my_home') || 'Zuhause'}</div></div><div class="nav-item ${this.activePage === 'automation' ? 'active' : ''}" data-nav="scenes"><div class="nav-icon"><ha-icon icon="mdi:clock-star-four-points"></ha-icon></div><div class="nav-text">${localize('ui_actions.automation') || 'Automation'}</div></div><div class="nav-item ${this.activePage === 'cameras' ? 'active' : ''}" data-nav="cameras"><div class="nav-icon"><ha-icon icon="mdi:cctv"></ha-icon></div><div class="nav-text">${localize('pages.cameras') || 'Kameras'}</div></div></div><div class="sidebar-divider"></div><div class="nav-section"><div class="nav-section-title">Kategorien</div><div class="nav-item ${this.activePage === 'lighting' ? 'active' : ''}" data-nav="lighting"><div class="nav-icon"><ha-icon icon="mdi:lightbulb-outline"></ha-icon></div><div class="nav-text">${localize('groups.lights') || 'Lichtquellen'}</div></div><div class="nav-item ${this.activePage === 'climate' ? 'active' : ''}" data-nav="climate"><div class="nav-icon"><ha-icon icon="mdi:thermometer"></ha-icon></div><div class="nav-text">${localize('groups.climate') || 'Klima'}</div></div><div class="nav-item ${this.activePage === 'security' ? 'active' : ''}" data-nav="security"><div class="nav-icon"><ha-icon icon="mdi:shield-lock-outline"></ha-icon></div><div class="nav-text">${localize('groups.security') || 'Sicherheit'}</div></div><div class="nav-item ${this.activePage === 'media' ? 'active' : ''}" data-nav="media"><div class="nav-icon"><ha-icon icon="mdi:speaker"></ha-icon></div><div class="nav-text">${localize('groups.media') || 'Medien'}</div></div></div><div class="sidebar-divider"></div><div class="nav-section"><div class="nav-section-title">Räume</div>${rs.map(r => `<div class="nav-item ${urlid === r.id || this.activePage === r.id ? 'active' : ''}" data-nav="room" data-room-id="${r.id}"><div class="nav-icon"><ha-icon icon="${r.icon || 'mdi:door-open'}"></ha-icon></div><div class="nav-text">${r.name}</div>${this.count(r.id) ? `<span class="nav-badge">${this.count(r.id)}</span>` : ''}</div>`).join('')}</div></div>`;
    this.container.appendChild(wrap); this.attachListeners(wrap);
  }

  private count(aid: string): number {
    if (!this._hass?.entities) return 0; let c = 0; const es = this._hass.entities;
    Object.keys(es).forEach(id => { const e = es[id]; if ((e?.area_id || 'no_area') === aid && !['automation', 'scene', 'script', 'input_select', 'input_text', 'input_number', 'input_boolean', 'zone', 'sun'].includes(id.split('.')[0]) && !e.hidden_by && !e.disabled_by) c++; });
    return c;
  }

  private attachListeners(w: HTMLElement) {
    w.querySelector('#close-sidebar-btn')?.addEventListener('click', (e) => { e.stopPropagation(); this.onClose?.(); });
    w.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('.nav-item') as HTMLElement; if (!item) return;
      e.stopPropagation(); const nav = item.getAttribute('data-nav'), rid = item.getAttribute('data-room-id'); if (!nav) return;
      let path = ''; switch (nav) { case 'home': path = ''; break; case 'scenes': path = 'scenes'; break; case 'cameras': path = 'cameras'; break; case 'lighting': case 'climate': case 'security': case 'media': case 'vacuum': case 'energy': case 'water': case 'other': path = nav; break; case 'room': if (rid) path = `room-${rid}`; break; }
      this.navigateTo(path);
    });
  }

  private navigateTo(s: string) {
    const c = window.location.pathname, b = c.split('/').filter(Boolean).length > 0 ? `/${c.split('/').filter(Boolean)[0]}/` : '/lovelace/', u = `${b}${s}`;
    if (u === c || u === c + '/') return; window.history.pushState(null, '', u); window.dispatchEvent(new Event('location-changed')); this.onNavigate?.(s); this.updateActivePage(); this.lastActivePage = ''; this.smartRender();
  }
}
