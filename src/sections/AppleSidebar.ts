import { DeviceGroup } from '../config/DashboardConfig';
import { localize } from '../utils/LocalizationService';

export class AppleSidebar extends HTMLElement {
  private _hass: any;
  private container: HTMLElement;
  private activePage: string = 'home';
  private onClose?: () => void;

  constructor(container: HTMLElement) {
    super();
    this.container = container;
  }

  set hass(hass: any) {
    this._hass = hass;
    this.render();
  }

  setOnClose(callback: () => void) {
    this.onClose = callback;
  }

  private extractRooms(): { id: string, name: string }[] {
    if (!this._hass) return [];
    
    // We want to list all areas (rooms) from HA
    const areas = this._hass.areas || {};
    const rooms = Object.keys(areas).map(areaId => ({
      id: areaId,
      name: areas[areaId].name
    })).sort((a, b) => a.name.localeCompare(b.name));
    
    // Always insert "Standardraum" (Default Room) at the beginning where entities without area live
    rooms.unshift({ id: 'no_area', name: localize('common.default_room') || 'Standardraum' });
    
    return rooms;
  }

  private render() {
    if (!this.container) return;

    const rooms = this.extractRooms();
    
    this.container.innerHTML = `
      <style>
        .apple-sidebar-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 320px;
          height: 100vh;
          background: rgba(40, 40, 40, 0.45);
          backdrop-filter: blur(40px) saturate(1.8);
          -webkit-backdrop-filter: blur(40px) saturate(1.8);
          border-right: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          padding: 24px;
          box-sizing: border-box;
          z-index: 9999;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
          color: white;
          overflow-y: auto;
          transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        
        .sidebar-header {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 24px;
        }
        
        .sidebar-toggle-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .sidebar-toggle-btn:active {
          background: rgba(255,255,255,0.2);
        }

        .nav-section {
          margin-bottom: 30px;
        }
        
        .nav-section-title {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255,255,255,0.6);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
          padding-left: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .nav-item {
          display: flex;
          align-items: center;
          padding: 10px 12px;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.2s;
          margin-bottom: 4px;
        }
        
        .nav-item:hover {
          background: rgba(255,255,255,0.05);
        }
        
        .nav-item.active {
          background: rgba(255,255,255,0.15);
        }

        .nav-icon {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 12px;
          color: rgba(255,255,255,0.9);
        }

        .nav-text {
          font-size: 16px;
          font-weight: 500;
        }
      </style>
      
      <div class="apple-sidebar-container">
        <div class="sidebar-header">
          <div class="sidebar-toggle-btn" id="close-sidebar-btn">
            <ha-icon icon="mdi:dock-left"></ha-icon>
          </div>
        </div>
        
        <div class="nav-section">
          <div class="nav-item ${this.activePage === 'home' ? 'active' : ''}">
            <div class="nav-icon"><ha-icon icon="mdi:home-variant-outline"></ha-icon></div>
            <div class="nav-text">${localize('pages.my_home') || 'Zuhause'}</div>
          </div>
          <div class="nav-item ${this.activePage === 'automation' ? 'active' : ''}">
            <div class="nav-icon"><ha-icon icon="mdi:clock-star-four-points"></ha-icon></div>
            <div class="nav-text">${localize('ui_actions.automation') || 'Automation'}</div>
          </div>
          <div class="nav-item">
            <div class="nav-icon"><ha-icon icon="mdi:star-outline"></ha-icon></div>
            <div class="nav-text">Entdecken</div>
          </div>
        </div>
        
        <div class="nav-section">
          <div class="nav-section-title">
            <span>Kategorien</span>
            <ha-icon icon="mdi:chevron-down"></ha-icon>
          </div>
          <div class="nav-item">
            <div class="nav-icon"><ha-icon icon="mdi:fan"></ha-icon></div>
            <div class="nav-text">Klima</div>
          </div>
          <div class="nav-item">
            <div class="nav-icon"><ha-icon icon="mdi:lightbulb-outline"></ha-icon></div>
            <div class="nav-text">Lichtquellen</div>
          </div>
          <div class="nav-item">
            <div class="nav-icon"><ha-icon icon="mdi:lock"></ha-icon></div>
            <div class="nav-text">Sicherheit</div>
          </div>
        </div>
        
        <div class="nav-section">
          <div class="nav-section-title">
            <span>Räume</span>
            <ha-icon icon="mdi:chevron-down"></ha-icon>
          </div>
          ${rooms.map(room => `
            <div class="nav-item">
              <div class="nav-icon"><ha-icon icon="mdi:sofa-outline"></ha-icon></div>
              <div class="nav-text">${room.name}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.attachListeners();
  }

  private attachListeners() {
    const closeBtn = this.container.querySelector('#close-sidebar-btn');
    if (closeBtn && this.onClose) {
      closeBtn.addEventListener('click', () => {
        this.onClose!();
      });
    }
  }
}
