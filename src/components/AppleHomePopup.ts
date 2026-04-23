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

    // Check for color support
    const supportsColor = state.attributes.supported_color_modes?.some((mode: string) => ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'].includes(mode));
    const supportsTemp = state.attributes.supported_color_modes?.includes('color_temp');

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
          /* Performance: Snappier 0.2s animation with aggressive iOS-style easing */
          animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
        }

        .backdrop {
          position: absolute;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(40px) saturate(1.5);
          -webkit-backdrop-filter: blur(40px) saturate(1.5);
          transform: translateZ(0);
          will-change: transform, backdrop-filter;
          z-index: 100001;
          pointer-events: auto;
          cursor: pointer;
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
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          /* Performance: Snappier 0.2s scale-up to match iOS home response */
          animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          width: 100%;
          max-width: 450px;
          padding: 30px;
          box-sizing: border-box;
          z-index: 100002;
          pointer-events: auto; /* Ensure content catches clicks */
          cursor: default; /* Overrides backdrop cursor */
        }

        .slider-container {
          position: relative;
          width: 130px;
          height: 380px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 45px;
          overflow: hidden;
          box-shadow: 0 4px 30px rgba(0,0,0,0.1);
          touch-action: none;
          margin-bottom: 30px;
          transform: translateZ(0); /* For rounding clipping */
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
          --mdc-icon-size: 38px;
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
          font-size: 34px;
          font-weight: 700;
          letter-spacing: -0.8px;
          margin-bottom: 5px;
          text-shadow: 0 2px 10px rgba(0,0,0,0.2);
          text-align: center;
        }

        .entity-state {
          font-size: 18px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.75);
          letter-spacing: -0.2px;
        }

        /* Color Section */
        .color-section {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 30px;
          display: none; /* Hidden by default, shown if supported */
        }

        :host(.supports-color) .color-section {
          display: flex;
        }

        .color-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
          width: 100%;
          max-width: 320px;
        }

        .color-circle {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.2s;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }

        .color-circle:active {
          transform: scale(0.85);
        }

        .color-circle.selected {
          border-color: #fff;
          transform: scale(1.1);
        }

        .controls {
          display: flex;
          gap: 25px;
          margin-top: 10px;
        }

        .control-btn {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          cursor: pointer;
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .control-btn:hover {
          background: rgba(255, 255, 255, 0.25);
        }

        .control-btn:active {
          transform: scale(0.9);
          background: rgba(255, 255, 255, 0.35);
        }

        .control-btn ha-icon {
          --mdc-icon-size: 28px;
        }
      </style>

      <div class="backdrop" id="backdrop"></div>
      
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

        ${supportsColor || supportsTemp ? `
          <div class="color-section">
            <div class="color-grid">
            ${this.renderColorCircles()}
          </div>
          </div>
        ` : ''}

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

  private renderColorCircles(): string {
    if (this.domain === 'light') {
      const state = this._hass.states[this.entityId];
      const supportsColor = state?.attributes.supported_color_modes?.some((mode: string) => ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'].includes(mode));
      const supportsTemp = state?.attributes.supported_color_modes?.includes('color_temp');
      
      if (supportsColor || supportsTemp) {
        this.classList.add('supports-color');
      } else {
        this.classList.remove('supports-color');
      }
    }

    if (this.domain !== 'light' || !this.classList.contains('supports-color')) return '';
    
    const state = this._hass.states[this.entityId];
    const supportsColor = state?.attributes.supported_color_modes?.some((mode: string) => ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'].includes(mode));
    const supportsTemp = state?.attributes.supported_color_modes?.includes('color_temp');
    
    const circles: string[] = [];
    
    if (supportsColor) {
      const colors = [
        { rgb: '255,255,255' }, { rgb: '255,159,10' }, { rgb: '0,122,255' }, 
        { rgb: '255,45,85' }, { rgb: '175,82,222' }, { rgb: '90,200,250' }
      ];
      
      colors.forEach(c => {
        circles.push(`<div class="color-circle" style="background: rgb(${c.rgb})" data-rgb="${c.rgb}"></div>`);
      });
    }
    
    if (supportsTemp) {
      const temperatures = [
        { temp: 153, color: '#fcf8ff' }, { temp: 250, color: '#fffd9f' }, { temp: 370, color: '#ffcc00' }, { temp: 500, color: '#ff9500' }
      ];
      
      temperatures.forEach(t => {
        circles.push(`<div class="color-circle" style="background: ${t.color}" data-temp="${t.temp}"></div>`);
      });
    }
    
    return circles.join('');
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
    const toggleBtn = this.shadowRoot!.getElementById('toggle-btn');
    const settingsBtn = this.shadowRoot!.getElementById('settings-btn');
    const backdrop = this.shadowRoot!.getElementById('backdrop');
    const icon = this.shadowRoot!.querySelector('.slider-icon') as HTMLElement;
    const colorCircles = this.shadowRoot!.querySelectorAll('.color-circle');

    if (!slider || !track) return;

    // Interaction handling
    const updateSlider = (clientY: number) => {
      const rect = slider.getBoundingClientRect();
      let percent = ((rect.bottom - clientY) / rect.height) * 100;
      percent = Math.max(0, Math.min(100, percent));
      
      track.style.height = `${percent}%`;
      if (icon) icon.style.color = percent > 10 ? '#000' : '#fff';

      // Update value text locally
      if (this.domain === 'climate' || this.domain === 'water_heater') {
        const temp = this.minValue + ((percent / 100) * (this.maxValue - this.minValue));
        this.sliderValue = Math.round(temp * 10) / 10;
        if (stateText) stateText.textContent = `${this.sliderValue}°`;
      } else {
        this.sliderValue = Math.round(percent);
        if (stateText) stateText.textContent = `${this.sliderValue}%`;
      }
    };

    const commitChange = () => {
      this.isDragging = false;
      track.style.transition = 'height 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
      
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

    // Backdrop click close (High sensitivity)
    backdrop?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.remove();
    }, { capture: true }); // Capture ensures we catch it before children
    
    // Also allow closing by clicking the host itself (for clicks that miss the backdrop)
    this.addEventListener('click', (e) => {
      // Only close if we clicked exactly the host (dead space)
      if (e.target === this) {
        e.stopPropagation();
        this.remove();
      }
    });

    // Prevent closing when clicking INSIDE the container
    const container = this.shadowRoot!.querySelector('.popup-container');
    container?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Color circles
    const handleColorSelect = (e: Event) => {
      const target = e.currentTarget as HTMLElement;
      const rgb = target.getAttribute('data-rgb');
      const temp = target.getAttribute('data-temp');
      
      colorCircles.forEach(c => c.classList.remove('selected'));
      target.classList.add('selected');
      
      if (rgb) {
        const [r, g, b] = rgb.split(',').map(Number);
        this._hass.callService('light', 'turn_on', {
          entity_id: this.entityId,
          rgb_color: [r, g, b]
        });
      } else if (temp) {
        this._hass.callService('light', 'turn_on', {
          entity_id: this.entityId,
          color_temp: Number(temp)
        });
      }
    };

    colorCircles.forEach(circle => {
      circle.addEventListener('click', handleColorSelect);
      circle.addEventListener('touchend', (e) => {
        e.preventDefault(); // Prevent ghost click
        handleColorSelect(e);
      });
    });

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

    const moveHandler = (e: MouseEvent) => {
      if (!this.isDragging) return;
      e.preventDefault();
      updateSlider(e.clientY);
    };

    const upHandler = () => {
      if (this.isDragging) commitChange();
    };

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', upHandler);

    // Clean up global listeners on remove
    const originalRemove = this.remove;
    this.remove = () => {
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', upHandler);
      originalRemove.call(this);
    };

    toggleBtn?.addEventListener('click', () => {
      this._hass.callService(this.domain, 'toggle', { entity_id: this.entityId });
      setTimeout(() => this.remove(), 200);
    });

    settingsBtn?.addEventListener('click', () => {
      this.remove();
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
