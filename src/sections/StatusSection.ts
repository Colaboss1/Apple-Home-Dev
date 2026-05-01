import { CustomizationManager } from '../utils/CustomizationManager';
import { CardManager } from '../utils/CardManager';
import { DataService } from '../utils/DataService';
import { Entity, CardConfig, Area } from '../types/types';
import { DashboardConfig } from '../config/DashboardConfig';
import { localize } from '../utils/LocalizationService';
import { liquidGlassCSS, LiquidGlassClasses } from '../utils/LiquidGlassStyles';

export interface StatusData { domain: string; icon: string; label: string; value: string; entityIds: string[]; isVisible: boolean; }

export class StatusSection {
  private customizationManager: CustomizationManager;
  private cardManager?: CardManager;
  private _hass?: any;
  private statusItems: StatusData[] = [];
  private _entities?: Entity[];
  private _areaId?: string;
  private _container?: HTMLElement;

  private updateTimeout: any;
  private lastUpdateTimestamp: number = 0;

  constructor(cm: CustomizationManager, cardManager?: CardManager) { this.customizationManager = cm; this.cardManager = cardManager || new CardManager(cm); }
  set hass(h: any) { 
    this._hass = h; 
    if (this._container && this._entities) {
      const now = Date.now();
      if (now - this.lastUpdateTimestamp < 200) {
        if (!this.updateTimeout) {
          this.updateTimeout = setTimeout(() => {
            this.updateStatus(this._entities!, this._hass, this._areaId);
            this.updateTimeout = null;
            this.lastUpdateTimestamp = Date.now();
          }, 200 - (now - this.lastUpdateTimestamp));
        }
        return;
      }
      this.lastUpdateTimestamp = now;
      this.updateStatus(this._entities, h, this._areaId);
    } 
  }

  async render(container: HTMLElement, entities: Entity[], hass: any, areaId?: string): Promise<void> {
    this._hass = hass; this._entities = entities; this._areaId = areaId; this._container = container; this.statusItems = this.generateStatusData(entities, hass); const vis = this.statusItems.filter(i => i.isVisible); if (vis.length === 0) return;
    const sec = document.createElement('div'); sec.className = 'apple-status-section'; sec.innerHTML = this.generateHTML(vis, areaId); container.appendChild(sec); this.attachEventListeners(sec, areaId);
  }

  private async updateStatus(entities: Entity[], hass: any, areaId?: string): Promise<void> {
    if (!this._container) return; const ex = this._container.querySelector('.apple-status-section'); if (!ex) return; const next = this.generateStatusData(entities, hass), vis = next.filter(i => i.isVisible); if (vis.length === 0) { ex.remove(); return; }
    vis.forEach(i => { const chip = ex.querySelector(`[data-domain="${i.domain}"]`); if (chip) { const v = chip.querySelector('.status-chip-value'); if (v && v.textContent !== i.value) v.textContent = i.value; const oldIds = chip.getAttribute('data-entity-ids'); const newIds = i.entityIds.join(','); if (oldIds !== newIds) chip.setAttribute('data-entity-ids', newIds); } }); this.statusItems = next;
  }

  private generateStatusData(entities: Entity[], hass: any): StatusData[] {
    const map = new Map<string, StatusData>(), types = [{ domain: 'lights', icon: 'mdi:lightbulb', label: localize('status_section.lights') }, { domain: 'switches', icon: 'mdi:toggle-switch', label: localize('status_section.switches') }, { domain: 'outlets', icon: 'mdi:power-socket', label: localize('status_section.outlets') }, { domain: 'temperature', icon: 'mdi:thermometer', label: localize('status_section.temperature') }, { domain: 'humidity', icon: 'mdi:water-percent', label: localize('status_section.humidity') }, { domain: 'covers', icon: 'mdi:blinds-horizontal', label: localize('status_section.blinds') }, { domain: 'gates', icon: 'mdi:garage-variant', label: localize('status_section.garage_doors') }, { domain: 'security', icon: 'mdi:shield-check', label: localize('status_section.security') }, { domain: 'locks', icon: 'mdi:lock', label: localize('status_section.locks') }, { domain: 'motion', icon: 'mdi:motion-sensor', label: localize('status_section.motion') }, { domain: 'occupancy', icon: 'mdi:account-check', label: localize('status_section.occupancy') }, { domain: 'light_sensor', icon: 'mdi:brightness-6', label: localize('status_section.light') }, { domain: 'smoke', icon: 'mdi:smoke-detector', label: localize('status_section.smoke') }, { domain: 'gas', icon: 'mdi:gas-cylinder', label: localize('status_section.gas') }, { domain: 'flood', icon: 'mdi:water-alert', label: localize('status_section.flood') }, { domain: 'battery', icon: 'mdi:battery-low', label: localize('status_section.battery') }, { domain: 'doors', icon: 'mdi:door', label: localize('status_section.doors') }, { domain: 'windows', icon: 'mdi:window-open', label: localize('status_section.windows') }, { domain: 'contact', icon: 'mdi:door-open', label: localize('contact.contact_sensors') }, { domain: 'tvs', icon: 'mdi:television', label: localize('status_section.tvs') }, { domain: 'speakers', icon: 'mdi:speaker', label: localize('status_section.speakers') }];
    types.forEach(t => map.set(t.domain, { domain: t.domain, icon: t.icon, label: t.label, value: '', entityIds: [], isVisible: false }));
    entities.forEach(e => { const s = hass.states[e.entity_id]; if (s) this.categorizeEntity(e.entity_id, e.entity_id.split('.')[0], s.attributes?.device_class, s, map); });
    types.forEach(t => { const s = map.get(t.domain); if (s && s.entityIds.length > 0 && s.entityIds.some(id => hass.states[id]?.state && !['unavailable', 'unknown'].includes(hass.states[id].state))) { s.value = this.calculateStatusValue(t.domain, s.entityIds, hass); s.isVisible = true; } }); return Array.from(map.values());
  }

  private categorizeEntity(id: string, dom: string, dc: string | undefined, s: any, map: Map<string, StatusData>): void {
    if (dom === 'light') map.get('lights')?.entityIds.push(id);
    else if (dom === 'switch') { if (DashboardConfig.isOutlet(id, s.attributes)) map.get('outlets')?.entityIds.push(id); else map.get('switches')?.entityIds.push(id); }
    else if ((dom === 'sensor' && (dc === 'temperature' || s.attributes?.unit_of_measurement === '°C' || s.attributes?.unit_of_measurement === '°F')) || dom === 'climate' || dom === 'water_heater') map.get('temperature')?.entityIds.push(id);
    else if (dom === 'sensor' && dc === 'humidity') map.get('humidity')?.entityIds.push(id);
    else if (dom === 'cover') { if (DashboardConfig.isGarageDoorOrGate(id, s.attributes)) map.get('gates')?.entityIds.push(id); else map.get('covers')?.entityIds.push(id); }
    else if (dom === 'alarm_control_panel') map.get('security')?.entityIds.push(id);
    else if (dom === 'lock') map.get('locks')?.entityIds.push(id);
    else if (dom === 'binary_sensor' && dc === 'motion') map.get('motion')?.entityIds.push(id);
    else if (dom === 'binary_sensor' && dc === 'occupancy') map.get('occupancy')?.entityIds.push(id);
    else if (dom === 'sensor' && (dc === 'illuminance' || s.attributes?.unit_of_measurement === 'lx')) map.get('light_sensor')?.entityIds.push(id);
    else if (dom === 'binary_sensor' && dc === 'smoke') map.get('smoke')?.entityIds.push(id);
    else if (dom === 'binary_sensor' && dc === 'gas') map.get('gas')?.entityIds.push(id);
    else if (dom === 'binary_sensor' && (dc === 'moisture' || dc === 'water_leak')) map.get('flood')?.entityIds.push(id);
    else if (dom === 'sensor' && dc === 'battery' && parseFloat(s.state) < 20) map.get('battery')?.entityIds.push(id);
    else if (dom === 'binary_sensor' && dc === 'door') map.get('doors')?.entityIds.push(id);
    else if (dom === 'binary_sensor' && dc === 'window') map.get('windows')?.entityIds.push(id);
    else if (dom === 'binary_sensor' && dc === 'opening') map.get('contact')?.entityIds.push(id);
    else if (dom === 'media_player') { if (dc === 'tv' || id.includes('tv')) map.get('tvs')?.entityIds.push(id); else map.get('speakers')?.entityIds.push(id); }
  }

  private calculateStatusValue(dom: string, ids: string[], hass: any): string {
    switch (dom) {
      case 'lights': case 'switches': case 'outlets': return this.calculateOnOffStatus(ids, hass);
      case 'temperature': return this.calculateTemperatureRange(ids, hass);
      case 'humidity': return this.calculateHumidityRange(ids, hass);
      case 'covers': case 'gates': return this.calculateCoverStatus(ids, hass);
      case 'security': return this.calculateSecurityStatus(ids, hass);
      case 'locks': return this.calculateLockStatus(ids, hass);
      case 'motion': return this.calculateMotionStatus(ids, hass);
      case 'occupancy': return this.calculateOccupancyStatus(ids, hass);
      case 'light_sensor': return this.calculateLightSensorRange(ids, hass);
      case 'smoke': return this.calculateSmokeStatus(ids, hass);
      case 'gas': return this.calculateGasStatus(ids, hass);
      case 'flood': return this.calculateFloodStatus(ids, hass);
      case 'battery': return ids.length === 1 ? localize('battery.low_battery') : localize('battery.low_battery_count').replace('{count}', ids.length.toString());
      case 'doors': case 'windows': case 'contact': return this.calculateContactStatus(ids, hass);
      case 'tvs': case 'speakers': return this.calculateMediaStatus(ids, hass);
      default: return '';
    }
  }

  private calculateOnOffStatus(ids: string[], h: any): string { const on = ids.filter(id => { const s = h.states[id]; return s && (s.state === 'on' || s.state === 'playing'); }).length; if (on === 0) return localize('lights.all_off'); if (on === ids.length) return on === 1 ? localize('lights.on') : localize('lights.all_on'); return `${on} ${localize('lights.on')}`; }
  private calculateTemperatureRange(ids: string[], h: any): string { const tps: number[] = []; ids.forEach(id => { const s = h.states[id]; if (!s) return; let t = id.split('.')[0] === 'climate' ? s.attributes?.current_temperature : parseFloat(s.state); if (typeof t === 'number' && !isNaN(t) && t > -100 && t < 200) tps.push(t); }); if (tps.length === 0) return ''; if (tps.length === 1) return `${tps[0].toFixed(1)}°`; const min = Math.min(...tps), max = Math.max(...tps); return Math.abs(min - max) < 0.1 ? `${min.toFixed(1)}°` : `${min.toFixed(1)}°-${max.toFixed(1)}°`; }
  private calculateHumidityRange(ids: string[], h: any): string { const hms: number[] = []; ids.forEach(id => { const s = h.states[id]; if (s) { const hm = parseFloat(s.state); if (!isNaN(hm) && hm >= 0 && hm <= 100) hms.push(Math.round(hm)); } }); if (hms.length === 0) return ''; if (hms.length === 1) return `${hms[0]}%`; const min = Math.min(...hms), max = Math.max(...hms); return min === max ? `${min}%` : `${min}%-${max}%`; }

  private generateHTML(items: StatusData[], aid?: string): string {
    return `<style>.apple-status-section{display:block;margin-top:10px;width:100%}.status-carousel-container{overflow-x:auto;overflow-y:hidden;margin-inline-start:calc(-1*var(--apple-page-padding,22px));margin-inline-end:calc(-1*var(--apple-page-padding,22px));-webkit-overflow-scrolling:touch;scrollbar-width:none;-ms-overflow-style:none}.status-carousel-container::-webkit-scrollbar{display:none}.status-chips-grid{display:inline-flex;gap:28px;align-items:center;padding-inline-start:var(--apple-page-padding,22px);padding-inline-end:var(--apple-page-padding,22px);min-width:100%;box-sizing:border-box;height:48px}.status-chip{display:flex;align-items:center;gap:6px;background:transparent;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif;cursor:pointer;transition:background-color .2s ease,color .2s ease,opacity .2s ease;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;min-height:32px;white-space:nowrap;flex-shrink:0}.status-chip-icon,.status-chip-icon ha-icon{width:20px;height:20px;display:flex;align-items:center;justify-content:center;color:#fff}.status-chip-content{display:flex;flex-direction:column;gap:0}.status-chip-label{font-size:var(--apple-chip-name-size,13px);font-weight:600;color:#fff;line-height:1.2;letter-spacing:-.2px}.status-chip-value{font-size:var(--apple-chip-status-size,11px);font-weight:500;color:#fff;line-height:1.2;opacity:.9}</style><div class="apple-status-section"><div class="status-carousel-container"><div class="status-chips-grid">${items.map(i => `<div class="status-chip" data-domain="${i.domain}" data-entity-ids="${i.entityIds.join(',')}"><div class="status-chip-icon"><ha-icon icon="${i.icon}"></ha-icon></div><div class="status-chip-content"><span class="status-chip-label">${i.label}</span><span class="status-chip-value">${i.value}</span></div></div>`).join('')}</div></div></div>`;
  }

  private attachEventListeners(sec: HTMLElement, aid?: string): void { sec.querySelectorAll('.status-chip').forEach(c => c.addEventListener('click', () => { const d = c.getAttribute('data-domain'), i = this.statusItems.find(x => x.domain === d); if (i) this.handleStatusChipClick(i, aid); })); }
  private calculateCoverStatus(ids: string[], h: any): string { const open = ids.filter(id => h.states[id]?.state === 'open').length; if (open === 0) return localize('covers.all_closed'); if (open === ids.length) return open === 1 ? localize('covers.open') : localize('covers.all_open'); return `${open} ${localize('covers.open')}`; }
  private calculateSecurityStatus(ids: string[], h: any): string { if (ids.length === 1) return h.states[ids[0]]?.state?.replace(/_/g, ' ').replace(/\b\w/g, (x: string) => x.toUpperCase()) || 'Unknown'; const armed = ids.filter(id => { const s = h.states[id]; return s && s.state !== "disarmed" && s.state.includes('armed'); }).length; return armed === 0 ? localize('status.disarmed') : `${armed} ${localize('status.armed')}`; }
  private calculateLockStatus(ids: string[], h: any): string { const unl = ids.filter(id => h.states[id]?.state === 'unlocked').length; if (unl === 0) return localize('status_section.all_locked'); if (unl === ids.length) return unl === 1 ? localize('status.unlocked') : localize('status_section.all_unlocked'); return `${unl} ${localize('status.unlocked')}`; }
  private calculateMotionStatus(ids: string[], h: any): string { const act = ids.filter(id => h.states[id]?.state === 'on').length; return act === 0 ? localize('motion.not_detected') : (act === 1 ? localize('motion.detected') : `${act} ${localize('motion.detected')}`); }
  private calculateOccupancyStatus(ids: string[], h: any): string { const act = ids.filter(id => h.states[id]?.state === 'on').length; return act === 0 ? localize('occupancy.not_detected') : (act === 1 ? localize('occupancy.detected') : `${act} ${localize('occupancy.detected')}`); }
  private calculateLightSensorRange(ids: string[], h: any): string { const lx: number[] = []; ids.forEach(id => { const s = h.states[id]; if (s) { const v = parseFloat(s.state); if (!isNaN(v) && v >= 0) lx.push(Math.round(v)); } }); if (lx.length === 0) return ''; if (lx.length === 1) return `${lx[0]} lx`; const min = Math.min(...lx), max = Math.max(...lx); return min === max ? `${min} lx` : `${min}-${max} lx`; }
  private calculateSmokeStatus(ids: string[], h: any): string { return ids.filter(id => h.states[id]?.state === 'on').length === 0 ? localize('smoke.not_detected') : localize('smoke.detected'); }
  private calculateGasStatus(ids: string[], h: any): string { return ids.filter(id => h.states[id]?.state === 'on').length === 0 ? localize('gas.not_detected') : localize('gas.detected'); }
  private calculateFloodStatus(ids: string[], h: any): string { return ids.filter(id => h.states[id]?.state === 'on').length === 0 ? localize('flood.not_detected') : localize('flood.detected'); }
  private calculateContactStatus(ids: string[], h: any): string { const open = ids.filter(id => h.states[id]?.state === 'on').length; if (open === 0) return localize('contact.all_closed'); return open === 1 ? `1 ${localize('covers.open')}` : `${open} ${localize('covers.open')}`; }
  private calculateMediaStatus(ids: string[], h: any): string { const pl = ids.filter(id => h.states[id]?.state === 'playing').length; if (pl > 0) return pl === 1 ? localize('media.playing') : `${pl} ${localize('media.multiple_playing')}`; const on = ids.filter(id => h.states[id]?.state && !['off', 'unavailable', 'standby'].includes(h.states[id].state)).length; if (on === 0) return localize('lights.all_off'); return on === ids.length ? (on === 1 ? localize('lights.on') : localize('lights.all_on')) : `${on} ${localize('lights.on')}`; }
  private handleStatusChipClick(i: StatusData, aid?: string): void { if (i.entityIds.length === 1) this.openMoreInfoDialog(i.entityIds[0]); else this.openStatusModal(i, aid); }
  private openMoreInfoDialog(id: string): void { if (this._hass) { const e = new CustomEvent('hass-more-info', { detail: { entityId: id }, bubbles: true, composed: true }); const targets = [document.querySelector('ha-app'), document.querySelector('home-assistant'), document.querySelector('hui-root'), document.querySelector('ha-panel-lovelace')].filter(Boolean); if (targets.length > 0) { targets.forEach(t => t?.dispatchEvent(e)); } else { document.body.dispatchEvent(e); } } }

  private async groupEntitiesByArea(ids: string[]): Promise<{ [aid: string]: string[] }> {
    const res: { [aid: string]: string[] } = {}; let as: Area[] = [], ds: any[] = [], es: Entity[] = [];
    try { [as, ds, es] = await Promise.all([DataService.getAreas(this._hass), DataService.getDevices(this._hass), DataService.getEntities(this._hass)]); } catch {}
    as.forEach(a => res[a.area_id] = []); res['no_area'] = [];
    for (const id of ids) { const r = es.find(e => e.entity_id === id); let aid = r?.area_id; if (!aid && r?.device_id) aid = ds.find(d => d.id === r.device_id)?.area_id; if (!aid) aid = 'no_area'; if (!res[aid]) res[aid] = []; res[aid].push(id); }
    Object.keys(res).forEach(k => { if (res[k].length === 0) delete res[k]; }); return res;
  }

  private async openStatusModal(i: StatusData, aid?: string): Promise<void> {
    const modal = document.createElement('div'); modal.className = 'status-modal-backdrop';
    const cnt = document.createElement('div'); cnt.className = 'status-modal-content';
    const hdr = document.createElement('div'); hdr.className = 'status-modal-header'; hdr.innerHTML = `<button class="modal-close ${LiquidGlassClasses.modalCancel}"><ha-icon icon="mdi:close"></ha-icon></button><h2>${i.label}</h2>`;
    const body = document.createElement('div'); body.className = 'status-modal-body';
    const grouped = await this.groupEntitiesByArea(i.entityIds);
    for (const [rid, reids] of Object.entries(grouped) as [string, string[]][]) {
      if (reids.length === 0) continue; let aname = rid; if (rid !== 'no_area') { try { const as = await DataService.getAreas(this._hass); aname = as.find((a: Area) => a.area_id === rid)?.name || rid; } catch {} } else aname = localize('pages.default_room');
      const t = document.createElement('div'); t.className = 'status-modal-room-title'; t.innerHTML = `<span>${aname}</span>`; body.appendChild(t);
      const grid = document.createElement('div'); grid.className = 'status-modal-cards'; grid.dataset.areaId = rid;
      for (const eid of reids) { const c = this.createEntityCard(eid, this._hass); if (c) await this.createAndAppendCard(c, grid, this._hass, rid); }
      body.appendChild(grid);
    }
    cnt.appendChild(hdr); cnt.appendChild(body); modal.appendChild(cnt);
    const close = () => { modal.classList.remove('show'); setTimeout(() => modal.remove(), 300); };
    hdr.querySelector('.modal-close')?.addEventListener('click', close); modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.addEventListener('hass-more-info', (e: Event) => { e.stopPropagation(); const ev = e as CustomEvent; close(); setTimeout(() => { const targets = [document.querySelector('ha-app'), document.querySelector('home-assistant'), document.querySelector('hui-root'), document.querySelector('ha-panel-lovelace')].filter(Boolean); if (targets.length > 0) { targets.forEach(t => t?.dispatchEvent(new CustomEvent('hass-more-info', { detail: ev.detail, bubbles: true, composed: true }))); } else { document.body.dispatchEvent(new CustomEvent('hass-more-info', { detail: ev.detail, bubbles: true, composed: true })); } }, 100); });
    document.body.appendChild(modal); this.addModalStyles(); requestAnimationFrame(() => modal.classList.add('show'));
  }

  private createEntityCard(eid: string, h: any): CardConfig | null {
    const s = h.states[eid]; if (!s) return null; const dom = eid.split('.')[0], c: CardConfig = { type: 'custom:apple-home-card', entity: eid, name: s.attributes?.friendly_name || eid.split('.')[1].replace(/_/g, ' '), domain: dom, is_tall: DashboardConfig.isDefaultTallDomain(dom) };
    if (!s.attributes?.icon) {
      let icon = ''; if (DashboardConfig.isScenesDomain(dom)) icon = 'mdi:home';
      else if (dom === 'sensor') { switch (s.attributes?.device_class) { case 'temperature': icon = 'mdi:thermometer'; break; case 'humidity': icon = 'mdi:water-percent'; break; case 'illuminance': icon = 'mdi:brightness-6'; break; case 'battery': icon = 'mdi:battery'; break; default: icon = 'mdi:gauge'; } }
      else if (dom === 'binary_sensor') { switch (s.attributes?.device_class) { case 'motion': icon = 'mdi:motion-sensor'; break; case 'occupancy': icon = 'mdi:account-check'; break; case 'door': icon = 'mdi:door'; break; case 'window': icon = 'mdi:window-open'; break; case 'contact': icon = 'mdi:door-open'; break; case 'smoke': icon = 'mdi:smoke-detector'; break; case 'gas': icon = 'mdi:gas-cylinder'; break; case 'moisture': case 'water_leak': icon = 'mdi:water-alert'; break; default: icon = 'mdi:checkbox-marked-circle'; } }
      if (icon) (c as any).default_icon = icon;
    } return c;
  }

  private async createAndAppendCard(conf: any, container: HTMLElement, h: any, aid?: string): Promise<void> {
    try {
      let el: HTMLElement;
      if (conf.type === 'custom:apple-home-card') { el = document.createElement('apple-home-card') as HTMLElement; const tall = this.cardManager?.shouldCardBeTall(conf.entity, aid || 'unknown', 'modal') || conf.is_tall, c = { ...conf, is_tall: tall }; if (conf.default_icon) c.default_icon = conf.default_icon; (el as any).setConfig(c); (el as any).hass = h; }
      else { const type = conf.type.replace('custom:', ''); if (customElements.get(type)) { el = document.createElement(type); if (el && typeof (el as any).setConfig === 'function') { (el as any).setConfig(conf); (el as any).hass = h; } } else { el = document.createElement('div'); el.innerHTML = `<div style="color:red;">Unknown: ${conf.type}</div>`; } }
      const wrap = document.createElement('div'); wrap.className = 'entity-card-wrapper'; wrap.dataset.entityId = conf.entity; if (this.cardManager?.shouldCardBeTall(conf.entity, aid || 'unknown', 'modal') || conf.is_tall) wrap.classList.add('tall'); wrap.appendChild(el!); container.appendChild(wrap);
    } catch {}
  }

  private addModalStyles(): void {
    if (document.querySelector('#status-modal-styles')) return; const s = document.createElement('style'); s.id = 'status-modal-styles';
    s.textContent = `.status-modal-backdrop{position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;background:rgba(0,0,0,.6);backdrop-filter:none;-webkit-backdrop-filter:none;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .3s ease}.status-modal-backdrop.show{opacity:1}.status-modal-content{position:relative;width:800px;max-width:90vw;max-height:80vh;background:#1c1c1e;border-radius:var(--apple-modal-radius,20px);overflow-y:auto;overflow-x:hidden;box-shadow:0 20px 40px rgba(0,0,0,.5);transform:scale(.9);opacity:0;transition:transform .3s cubic-bezier(.25,.46,.45,.94),opacity .3s cubic-bezier(.25,.46,.45,.94)}.status-modal-backdrop.show .status-modal-content{transform:scale(1);opacity:1}${liquidGlassCSS}.status-modal-header{background:transparent;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;position:sticky;top:0;z-index:10}.status-modal-header::before{content:'';position:absolute;top:0;left:0;right:0;bottom:-30px;background:linear-gradient(to bottom,#1c1c1e 0%,rgba(28,28,30,.95) 30%,rgba(28,28,30,.7) 60%,rgba(28,28,30,0) 100%);z-index:-1;pointer-events:none}.status-modal-header h2{margin:0;font-size:17px;font-weight:600;color:#fff;text-align:center;flex:1}.status-modal-header .modal-close{z-index:2}.status-modal-body{padding:0 20px 20px}.status-modal-room-title{margin:0 0 8px;font-size:13px;font-weight:400;letter-spacing:.5px;color:rgba(255,255,255,.6);text-transform:uppercase}.status-modal-room-title:first-child{margin-top:0}.status-modal-cards{display:grid;grid-template-columns:repeat(12,1fr);grid-auto-rows:var(--apple-card-height,70px);gap:var(--apple-card-gap,10px);auto-rows:min-content;margin-bottom:var(--apple-section-gap,20px);container-type:inline-size}.status-modal-cards:last-child{margin-bottom:0}.entity-card-wrapper{display:flex;flex-direction:column;position:relative;grid-column:span var(--apple-card-span-desktop,3);border-radius:var(--apple-card-radius,22px);overflow:hidden}.entity-card-wrapper.tall{grid-row:span 2}.entity-card-wrapper apple-home-card{width:100%;height:100%;border-radius:var(--apple-card-radius,22px)}@container (min-width: 900px){.entity-card-wrapper{grid-column:span var(--apple-card-span-desktop,3)}}@container (min-width: 600px) and (max-width: 899px){.entity-card-wrapper{grid-column:span var(--apple-card-span-mobile,4)}}@container (min-width: 400px) and (max-width: 599px){.entity-card-wrapper{grid-column:span var(--apple-card-span-small,6)}.status-modal-cards{grid-auto-rows:68px;gap:10px}}@container (max-width: 399px){.entity-card-wrapper{grid-column:span 12!important}.status-modal-cards{grid-auto-rows:64px;gap:8px}}@media (max-width:767px){.entity-card-wrapper{grid-column:span 6}.status-modal-cards{grid-auto-rows:68px;gap:10px}}@media (max-width:359px){.entity-card-wrapper{grid-column:span 12!important}.status-modal-cards{grid-auto-rows:64px}}@media (max-width:768px){.status-modal-content{width:100vw;max-width:100vw;height:calc(100dvh - env(safe-area-inset-top) - 20px);max-height:calc(100dvh - env(safe-area-inset-top) - 20px);border-radius:var(--apple-modal-radius,20px) var(--apple-modal-radius,20px) 0 0;transform:translateY(100%)}.status-modal-backdrop.show .status-modal-content{transform:translateY(0)}.status-card-wrapper{height:120px}.status-card-wrapper.tall{height:240px}}`;
    document.head.appendChild(s);
  }
}
