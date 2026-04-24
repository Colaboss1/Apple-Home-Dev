import { DashboardConfig } from '../config/DashboardConfig';
import { SnapshotManager } from '../utils/SnapshotManager';
import { CardConfig } from '../types/types';
import { localize } from '../utils/LocalizationService';
import { RTLHelper } from '../utils/RTLHelper';

export class AppleHomeCard extends HTMLElement {
  private static _styles?: CSSStyleSheet;
  private config?: CardConfig;
  private _hass?: any;
  private entity?: string;
  private name?: string;
  private domain?: string;
  private isTall?: boolean;
  private defaultIcon?: string;
  private cameraView?: string;
  private refreshInterval?: number;
  private snapshotManager?: SnapshotManager;
  private cameraSnapshotFailed?: boolean = false;
  private cameraImages: HTMLImageElement[] = [];
  private visibleImageIndex: number = 0;
  private queryTimer?: number;
  private lastDisplayedTimestamp?: number;
  private boundCardClick?: (e: Event) => void;
  private boundIconClick?: (e: Event) => void;
  private _hasRendered: boolean = false;
  private observer?: IntersectionObserver;
  private isVisible: boolean = true;

  constructor() { super(); }

  connectedCallback() {
    if (this.shadowRoot && this._hass && this.entity) {
      setTimeout(() => {
        const card = this.shadowRoot?.querySelector('.apple-home-card') as HTMLElement;
        const isEdit = this.closest('.entity-card-wrapper')?.classList.contains('edit-mode') || false;
        if (card && !isEdit && !this.boundCardClick) this.setupClickHandlers();
      }, 50);
    }
    if (this.domain === 'camera' && this.cameraView === 'snapshot') this.setupObserver();
  }

  disconnectedCallback() { this.cleanup(); }

  public cleanup() {
    if (this.queryTimer) { clearInterval(this.queryTimer); this.queryTimer = undefined; }
    if (this.shadowRoot) {
      const card = this.shadowRoot.querySelector('.apple-home-card'), icon = this.shadowRoot.querySelector('.info-icon');
      if (card && this.boundCardClick) card.removeEventListener('click', this.boundCardClick);
      if (icon && this.boundIconClick) icon.removeEventListener('click', this.boundIconClick);
    }
    this.boundCardClick = undefined; this.boundIconClick = undefined;
    this.cameraImages.forEach(img => img.remove()); this.cameraImages = [];
    if (this.snapshotManager && this.entity) this.snapshotManager.unregisterCamera(this.entity);
    if (this.observer) this.observer.disconnect();
  }

  setConfig(config: CardConfig) {
    if (!config.entity) throw new Error('Entity is required');
    const entityChanged = this.entity !== config.entity;
    this.config = config; this.entity = config.entity; this.name = config.name;
    this.domain = config.domain || config.entity.split('.')[0];
    this.isTall = config.is_tall || false; this.defaultIcon = (config as any).default_icon;
    this.cameraView = (config as any).camera_view; this.refreshInterval = (config as any).refresh_interval || 10000;
    if (entityChanged) this._hasRendered = false;
    this.classList.toggle('tall-card', this.isTall);
  }

  set hass(hass: any) {
    const oldHass = this._hass; this._hass = hass;
    if (this.snapshotManager) this.snapshotManager.setHass(hass);
    if (!oldHass || !this._hasRendered) this.render();
    else if (this.entity && hass.states[this.entity] !== oldHass.states[this.entity]) this.updateCardInPlace();
  }

  private render() {
    if (!this._hass || !this.entity) return;
    const s = this._hass.states[this.entity]; if (!s) return;
    const name = this.name || s.attributes.friendly_name || this.entity.split('.')[1].replace(/_/g, ' ');
    const data = DashboardConfig.getEntityData(s, this.domain!, this.isTall || false, false, this._hass);
    
    if (!this.shadowRoot) { this.attachShadow({ mode: 'open' }); this.shadowRoot!.adoptedStyleSheets = [AppleHomeCard.styles]; }
    
    const isEdit = this.closest('.entity-card-wrapper')?.classList.contains('edit-mode') || false;
    let iconContent = '';
    
    if (this.domain === 'camera' && this.cameraView === 'snapshot') {
      const camS = s.state;
      if (!camS || ['unavailable', 'unknown', 'off'].includes(camS)) {
        iconContent = `<div class="camera-icon-unavailable"><ha-icon icon="mdi:camera-off"></ha-icon></div>`;
      } else {
        iconContent = `<div class="camera-container"><div class="camera-overlay"><span class="camera-timestamp"></span></div></div>`;
      }
    } else if (['climate', 'water_heater'].includes(this.domain!)) {
      const temp = typeof s.attributes.current_temperature === 'number' ? `${s.attributes.current_temperature.toFixed(1)}°` : '--.-°';
      iconContent = `<div class="info-icon temperature-display"><span class="temperature-text">${temp}</span></div>`;
    } else {
      iconContent = `<div class="info-icon"><ha-icon icon="${this.defaultIcon || data.icon}"></ha-icon></div>`;
    }

    this.shadowRoot!.innerHTML = `
      <div class="apple-home-card ${isEdit ? 'edit-mode' : ''} ${this.domain === 'camera' ? 'camera-card' : ''} ${RTLHelper.isRTL() ? 'rtl' : 'ltr'}">
        <div class="card-info">
          ${iconContent}
          <div class="text-content">
            <div class="entity-name">${name}</div>
            ${this.domain === 'camera' ? `<div class="entity-state">${localize(`status_messages.${s.state}`) || s.state}</div>` : `<div class="entity-state">${data.stateText}</div>`}
          </div>
        </div>
      </div>
    `;

    this.updateCSS(data); this._hasRendered = true; if (!isEdit) this.setupClickHandlers();
    
    if (this.domain === 'camera' && this.cameraView === 'snapshot' && !['unavailable', 'unknown', 'off'].includes(s.state)) {
      setTimeout(() => this.initializeCamera(), 100);
    }
  }

  private updateCSS(data: any) {
    this.style.setProperty('--card-bg-color', data.backgroundColor);
    this.style.setProperty('--card-icon-color', data.iconColor);
    this.style.setProperty('--card-icon-bg', data.iconBackgroundColor);
    this.style.setProperty('--card-text-color', data.textColor);
    this.style.setProperty('--card-state-color', data.isActive ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)');
    this.style.setProperty('--card-backdrop-filter', data.isActive ? 'none' : 'blur(20px) saturate(1.8)');
  }

  private updateCardInPlace() {
    if (!this._hass || !this.entity || !this.shadowRoot) return;
    const s = this._hass.states[this.entity]; if (!s) return;
    const data = DashboardConfig.getEntityData(s, this.domain!, this.isTall || false, false, this._hass);
    this.updateCSS(data);
    const stateEl = this.shadowRoot.querySelector('.entity-state');
    if (stateEl) stateEl.textContent = this.domain === 'camera' ? (localize(`status_messages.${s.state}`) || s.state) : data.stateText;
    const iconEl = this.shadowRoot.querySelector('.info-icon ha-icon');
    if (iconEl && this.domain !== 'camera') iconEl.setAttribute('icon', this.defaultIcon || data.icon);
    if (['climate', 'water_heater'].includes(this.domain!)) {
      const tempEl = this.shadowRoot.querySelector('.temperature-text');
      if (tempEl) tempEl.textContent = typeof s.attributes.current_temperature === 'number' ? `${s.attributes.current_temperature.toFixed(1)}°` : '--.-°';
    }
  }

  private setupClickHandlers() {
    const card = this.shadowRoot?.querySelector('.apple-home-card'), icon = this.shadowRoot?.querySelector('.info-icon');
    this.boundCardClick = (e) => { e.stopPropagation(); this.handleCardClick(); };
    this.boundIconClick = (e) => { e.stopPropagation(); this.handleIconClick(); };
    card?.addEventListener('click', this.boundCardClick);
    icon?.addEventListener('click', this.boundIconClick);
  }

  private handleCardClick() {
    if (['light', 'cover', 'climate', 'media_player'].includes(this.domain!)) {
      const p = document.createElement('apple-home-popup') as any; document.body.appendChild(p); p.setup(this._hass, this.entity);
    } else this.dispatchEvent(new CustomEvent('hass-more-info', { bubbles: true, composed: true, detail: { entityId: this.entity } }));
  }

  private handleIconClick() {
    const d = this.domain!, e = this.entity!;
    if (['light', 'switch', 'fan', 'input_boolean'].includes(d)) this._hass.callService(d === 'input_boolean' ? 'input_boolean' : d, 'toggle', { entity_id: e });
    else if (d === 'scene' || d === 'script') this._hass.callService(d, 'turn_on', { entity_id: e });
    else if (d === 'lock') this._hass.callService('lock', this._hass.states[e].state === 'locked' ? 'unlock' : 'lock', { entity_id: e });
    else this.handleCardClick();
  }

  private setupObserver() {
    if (this.observer) return;
    this.observer = new IntersectionObserver((entries) => {
      this.isVisible = entries[0].isIntersecting;
      if (this.isVisible) this.resumeCamera(); else this.pauseCamera();
    }, { threshold: 0.1 });
    this.observer.observe(this);
  }

  private initializeCamera() {
    const container = this.shadowRoot?.querySelector('.camera-container') as HTMLElement;
    if (!container || this.cameraImages.length > 0) return;
    if (!this.snapshotManager) { this.snapshotManager = SnapshotManager.getInstance(); this.snapshotManager.setHass(this._hass); this.snapshotManager.registerCamera(this.entity!); }
    for (let i = 0; i < 2; i++) {
      const img = document.createElement('img'); img.className = 'camera-snapshot'; img.style.opacity = '0';
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:opacity 0.6s cubic-bezier(0.16,1,0.3,1);';
      container.appendChild(img); this.cameraImages.push(img);
    }
    this.startCameraTimer();
  }

  private startCameraTimer() { if (this.queryTimer) return; this.queryTimer = window.setInterval(() => this.updateSnapshot(), 10000); this.updateSnapshot(); }
  public pauseCamera() { if (this.queryTimer) { clearInterval(this.queryTimer); this.queryTimer = undefined; } }
  public resumeCamera() { if (this.domain === 'camera' && this.isVisible && !this.queryTimer) this.startCameraTimer(); }

  private updateSnapshot() {
    if (!this.snapshotManager || !this.entity || !this.isVisible) return;
    const data = this.snapshotManager.getSnapshot(this.entity);
    if (data?.base64Data && data.timestamp !== this.lastDisplayedTimestamp) {
      const next = this.visibleImageIndex === 0 ? 1 : 0, nextImg = this.cameraImages[next], curImg = this.cameraImages[this.visibleImageIndex];
      nextImg.onload = () => { nextImg.style.opacity = '1'; curImg.style.opacity = '0'; this.visibleImageIndex = next; this.lastDisplayedTimestamp = data.timestamp; this.updateCameraTimestamp(); };
      nextImg.src = data.base64Data;
    }
  }

  private updateCameraTimestamp() {
    const el = this.shadowRoot?.querySelector('.camera-timestamp') as HTMLElement;
    if (el && this.snapshotManager && this.entity) {
      const sec = this.snapshotManager.getSecondsAgo(this.entity);
      el.textContent = sec < 60 ? 'LIVE' : `${Math.floor(sec/60)}m ago`;
    }
  }

  public refreshEditMode() {
    const isEdit = this.closest('.entity-card-wrapper')?.classList.contains('edit-mode') || false;
    this.shadowRoot?.querySelector('.apple-home-card')?.classList.toggle('edit-mode', isEdit);
  }

  static get styles(): CSSStyleSheet {
    if (!AppleHomeCard._styles) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(`
        :host { display: block; width: 100%; height: 100%; }
        .apple-home-card { background: var(--card-bg-color); border-radius: var(--apple-card-radius, 22px); padding: 12px; display: flex; flex-direction: column; height: 100%; box-sizing: border-box; cursor: pointer; transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); position: relative; overflow: hidden; user-select: none; backdrop-filter: var(--card-backdrop-filter); -webkit-backdrop-filter: var(--card-backdrop-filter); box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        .apple-home-card:active { transform: scale(0.95); opacity: 0.9; }
        .apple-home-card.edit-mode:active { transform: none; opacity: 1; }
        .card-info { display: flex; flex-direction: row; align-items: center; gap: 12px; height: 100%; z-index: 1; }
        :host(.tall-card) .card-info { flex-direction: column; align-items: flex-start; justify-content: space-between; }
        .info-icon { width: 36px; height: 36px; border-radius: 50%; background: var(--card-icon-bg); color: var(--card-icon-color); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .info-icon ha-icon { --mdc-icon-size: 20px; }
        .text-content { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .entity-name { font-size: 15px; font-weight: 600; color: var(--card-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.3px; }
        .entity-state { font-size: 13px; font-weight: 500; color: var(--card-state-color); letter-spacing: -0.2px; }
        .camera-container { position: absolute; inset: 0; z-index: 0; background: #000; }
        .camera-overlay { position: absolute; bottom: 10px; left: 10px; z-index: 2; background: rgba(0,0,0,0.5); padding: 2px 8px; border-radius: 6px; backdrop-filter: blur(10px); border: 0.5px solid rgba(255,255,255,0.1); }
        .camera-timestamp { color: #fff; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; }
        .camera-card .entity-name, .camera-card .entity-state { text-shadow: 0 1px 10px rgba(0,0,0,0.8); color: #fff !important; }
        .camera-icon-unavailable { position: absolute; top: 12px; left: 12px; z-index: 2; color: rgba(255,255,255,0.6); }
        .temperature-display { background: transparent !important; box-shadow: none !important; }
        .temperature-text { font-size: 15px; font-weight: 700; color: var(--card-icon-color); }
        :host(.tall-card) .temperature-text { font-size: 34px; letter-spacing: -1px; }
        .apple-home-card.edit-mode { pointer-events: none; }
      `);
      AppleHomeCard._styles = sheet;
    }
    return AppleHomeCard._styles;
  }
}
customElements.define('apple-home-card', AppleHomeCard);
