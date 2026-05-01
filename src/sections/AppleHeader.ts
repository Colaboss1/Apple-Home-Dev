import { EditModeManager } from '../utils/EditModeManager';
import { CustomizationManager } from '../utils/CustomizationManager';
import { localize } from '../utils/LocalizationService';
import { RTLHelper } from '../utils/RTLHelper';
import { AppleChips } from './AppleChips';

export interface HeaderConfig { title: string; isGroupPage?: boolean; isSpecialPage?: boolean; showMenu?: boolean; showBackButton?: boolean; pageType?: string; }

export class AppleHeader {
  private static instance: AppleHeader;
  private container?: HTMLElement;
  private editModeManager?: EditModeManager;
  private customizationManager?: CustomizationManager;
  private chipsElement?: AppleChips;
  private _hass: any;
  private config?: HeaderConfig;
  private refreshCallbacks: (() => void)[] = [];
  private isScrolled = false;

  private constructor() {
    window.addEventListener('scroll', () => this.handleScroll(), { passive: true });
  }

  public static getInstance(): AppleHeader { if (!AppleHeader.instance) AppleHeader.instance = new AppleHeader(); return AppleHeader.instance; }
  public setEditModeManager(m: EditModeManager) { this.editModeManager = m; }
  public setCustomizationManager(m: CustomizationManager) { this.customizationManager = m; }
  public setChipsElement(c: AppleChips) { this.chipsElement = c; }
  public setHass(h: any) { this._hass = h; }
  public addRefreshCallback(cb: () => void) { this.refreshCallbacks.push(cb); }

  private handleScroll() {
    const s = window.scrollY > 20;
    if (s !== this.isScrolled) {
      this.isScrolled = s;
      const el = document.querySelector('.apple-home-header');
      if (el) el.classList.toggle('scrolled', s);
    }
  }

  public async init(parent: HTMLElement, config: HeaderConfig) {
    this.config = config;
    let el = parent.querySelector('.apple-home-header') as HTMLElement;
    if (!el) { el = document.createElement('div'); el.className = 'apple-home-header'; parent.prepend(el); }
    this.container = el;
    this.render();
  }

  private render() {
    if (!this.container) return;
    const isEdit = this.editModeManager?.isEditMode() || false;
    this.container.innerHTML = `
      <style>
        .apple-home-header { position: sticky; top: 0; left: 0; right: 0; height: 60px; display: flex; align-items: center; justify-content: space-between; padding: 0 4px; z-index: 1000; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); background: transparent; margin: 0 -4px 10px; }
        .apple-home-header.scrolled { background: rgba(20, 20, 22, 0.7); backdrop-filter: blur(25px) saturate(1.8); -webkit-backdrop-filter: blur(25px) saturate(1.8); border-bottom: 0.5px solid rgba(255, 255, 255, 0.1); }
        .header-left, .header-right { display: flex; align-items: center; gap: 8px; }
        .header-title { font-size: 17px; font-weight: 600; color: #fff; opacity: 0; transform: translateY(10px); transition: all 0.3s ease; pointer-events: none; }
        .scrolled .header-title { opacity: 1; transform: translateY(0); }
        .header-btn { background: rgba(255, 255, 255, 0.1); border: none; border-radius: 50%; width: 36px; height: 36px; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
        .header-btn:hover { background: rgba(255, 255, 255, 0.15); }
        .header-btn:active { transform: scale(0.9); background: rgba(255, 255, 255, 0.2); }
        .header-btn ha-icon { --mdc-icon-size: 22px; }
        .done-btn { background: #fff; color: #000; border-radius: 18px; padding: 0 16px; width: auto; font-size: 15px; font-weight: 600; height: 32px; }
        .done-btn:hover { background: rgba(255, 255, 255, 0.9); }
        .menu-dropdown { position: absolute; top: 50px; right: 10px; background: rgba(35, 35, 38, 0.7); backdrop-filter: blur(30px); border-radius: 14px; padding: 6px; min-width: 200px; box-shadow: 0 15px 40px rgba(0,0,0,0.4); display: none; flex-direction: column; z-index: 1001; border: 0.5px solid rgba(255,255,255,0.1); will-change: transform, opacity; }
        .menu-dropdown.show { display: flex; animation: menuFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes menuFadeIn { from { opacity: 0; transform: scale(0.95) translateY(-10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .menu-item { padding: 10px 14px; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: space-between; border-radius: 10px; font-size: 15px; font-weight: 500; transition: background 0.2s; }
        .menu-item:hover { background: rgba(255, 255, 255, 0.1); }
        .menu-item.danger { color: #ff453a; }
        .menu-item ha-icon { --mdc-icon-size: 20px; color: rgba(255,255,255,0.6); }
        .menu-item:hover ha-icon { color: #fff; }
        .menu-divider { height: 0.5px; background: rgba(255, 255, 255, 0.1); margin: 6px 4px; }
      </style>
      <div class="header-left">
        ${this.config?.showBackButton ? `<button class="header-btn back-btn"><ha-icon icon="${RTLHelper.isRTL() ? 'mdi:chevron-right' : 'mdi:chevron-left'}"></ha-icon></button>` : `<button class="header-btn sidebar-btn"><ha-icon icon="mdi:menu"></ha-icon></button>`}
      </div>
      <div class="header-title">${this.config?.title || ''}</div>
      <div class="header-right">
        ${isEdit ? `<button class="header-btn done-btn">${localize('edit.done')}</button>` : `
          <button class="header-btn menu-btn"><ha-icon icon="mdi:dots-circle"></ha-icon></button>
          <div class="menu-dropdown">
            <div class="menu-item edit-btn"><span>${localize('edit.edit_home')}</span><ha-icon icon="mdi:pencil-outline"></ha-icon></div>
            <div class="menu-divider"></div>
            <div class="menu-item refresh-btn"><span>${localize('actions.refresh')}</span><ha-icon icon="mdi:refresh"></ha-icon></div>
            <div class="menu-item settings-btn"><span>${localize('pages.settings')}</span><ha-icon icon="mdi:cog-outline"></ha-icon></div>
          </div>
        `}
      </div>
    `;
    this.attachEvents();
  }

  private attachEvents() {
    const menuBtn = this.container?.querySelector('.menu-btn'), dropdown = this.container?.querySelector('.menu-dropdown'), doneBtn = this.container?.querySelector('.done-btn'), editBtn = this.container?.querySelector('.edit-btn'), refreshBtn = this.container?.querySelector('.refresh-btn'), backBtn = this.container?.querySelector('.back-btn'), sidebarBtn = this.container?.querySelector('.sidebar-btn');
    menuBtn?.addEventListener('click', (e) => { e.stopPropagation(); dropdown?.classList.toggle('show'); });
    document.addEventListener('click', () => dropdown?.classList.remove('show'));
    doneBtn?.addEventListener('click', () => { this.editModeManager?.setEditMode(false); this.render(); });
    editBtn?.addEventListener('click', () => { this.editModeManager?.setEditMode(true); dropdown?.classList.remove('show'); this.render(); });
    refreshBtn?.addEventListener('click', () => { this.refreshCallbacks.forEach(cb => cb()); dropdown?.classList.remove('show'); });
    backBtn?.addEventListener('click', () => this.navigateBack());
    sidebarBtn?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('apple-sidebar-toggled', { detail: { toggle: true } })));
  }

  private navigateBack() {
    const cur = window.location.pathname, parts = cur.split('/').filter(x => x.length > 0);
    if (parts.length > 1) {
      parts.pop();
      const url = `/${parts.join('/')}`;
      window.history.pushState(null, '', url);
      window.dispatchEvent(new Event('location-changed', { bubbles: true, composed: true }));
    }
  }
}
