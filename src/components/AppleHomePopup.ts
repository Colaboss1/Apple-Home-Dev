import { localize } from '../utils/LocalizationService';

export class AppleHomePopup extends HTMLElement {
  private _hass: any;
  private entityId!: string;
  private domain!: string;
  private sliderValue: number = 0;
  private minValue: number = 0;
  private maxValue: number = 100;
  private isDragging: boolean = false;
  private updateTimeout: any;

  constructor() { super(); this.attachShadow({ mode: 'open' }); }

  public setup(hass: any, entityId: string) { this._hass = hass; this.entityId = entityId; this.domain = entityId.split('.')[0]; this.initializeState(); this.render(); this.setupListeners(); }

  connectedCallback() { document.body.style.overflow = 'hidden'; }
  disconnectedCallback() { document.body.style.overflow = ''; }

  private initializeState() {
    const s = this._hass.states[this.entityId]; if (!s) return;
    if (this.domain === 'light') { const b = s.attributes.brightness || 0; this.sliderValue = s.state === 'off' ? 0 : Math.round((b / 255) * 100); this.maxValue = 100; }
    else if (this.domain === 'cover') { this.sliderValue = s.attributes.current_position || 0; this.maxValue = 100; }
    else if (this.domain === 'climate' || this.domain === 'water_heater') { this.minValue = s.attributes.min_temp || 15; this.maxValue = s.attributes.max_temp || 30; const c = s.attributes.temperature || this.minValue; this.sliderValue = Math.max(this.minValue, Math.min(this.maxValue, c)); }
    else if (this.domain === 'media_player') { const v = s.attributes.volume_level || 0; this.sliderValue = Math.round(v * 100); this.maxValue = 100; }
  }

  private render() {
    const s = this._hass.states[this.entityId]; if (!s) return;
    const name = s.attributes.friendly_name || this.entityId; let icon = 'mdi:lightbulb', trackClass = 'light-track';
    if (this.domain === 'cover') { icon = 'mdi:window-shutter'; trackClass = 'cover-track'; }
    else if (this.domain === 'climate' || this.domain === 'water_heater') { icon = 'mdi:thermometer'; trackClass = 'climate-track'; }
    else if (this.domain === 'media_player') { icon = 'mdi:speaker'; trackClass = 'media-track'; }
    let pct = this.domain === 'climate' || this.domain === 'water_heater' ? ((this.sliderValue - this.minValue) / (this.maxValue - this.minValue)) * 100 : this.sliderValue;
    pct = Math.max(0, Math.min(100, pct));
    const supportsColor = s.attributes.supported_color_modes?.some((m: string) => ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'].includes(m)), supportsTemp = s.attributes.supported_color_modes?.includes('color_temp');
    this.shadowRoot!.innerHTML = `<style>:host{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:100000;display:flex;align-items:center;justify-content:center;animation:fadeIn .2s cubic-bezier(.16,1,.3,1);font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,sans-serif}.backdrop{position:absolute;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,.4);backdrop-filter:blur(40px) saturate(1.5);-webkit-backdrop-filter:blur(40px) saturate(1.5);transform:translateZ(0);will-change:transform,backdrop-filter;z-index:100001;pointer-events:auto;cursor:pointer}@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes scaleUp{from{transform:scale(.9);opacity:0}to{transform:scale(1);opacity:1}}.popup-container{position:relative;display:flex;flex-direction:column;align-items:center;animation:scaleUp .2s cubic-bezier(.16,1,.3,1);width:100%;max-width:450px;padding:30px;box-sizing:border-box;z-index:100002;pointer-events:auto;cursor:default}.slider-container{position:relative;width:130px;height:380px;background:rgba(255,255,255,.15);border-radius:45px;overflow:hidden;box-shadow:0 4px 30px rgba(0,0,0,.1);touch-action:none;margin-bottom:30px;transform:translateZ(0)}.slider-track{position:absolute;bottom:0;left:0;width:100%;height:${pct}%;background:#fff;transition:${this.isDragging ? 'none' : 'height .3s cubic-bezier(.2,.8,.2,1)'};will-change:height}.light-track{background:#fc0}.cover-track{background:#fff}.climate-track{background:#ff9f0a}.media-track{background:rgba(255,255,255,.9)}.slider-icon{position:absolute;bottom:30px;left:50%;transform:translateX(-50%);color:${pct > 10 ? '#000' : '#fff'};transition:color .3s ease;pointer-events:none;z-index:2;display:flex;align-items:center;justify-content:center}.slider-icon ha-icon{--mdc-icon-size:38px}.header{display:flex;flex-direction:column;align-items:center;margin-bottom:35px;color:#fff;text-align:center}.entity-name{font-size:34px;font-weight:700;letter-spacing:-.8px;margin-bottom:5px;text-shadow:0 2px 10px rgba(0,0,0,.2);text-align:center}.entity-state{font-size:18px;font-weight:600;color:rgba(255,255,255,.75);letter-spacing:-.2px}.color-section{width:100%;display:flex;flex-direction:column;align-items:center;margin-bottom:30px;display:none}:host(.supports-color) .color-section{display:flex}.color-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;width:100%;max-width:320px}.color-circle{width:44px;height:44px;border-radius:50%;border:2px solid transparent;cursor:pointer;transition:transform .2s cubic-bezier(.2,.8,.2,1),border-color .2s;box-shadow:0 2px 10px rgba(0,0,0,.2)}.color-circle:active{transform:scale(.85)}.color-circle.selected{border-color:#fff;transform:scale(1.1)}.controls{display:flex;gap:25px;margin-top:10px}.control-btn{width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;color:#fff;cursor:pointer;backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.1);transition:all .2s cubic-bezier(.2,.8,.2,1)}.control-btn:hover{background:rgba(255,255,255,.25)}.control-btn:active{transform:scale(.9);background:rgba(255,255,255,.35)}.control-btn ha-icon{--mdc-icon-size:28px}</style><div class="backdrop" id="backdrop"></div><div class="popup-container"><div class="header"><div class="entity-name">${name}</div><div class="entity-state" id="state-text">${this.formatStateText()}</div></div><div class="slider-container" id="slider"><div class="slider-track ${trackClass}" id="track"></div><div class="slider-icon"><ha-icon icon="${icon}"></ha-icon></div></div>${supportsColor || supportsTemp ? `<div class="color-section"><div class="color-grid">${this.renderColorCircles()}</div></div>` : ''}<div class="controls"><div class="control-btn" id="toggle-btn"><ha-icon icon="mdi:power"></ha-icon></div><div class="control-btn" id="settings-btn"><ha-icon icon="mdi:cog"></ha-icon></div></div></div>`;
  }

  private renderColorCircles(): string {
    const s = this._hass.states[this.entityId];
    if (this.domain === 'light') { if (s?.attributes.supported_color_modes?.some((m: string) => ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'].includes(m)) || s?.attributes.supported_color_modes?.includes('color_temp')) this.classList.add('supports-color'); else this.classList.remove('supports-color'); }
    if (this.domain !== 'light' || !this.classList.contains('supports-color')) return ''; const res: string[] = [];
    if (s?.attributes.supported_color_modes?.some((m: string) => ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'].includes(m))) { [{ rgb: '255,255,255' }, { rgb: '255,159,10' }, { rgb: '0,122,255' }, { rgb: '255,45,85' }, { rgb: '175,82,222' }, { rgb: '90,200,250' }].forEach(c => res.push(`<div class="color-circle" style="background: rgb(${c.rgb})" data-rgb="${c.rgb}"></div>`)); }
    if (s?.attributes.supported_color_modes?.includes('color_temp')) { [{ temp: 153, color: '#fcf8ff' }, { temp: 250, color: '#fffd9f' }, { temp: 370, color: '#ffcc00' }, { temp: 500, color: '#ff9500' }].forEach(t => res.push(`<div class="color-circle" style="background: ${t.color}" data-temp="${t.temp}"></div>`)); }
    return res.join('');
  }

  private formatStateText(): string { return this.domain === 'climate' || this.domain === 'water_heater' ? `${this.sliderValue}°` : `${this.sliderValue}%`; }

  private setupListeners() {
    const s = this.shadowRoot!.getElementById('slider'), t = this.shadowRoot!.getElementById('track'), st = this.shadowRoot!.getElementById('state-text'), tb = this.shadowRoot!.getElementById('toggle-btn'), sb = this.shadowRoot!.getElementById('settings-btn'), b = this.shadowRoot!.getElementById('backdrop'), i = this.shadowRoot!.querySelector('.slider-icon') as HTMLElement, cc = this.shadowRoot!.querySelectorAll('.color-circle');
    if (!s || !t) return;
    const upd = (clientY: number) => { const r = s.getBoundingClientRect(); let p = Math.max(0, Math.min(100, ((r.bottom - clientY) / r.height) * 100)); t.style.height = `${p}%`; if (i) i.style.color = p > 10 ? '#000' : '#fff'; if (this.domain === 'climate' || this.domain === 'water_heater') { this.sliderValue = Math.round((this.minValue + ((p / 100) * (this.maxValue - this.minValue))) * 10) / 10; if (st) st.textContent = `${this.sliderValue}°`; } else { this.sliderValue = Math.round(p); if (st) st.textContent = `${this.sliderValue}%`; } };
    const commit = () => { this.isDragging = false; t.style.transition = 'height 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'; if (this.updateTimeout) clearTimeout(this.updateTimeout); this.updateTimeout = setTimeout(() => { if (this.domain === 'light') { if (this.sliderValue === 0) this._hass.callService('light', 'turn_off', { entity_id: this.entityId }); else this._hass.callService('light', 'turn_on', { entity_id: this.entityId, brightness_pct: this.sliderValue }); } else if (this.domain === 'cover') this._hass.callService('cover', 'set_cover_position', { entity_id: this.entityId, position: this.sliderValue }); else if (this.domain === 'climate' || this.domain === 'water_heater') this._hass.callService(this.domain, 'set_temperature', { entity_id: this.entityId, temperature: this.sliderValue }); else if (this.domain === 'media_player') this._hass.callService('media_player', 'volume_set', { entity_id: this.entityId, volume_level: this.sliderValue / 100 }); }, 50); };
    b?.addEventListener('click', (e) => { e.stopPropagation(); this.remove(); }, { capture: true }); this.addEventListener('click', (e) => { if (e.target === this) { e.stopPropagation(); this.remove(); } }); this.shadowRoot!.querySelector('.popup-container')?.addEventListener('click', (e) => e.stopPropagation());
    const hcs = (e: Event) => { const tg = e.currentTarget as HTMLElement, rgb = tg.getAttribute('data-rgb'), tmp = tg.getAttribute('data-temp'); cc.forEach(c => c.classList.remove('selected')); tg.classList.add('selected'); if (rgb) { const [r, g, b_v] = rgb.split(',').map(Number); this._hass.callService('light', 'turn_on', { entity_id: this.entityId, rgb_color: [r, g, b_v] }); } else if (tmp) this._hass.callService('light', 'turn_on', { entity_id: this.entityId, color_temp: Number(tmp) }); };
    cc.forEach(c => { c.addEventListener('click', hcs); c.addEventListener('touchend', (e) => { e.preventDefault(); hcs(e); }); });
    s.addEventListener('touchstart', (e) => { e.preventDefault(); this.isDragging = true; t.style.transition = 'none'; upd(e.touches[0].clientY); });
    s.addEventListener('touchmove', (e) => { if (!this.isDragging) return; e.preventDefault(); upd(e.touches[0].clientY); });
    s.addEventListener('touchend', () => { if (this.isDragging) commit(); });
    s.addEventListener('mousedown', (e) => { e.preventDefault(); this.isDragging = true; t.style.transition = 'none'; upd(e.clientY); });
    const mv = (e: MouseEvent) => { if (this.isDragging) { e.preventDefault(); upd(e.clientY); } }, up = () => { if (this.isDragging) commit(); };
    document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    const orig = this.remove; this.remove = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); orig.call(this); };
    tb?.addEventListener('click', () => { this._hass.callService(this.domain, 'toggle', { entity_id: this.entityId }); setTimeout(() => this.remove(), 200); });
    sb?.addEventListener('click', () => { this.remove(); this.dispatchEvent(new CustomEvent('hass-more-info', { bubbles: true, composed: true, detail: { entityId: this.entityId } })); });
  }
}
if (!customElements.get('apple-home-popup')) customElements.define('apple-home-popup', AppleHomePopup);
