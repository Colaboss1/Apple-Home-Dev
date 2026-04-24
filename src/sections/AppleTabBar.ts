import { localize } from '../utils/LocalizationService';

export class AppleTabBar {
  private container: HTMLElement;
  private activePage: string = 'home';
  private onNavigate?: (path: string) => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  set hass(hass: any) {
    this.updateActivePage();
    this.render();
  }

  setOnNavigate(cb: (path: string) => void) {
    this.onNavigate = cb;
  }

  private updateActivePage() {
    const path = window.location.pathname;
    if (path.includes('automation') || path.includes('scenes')) this.activePage = 'automation';
    else if (path.includes('discover') || path.includes('entdecken')) this.activePage = 'discover';
    else this.activePage = 'home';
  }

  private render() {
    this.container.innerHTML = `
      <style>
        .apple-tab-bar {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 44px);
          max-width: 400px;
          height: 64px;
          background: rgba(35, 35, 38, 0.7);
          backdrop-filter: blur(30px) saturate(1.8);
          -webkit-backdrop-filter: blur(30px) saturate(1.8);
          border-radius: 32px;
          display: flex;
          align-items: center;
          justify-content: space-around;
          padding: 0 10px;
          z-index: 2000;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          border: 0.5px solid rgba(255,255,255,0.1);
        }
        .tab-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          color: rgba(255, 255, 255, 0.4);
          cursor: pointer;
          transition: all 0.2s ease;
          flex: 1;
          height: 100%;
        }
        .tab-item.active {
          color: #ffcc00;
        }
        .tab-item ha-icon {
          --mdc-icon-size: 26px;
        }
        .tab-text {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: -0.1px;
        }
        @media (min-width: 768px) {
          .apple-tab-bar {
            display: none;
          }
        }
      </style>
      <div class="apple-tab-bar">
        <div class="tab-item ${this.activePage === 'home' ? 'active' : ''}" data-path="home">
          <ha-icon icon="mdi:home-variant"></ha-icon>
          <span class="tab-text">${localize('pages.my_home')}</span>
        </div>
        <div class="tab-item ${this.activePage === 'automation' ? 'active' : ''}" data-path="scenes">
          <ha-icon icon="mdi:clock-star-four-points"></ha-icon>
          <span class="tab-text">${localize('ui_actions.automation')}</span>
        </div>
        <div class="tab-item ${this.activePage === 'discover' ? 'active' : ''}" data-path="discover">
          <ha-icon icon="mdi:star"></ha-icon>
          <span class="tab-text">${localize('pages.discover')}</span>
        </div>
      </div>
    `;

    this.container.querySelectorAll('.tab-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const path = (e.currentTarget as HTMLElement).dataset.path;
        if (path) this.navigateTo(path);
      });
    });
  }

  private navigateTo(path: string) {
    const cur = window.location.pathname;
    const base = cur.split('/').filter(Boolean)[0] || 'lovelace';
    const url = `/${base}/${path === 'home' ? '' : path}`;
    if (url === cur || url === cur + '/') return;
    window.history.pushState(null, '', url);
    window.dispatchEvent(new Event('location-changed'));
    this.onNavigate?.(path);
  }
}
