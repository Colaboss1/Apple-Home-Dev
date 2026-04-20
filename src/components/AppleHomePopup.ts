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

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  public setup(hass: any, entityId: string) {
    this._hass = hass;
    this.entityId = entityId;
    this.domain = entityId.split('.')[0];
    
    this.initializeState();
    this.render();
    this.setupListeners();
  }

  connectedCallback() {
    // Block scroll on document while open
    document.body.style.overflow = 'hidden';
  }

  disconnectedCallback() {
    document.body.style.overflow = '';
  }

  private initializeState() {
    const state = this._hass.states[this.entityId];
    if (!state) return;

    if (this.domain === 'light') {
      const brightness = state.attributes.brightness || 0;
      this.sliderValue = state.state === 'off' ? 0 : Math.round((brightness / 255) * 100);
      this.maxValue = 100;
    } else if (this.domain === 'cover') {
      this.sliderValue = state.attributes.current_position || 0;
      this.maxValue = 100;
    } else if (this.domain === 'climate' || this.domain === 'water_heater') {
      this.minValue = state.attributes.min_temp || 15;
      this.maxValue = state.attributes.max_temp || 30;
      const current = state.attributes.temperature || this.minValue;
      this.sliderValue = Math.max(this.minValue, Math.min(this.maxValue, current));
    } else if (this.domain === 'media_player') {
      const vol = state.attributes.volume_level || 0;
      this.sliderValue = Math.round(vol * 100);
      this.maxValue = 100;
    }
  }

  private render() {
    const state = this._hass.states[this.entityId];
    if (!state) return;

    const friendlyName = state.attributes.friendly_name || this.entityId;
    let icon = 'mdi:lightbulb';
    let trackClass = 'light-track';
    
    if (this.domain === 'cover') {
      icon = 'mdi:window-shutter';
      trackClass = 'cover-track';
    } else if (this.domain === 'climate' || this.domain === 'water_heater') {
      icon = 'mdi:thermometer';
      trackClass = 'climate-track';
    } else if (this.domain === 'media_player') {
      icon = 'mdi:speaker';
      trackClass = 'media-track';
    }

    // Calculate percentage for slider visuals
    let percentage = 0;
    if (this.domain === 'climate' || this.domain === 'water_heater') {
      percentage = ((this.sliderValue - this.minValue) / (this.maxValue - this.minValue)) * 100;
    } else {
      percentage = this.sliderValue;
    }
    
    // Ensure bounds
    percentage = Math.max(0, Math.min(100, percentage));

    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          z-index: 100000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(40px) saturate(1.5);
          -webkit-backdrop-filter: blur(40px) saturate(1.5);
          animation: fadeIn 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes scaleUp {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .popup-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: scaleUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
          width: 100%;
          max-width: 400px;
          padding: 20px;
          box-sizing: border-box;
        }

        .slider-container {
          position: relative;
          width: 120px;
          height: 380px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 40px;
          overflow: hidden;
          box-shadow: 0 4px 30px rgba(0,0,0,0.1);
          touch-action: none;
        }

        .slider-track {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: ${percentage}%;
          background: #fff;
          transition: ${this.isDragging ? 'none' : 'height 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'};
          will-change: height;
        }

        .light-track { background: #ffcc00; }
        .cover-track { background: #fff; }
        .climate-track { background: #ff9f0a; }
        .media-track { background: rgba(255, 255, 255, 0.9); }

        .slider-icon {
          position: absolute;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          color: ${percentage > 10 ? '#000' : '#fff'};
          transition: color 0.3s ease;
          pointer-events: none;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .slider-icon ha-icon {
          --mdc-icon-size: 36px;
        }

        .header {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 35px;
          color: #fff;
          text-align: center;
        }

        .entity-name {
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.5px;
          margin-bottom: 5px;
          text-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }

        .entity-state {
          font-size: 16px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.7);
        }

        .controls {
          display: flex;
          gap: 20px;
          margin-top: 40px;
        }

        .control-btn {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          cursor: pointer;
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.2s ease;
        }

        .control-btn:active {
          transform: scale(0.9);
          background: rgba(255, 255, 255, 0.3);
        }
        
        }
      </style>

      <div class="popup-container">
        <div class="header">
          <div class="entity-name">${friendlyName}</div>
          <div class="entity-state" id="state-text">${this.formatStateText()}</div>
        </div>

        <div class="slider-container" id="slider">
          <div class="slider-track ${trackClass}" id="track"></div>
          <div class="slider-icon">
            <ha-icon icon="${icon}"></ha-icon>
          </div>
        </div>

        <div class="controls">
          <div class="control-btn" id="toggle-btn">
            <ha-icon icon="mdi:power"></ha-icon>
          </div>
          <div class="control-btn" id="settings-btn">
            <ha-icon icon="mdi:cog"></ha-icon>
          </div>
        </div>
      </div>
    `;
  }

  private formatStateText(): string {
    if (this.domain === 'climate' || this.domain === 'water_heater') {
      return `${this.sliderValue}°`;
    }
    return `${this.sliderValue}%`;
  }

  private setupListeners() {
    const slider = this.shadowRoot!.getElementById('slider');
    const track = this.shadowRoot!.getElementById('track');
    const stateText = this.shadowRoot!.getElementById('state-text');
    const closeBtn = this.shadowRoot!.getElementById('close-btn');
    const toggleBtn = this.shadowRoot!.getElementById('toggle-btn');
    const settingsBtn = this.shadowRoot!.getElementById('settings-btn');
    const icon = this.shadowRoot!.querySelector('.slider-icon') as HTMLElement;

    if (!slider || !track) return;

    // Interaction handling
    const updateSlider = (clientY: number) => {
      const rect = slider.getBoundingClientRect();
      // Calculate percentage from bottom
      let percent = ((rect.bottom - clientY) / rect.height) * 100;
      percent = Math.max(0, Math.min(100, percent));
      
        track.style.height = `${percent}%`;
      icon.style.color = percent > 10 ? '#000' : '#fff';

      // Update value text locally
      if (this.domain === 'climate' || this.domain === 'water_heater') {
        const temp = this.minValue + ((percent / 100) * (this.maxValue - this.minValue));
        this.sliderValue = Math.round(temp * 10) / 10; // 1 decimal place
        if (stateText) stateText.textContent = `${this.sliderValue}°`;
      } else {
        this.sliderValue = Math.round(percent);
        if (stateText) stateText.textContent = `${this.sliderValue}%`;
      }
    };

    const commitChange = () => {
      this.isDragging = false;
      track.style.transition = 'height 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
      
      // Throttle API calls
      if (this.updateTimeout) clearTimeout(this.updateTimeout);
      this.updateTimeout = setTimeout(() => {
        if (this.domain === 'light') {
          if (this.sliderValue === 0) {
            this._hass.callService('light', 'turn_off', { entity_id: this.entityId });
          } else {
            this._hass.callService('light', 'turn_on', { 
              entity_id: this.entityId, 
              brightness_pct: this.sliderValue 
            });
          }
        } else if (this.domain === 'cover') {
          this._hass.callService('cover', 'set_cover_position', { 
            entity_id: this.entityId, 
            position: this.sliderValue 
          });
        } else if (this.domain === 'climate') {
          this._hass.callService('climate', 'set_temperature', { 
            entity_id: this.entityId, 
            temperature: this.sliderValue 
          });
        } else if (this.domain === 'water_heater') {
          this._hass.callService('water_heater', 'set_temperature', { 
            entity_id: this.entityId, 
            temperature: this.sliderValue 
          });
        } else if (this.domain === 'media_player') {
          this._hass.callService('media_player', 'volume_set', { 
            entity_id: this.entityId, 
            volume_level: this.sliderValue / 100 
          });
        }
      }, 50);
    };

    // Touch Events
    slider.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.isDragging = true;
      track.style.transition = 'none';
      updateSlider(e.touches[0].clientY);
    });

    slider.addEventListener('touchmove', (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      updateSlider(e.touches[0].clientY);
    });

    slider.addEventListener('touchend', () => {
      if (this.isDragging) commitChange();
    });

    // Mouse Events
    slider.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.isDragging = true;
      track.style.transition = 'none';
      updateSlider(e.clientY);
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      e.preventDefault();
      updateSlider(e.clientY);
    });

    document.addEventListener('mouseup', () => {
      if (this.isDragging) commitChange();
    });

    // Close on background click
    this.shadowRoot!.addEventListener('click', (e) => {
      if (e.target === this.shadowRoot!.host || (e.target as HTMLElement).tagName === 'DIV' && !(e.target as HTMLElement).closest('.popup-container')) {
        this.remove();
      }
    });

    toggleBtn?.addEventListener('click', () => {
      this._hass.callService(this.domain, 'toggle', { entity_id: this.entityId });
      // Minor delay to let HA update state, then close popup
      setTimeout(() => this.remove(), 200);
    });

    settingsBtn?.addEventListener('click', () => {
      this.remove();
      // Dispatch standard more-info
      this.dispatchEvent(new CustomEvent('hass-more-info', {
        bubbles: true,
        composed: true,
        detail: { entityId: this.entityId }
      }));
    });
  }
}

if (!customElements.get('apple-home-popup')) {
  customElements.define('apple-home-popup', AppleHomePopup);
}
