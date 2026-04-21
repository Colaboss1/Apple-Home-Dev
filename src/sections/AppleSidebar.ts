import { localize } from '../utils/LocalizationService';

/**
 * iPad Mode Sidebar – Apple Home Style
 * 
 * Renders a fixed sidebar with navigation for Home, Categories, and Rooms.
 * Uses smart-rendering to avoid scroll-position resets on HA state updates.
 */
export class AppleSidebar {
  private _hass: any;
  private container: HTMLElement;
  private activePage: string = 'home';
  private onNavigate?: (path: string) => void;
  private onClose?: () => void;
  
  // Smart render cache
  private lastRoomsJson: string = '';
  private lastActivePage: string = '';
  private stylesInjected: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  set hass(hass: any) {
    this._hass = hass;
    this.updateActivePage();
    this.smartRender();
  }

  setOnClose(callback: () => void) {
    this.onClose = callback;
  }

  setOnNavigate(callback: (path: string) => void) {
    this.onNavigate = callback;
  }

  /** Detect current page from URL */
  private updateActivePage() {
    const path = window.location.pathname;
    if (path.includes('room-')) {
      this.activePage = path.split('room-')[1]?.split('/')[0] || 'home';
    } else if (path.includes('automation') || path.includes('scenes')) {
      this.activePage = 'automation';
    } else if (path.includes('cameras')) {
      this.activePage = 'cameras';
    } else {
      // Check for group pages (lights, climate, security, etc.)
      const segments = path.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      if (['lighting', 'climate', 'security', 'media', 'vacuum', 'energy', 'water', 'other'].includes(lastSegment)) {
        this.activePage = lastSegment;
      } else {
        this.activePage = 'home';
      }
    }
  }

  /** Extract rooms from HA area registry */
  private extractRooms(): { id: string; name: string; icon: string }[] {
    if (!this._hass) return [];
    const areas = this._hass.areas || {};
    
    const rooms = Object.keys(areas).map(areaId => {
      const area = areas[areaId];
      return {
        id: areaId,
        name: area?.name || areaId,
        icon: area?.icon || 'mdi:sofa-outline'
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    const defaultRoomName = localize('pages.default_room') || 'Standardraum';
    rooms.unshift({ id: 'no_area', name: defaultRoomName, icon: 'mdi:home-outline' });
    return rooms;
  }

  /** Only re-render when data actually changes */
  private smartRender() {
    if (!this.container) return;

    const rooms = this.extractRooms();
    const roomsJson = JSON.stringify(rooms);

    // Skip render if nothing changed
    if (roomsJson === this.lastRoomsJson && this.activePage === this.lastActivePage) {
      return;
    }

    this.lastRoomsJson = roomsJson;
    this.lastActivePage = this.activePage;
    this.renderFull(rooms);
  }

  /** Inject styles once, not on every render */
  private ensureStyles() {
    if (this.stylesInjected) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'apple-sidebar-styles';
    styleEl.textContent = `
      .apple-sidebar-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 320px;
        height: 100vh;
        height: 100dvh;
        background: rgba(28, 28, 30, 0.92);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-right: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
        color: white;
        overflow: hidden;
        contain: content;
        transform: translateZ(0);
      }

      .sidebar-scroll-area {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        padding: 0 20px 24px 20px;
        scrollbar-width: none;
      }
      
      .sidebar-scroll-area::-webkit-scrollbar {
        display: none;
      }

      .sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 20px 12px 20px;
        flex-shrink: 0;
      }
      
      .sidebar-title {
        font-size: 22px;
        font-weight: 700;
        letter-spacing: -0.3px;
      }

      .sidebar-toggle-btn {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: rgba(255,255,255,0.1);
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.2s, transform 0.15s;
        color: rgba(255,255,255,0.7);
        padding: 0;
        flex-shrink: 0;
      }
      
      .sidebar-toggle-btn ha-icon {
        --mdc-icon-size: 18px;
      }
      
      .sidebar-toggle-btn:hover {
        background: rgba(255,255,255,0.15);
      }
      
      .sidebar-toggle-btn:active {
        transform: scale(0.88);
        background: rgba(255,255,255,0.2);
      }

      .nav-section {
        margin-bottom: 24px;
      }
      
      .nav-section-title {
        font-size: 11px;
        font-weight: 700;
        color: rgba(255,255,255,0.4);
        text-transform: uppercase;
        letter-spacing: 1.2px;
        margin-bottom: 8px;
        padding-left: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif;
      }

      .nav-item {
        display: flex;
        align-items: center;
        padding: 9px 12px;
        border-radius: 12px;
        cursor: pointer;
        transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), 
                    transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        margin-bottom: 4px;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
      }
      
      .nav-item:hover {
        background: rgba(255,255,255,0.06);
      }
      
      .nav-item:active {
        transform: scale(0.97);
        background: rgba(255,255,255,0.1);
      }

      .nav-item.active {
        background: rgba(255,255,255,0.12);
      }
      
      .nav-item.active .nav-icon {
        color: #0a84ff;
      }

      .nav-icon {
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 14px;
        color: white;
        flex-shrink: 0;
        border-radius: 8px;
        background: rgba(255,255,255,0.1);
        transition: background-color 0.25s ease, color 0.25s ease;
      }
      
      /* Apple Category Colors */
      .nav-item[data-nav="home"] .nav-icon { background: #007aff; }
      .nav-item[data-nav="lighting"] .nav-icon { background: #ffcc00; color: #000; }
      .nav-item[data-nav="climate"] .nav-icon { background: #ff9500; }
      .nav-item[data-nav="security"] .nav-icon { background: #4cd964; }
      .nav-item[data-nav="media"] .nav-icon { background: #5856d6; }
      .nav-item[data-nav="cameras"] .nav-icon { background: #8e8e93; }
      
      .nav-icon ha-icon {
        --mdc-icon-size: 18px;
      }

      .nav-text {
        font-size: 15px;
        font-weight: 500;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .nav-badge {
        margin-left: auto;
        background: rgba(255,255,255,0.12);
        color: rgba(255,255,255,0.6);
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 10px;
        min-width: 18px;
        text-align: center;
      }

      .sidebar-divider {
        height: 1px;
        background: rgba(255,255,255,0.08);
        margin: 8px 12px 16px 12px;
      }
    `;
    this.container.appendChild(styleEl);
    this.stylesInjected = true;
  }

  /** Full DOM render */
  private renderFull(rooms: { id: string; name: string; icon: string }[]) {
    // Count entities per room for badges
    const roomCounts = this.countEntitiesPerRoom(rooms);
    
    this.container.innerHTML = '';
    this.ensureStyles();

    const wrapper = document.createElement('div');
    wrapper.className = 'apple-sidebar-container';
    wrapper.innerHTML = `
      <div class="sidebar-header">
        <span class="sidebar-title">${localize('pages.my_home') || 'Zuhause'}</span>
        <button class="sidebar-toggle-btn" id="close-sidebar-btn">
          <ha-icon icon="mdi:chevron-left"></ha-icon>
        </button>
      </div>
      
      <div class="sidebar-scroll-area">
        <div class="nav-section">
          <div class="nav-item ${this.activePage === 'home' ? 'active' : ''}" data-nav="home">
            <div class="nav-icon"><ha-icon icon="mdi:home-variant-outline"></ha-icon></div>
            <div class="nav-text">${localize('pages.my_home') || 'Zuhause'}</div>
          </div>
          <div class="nav-item ${this.activePage === 'automation' ? 'active' : ''}" data-nav="scenes">
            <div class="nav-icon"><ha-icon icon="mdi:clock-star-four-points"></ha-icon></div>
            <div class="nav-text">${localize('ui_actions.automation') || 'Automation'}</div>
          </div>
          <div class="nav-item ${this.activePage === 'cameras' ? 'active' : ''}" data-nav="cameras">
            <div class="nav-icon"><ha-icon icon="mdi:cctv"></ha-icon></div>
            <div class="nav-text">${localize('pages.cameras') || 'Kameras'}</div>
          </div>
        </div>
        
        <div class="sidebar-divider"></div>
        
        <div class="nav-section">
          <div class="nav-section-title">${localize('groups.lights') ? 'Kategorien' : 'Kategorien'}</div>
          <div class="nav-item ${this.activePage === 'lighting' ? 'active' : ''}" data-nav="lighting">
            <div class="nav-icon"><ha-icon icon="mdi:lightbulb-outline"></ha-icon></div>
            <div class="nav-text">${localize('groups.lights') || 'Lichtquellen'}</div>
          </div>
          <div class="nav-item ${this.activePage === 'climate' ? 'active' : ''}" data-nav="climate">
            <div class="nav-icon"><ha-icon icon="mdi:thermometer"></ha-icon></div>
            <div class="nav-text">${localize('groups.climate') || 'Klima'}</div>
          </div>
          <div class="nav-item ${this.activePage === 'security' ? 'active' : ''}" data-nav="security">
            <div class="nav-icon"><ha-icon icon="mdi:shield-lock-outline"></ha-icon></div>
            <div class="nav-text">${localize('groups.security') || 'Sicherheit'}</div>
          </div>
          <div class="nav-item ${this.activePage === 'media' ? 'active' : ''}" data-nav="media">
            <div class="nav-icon"><ha-icon icon="mdi:speaker"></ha-icon></div>
            <div class="nav-text">${localize('groups.media') || 'Medien'}</div>
          </div>
        </div>
        
        <div class="sidebar-divider"></div>
        
        <div class="nav-section">
          <div class="nav-section-title">Räume</div>
          ${rooms.map(room => `
            <div class="nav-item ${this.activePage === room.id ? 'active' : ''}" data-nav="room" data-room-id="${room.id}">
              <div class="nav-icon"><ha-icon icon="${room.icon}"></ha-icon></div>
              <div class="nav-text">${room.name}</div>
              ${roomCounts[room.id] ? `<span class="nav-badge">${roomCounts[room.id]}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.container.appendChild(wrapper);
    this.attachListeners(wrapper);
  }

  /** Count entities per area for room badges */
  private countEntitiesPerRoom(rooms: { id: string; name: string; icon: string }[]): Record<string, number> {
    if (!this._hass?.entities) return {};
    
    const counts: Record<string, number> = {};
    const entities = this._hass.entities || {};
    
    for (const entityId of Object.keys(entities)) {
      const entity = entities[entityId];
      const areaId = entity?.area_id;
      if (areaId && !entity.hidden_by && !entity.disabled_by) {
        counts[areaId] = (counts[areaId] || 0) + 1;
      }
    }
    return counts;
  }

  /** Attach all event listeners to sidebar */
  private attachListeners(wrapper: HTMLElement) {
    // Close button
    const closeBtn = wrapper.querySelector('#close-sidebar-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onClose?.();
      });
    }

    // All nav items (using event delegation on wrapper)
    wrapper.addEventListener('click', (e) => {
      const navItem = (e.target as HTMLElement).closest('.nav-item') as HTMLElement;
      if (!navItem) return;
      
      e.stopPropagation();
      const nav = navItem.getAttribute('data-nav');
      const roomId = navItem.getAttribute('data-room-id');

      if (!nav) return;

      let targetPath = '';
      switch (nav) {
        case 'home':
          targetPath = '';
          break;
        case 'scenes':
          targetPath = 'scenes';
          break;
        case 'cameras':
          targetPath = 'cameras';
          break;
        case 'lighting':
        case 'climate':
        case 'security':
        case 'media':
        case 'vacuum':
        case 'energy':
        case 'water':
        case 'other':
          targetPath = nav;
          break;
        case 'room':
          if (roomId) targetPath = `room-${roomId}`;
          break;
      }

      this.navigateTo(targetPath);
    });
  }

  /** Navigate using HA's routing */
  private navigateTo(subPath: string) {
    const currentPath = window.location.pathname;
    const pathParts = currentPath.split('/').filter(Boolean);
    const basePath = pathParts.length > 0 ? `/${pathParts[0]}/` : '/lovelace/';
    const newUrl = `${basePath}${subPath}`;

    // Don't navigate to same page
    if (newUrl === currentPath || newUrl === currentPath + '/') return;

    window.history.pushState(null, '', newUrl);
    window.dispatchEvent(new Event('location-changed'));

    // Notify callback
    this.onNavigate?.(subPath);

    // Update active state without full re-render
    this.updateActivePage();
    this.lastActivePage = ''; // Force re-render next time
    this.smartRender();
  }
}
