import { DragAndDropManager } from '../utils/DragAndDropManager';
import { EditModeManager } from '../utils/EditModeManager';
import { AppleHeader, HeaderConfig } from '../sections/AppleHeader';
import { CustomizationManager } from '../utils/CustomizationManager';
import { CardManager } from '../utils/CardManager';
import { setupLocalize, localize } from '../utils/LocalizationService';
import { AppleChips, ChipsConfig } from '../sections/AppleChips';
import { ChipsConfigurationManager } from '../utils/ChipsConfigurationManager';
import { BackgroundManager } from '../utils/BackgroundManager';
import { HomeAssistantUIManager } from '../utils/HomeAssistantUIManager';
import { AppleSidebar } from '../sections/AppleSidebar';
import { AppleTabBar } from '../sections/AppleTabBar';
import { HomePage } from '../pages/HomePage';
import { GroupPage } from '../pages/GroupPage';
import { RTLHelper } from '../utils/RTLHelper';
import { RoomPage } from '../pages/RoomPage';
import { ScenesPage } from '../pages/ScenesPage';
import { CamerasPage } from '../pages/CamerasPage';
import { DeviceGroup } from '../config/DashboardConfig';

export class AppleHomeView extends HTMLElement {
  private _hass?: any;
  private config?: any;
  private content?: HTMLElement;
  private customizationManager: CustomizationManager;
  private cardManager: CardManager;
  private editModeManager: EditModeManager;
  private appleHeader: AppleHeader;
  private dragAndDropManager: DragAndDropManager;
  private backgroundManager: BackgroundManager;
  private sidebarElement?: AppleSidebar;
  private tabBarElement?: AppleTabBar;
  private chipsElement?: AppleChips;
  private homePage: HomePage;
  private roomPage: RoomPage;
  private groupPage: GroupPage;
  private scenesPage: ScenesPage;
  private camerasPage: CamerasPage;
  private isSidebarCollapsed = false;
  private _rendered = false;
  private _isTransitioning = false;
  private _activePage: string = 'home';

  constructor() {
    super();
    this.customizationManager = CustomizationManager.getInstance();
    this.cardManager = new CardManager(this.customizationManager);
    this.backgroundManager = new BackgroundManager(this.customizationManager);
    this.editModeManager = new EditModeManager((mode) => this.handleEditModeChange(mode));
    this.appleHeader = AppleHeader.getInstance();
    this.appleHeader.setEditModeManager(this.editModeManager);
    this.appleHeader.setCustomizationManager(this.customizationManager);
    this.appleHeader.addRefreshCallback(() => this.renderPage('refresh'));
    this.dragAndDropManager = new DragAndDropManager((aid) => this.handleSaveOrder(aid), this.customizationManager, 'home');
    this.homePage = new HomePage();
    this.roomPage = new RoomPage();
    this.groupPage = new GroupPage();
    this.scenesPage = new ScenesPage();
    this.camerasPage = new CamerasPage();
  }

  static get styles(): string {
    return `
      :host { display: block; padding: 0 var(--apple-page-padding, 22px) var(--apple-page-padding-bottom, 100px); box-sizing: border-box; width: 100%; background: transparent; position: relative; container-type: inline-size; --card-gap: var(--apple-card-gap, 12px); --section-margin: var(--apple-section-gap, 32px); font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif; }
      .wrapper-content { width: 100%; transition: margin-left 0.4s cubic-bezier(0.16, 1, 0.3, 1), max-width 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      .apple-page-title { font-size: 34px; font-weight: 700; color: #fff; margin: 0 0 20px; letter-spacing: -1.2px; line-height: 1.1; display: block; }
      .area-title, .apple-home-section-title { font-size: 20px; font-weight: 700; color: #fff; margin: 32px 0 14px; letter-spacing: -0.5px; display: flex; align-items: center; justify-content: space-between; }
      .clickable-section-title { display: inline-flex; align-items: center; cursor: pointer; transition: opacity 0.2s ease; }
      .clickable-section-title:active { opacity: 0.6; }
      .clickable-section-title .section-arrow { color: rgba(255, 255, 255, 0.4); margin-left: 4px; --mdc-icon-size: 20px; }
      .carousel-container { overflow-x: auto; overflow-y: hidden; margin-bottom: var(--section-margin); margin-inline: calc(-1 * var(--apple-page-padding, 22px)); -webkit-overflow-scrolling: touch; scrollbar-width: none; }
      .carousel-container::-webkit-scrollbar { display: none; }
      .carousel-grid { display: inline-flex; gap: var(--card-gap); padding-inline: var(--apple-page-padding, 22px); min-width: 100%; box-sizing: border-box; }
      .carousel-grid .entity-card-wrapper { flex: 0 0 auto; width: 160px; height: 74px; }
      .carousel-grid.cameras .entity-card-wrapper { width: 280px; height: 185px; }
      .area-entities { display: grid; grid-template-columns: repeat(12, 1fr); grid-auto-rows: 74px; gap: var(--card-gap); margin-bottom: 24px; }
      .entity-card-wrapper { grid-column: span 3; position: relative; }
      .entity-card-wrapper.tall { grid-row: span 2; }
      .entity-card-wrapper.edit-mode { animation: jiggle 0.3s ease-in-out infinite alternate; }
      @keyframes jiggle { 0% { transform: rotate(-0.8deg); } 100% { transform: rotate(0.8deg); } }
      .entity-controls { position: absolute; top: -8px; right: -8px; display: none; gap: 4px; z-index: 10; }
      .edit-mode .entity-controls { display: flex; }
      .entity-control-btn { background: rgba(255, 255, 255, 0.95); border: none; border-radius: 50%; width: 28px; height: 28px; color: #333; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
      .entity-control-btn:active { transform: scale(0.9); }
      .entity-hide-btn { position: absolute; top: -6px; left: -6px; display: none; width: 24px; height: 24px; border-radius: 50%; background: #ff3b30; color: #fff; border: 2px solid #fff; align-items: center; justify-content: center; z-index: 11; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
      .edit-mode .entity-hide-btn { display: flex; }
      :host(.is-ipad-mode) .wrapper-content { margin-left: 320px; width: calc(100% - 320px); }
      :host(.is-ipad-mode.sidebar-collapsed) .wrapper-content { margin-left: 0; width: 100%; }
      .sidebar-container { position: fixed; top: 0; left: 0; width: 320px; height: 100vh; z-index: 1000; transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1); background: rgba(20,20,22,0.8); backdrop-filter: blur(40px); }
      :host(.sidebar-collapsed) .sidebar-container { transform: translateX(-100%); }
      @container (max-width: 1000px) { .entity-card-wrapper { grid-column: span 4; } }
      @container (max-width: 700px) { .entity-card-wrapper { grid-column: span 6; } }
      @container (max-width: 450px) { .entity-card-wrapper { grid-column: span 12; } }
    `;
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = AppleHomeView.styles;
      this.shadowRoot!.appendChild(style);
      this.shadowRoot!.innerHTML += `
        <div class="wrapper-content">
          <div class="page-content">
            <div class="apple-home-header"></div>
            <div class="permanent-chips"></div>
          </div>
        </div>
        <div class="sidebar-container"></div>
        <div class="tab-bar-container"></div>
      `;
    }
    this.content = this.shadowRoot!.querySelector('.page-content') as HTMLElement;
    this.setupListeners();
    this.setCurrentActiveInstance();
  }

  private setupListeners() {
    document.addEventListener('apple-home-dashboard-refresh', (e: any) => { if (e.detail?.customizations) this.handleGlobalRefresh(e.detail.customizations); });
    this.addEventListener('apple-home-hide-entity', (e: any) => this.handleHideEntity(e.detail.entityId, e.detail.areaId));
    window.addEventListener('location-changed', () => this.handleLocationChange());
    window.addEventListener('popstate', () => this.handleLocationChange());
    document.addEventListener('apple-sidebar-toggled', (e: any) => {
      if (e.detail?.toggle) this.isSidebarCollapsed = !this.isSidebarCollapsed;
      else if (e.detail?.open !== undefined) this.isSidebarCollapsed = !e.detail.open;
      this.updateSidebarState();
    });
  }

  private updateSidebarState() {
    this.classList.toggle('sidebar-collapsed', this.isSidebarCollapsed);
  }

  private handleLocationChange() {
    const path = window.location.pathname;
    const m = path.match(/group-([^\/]+)/);
    if (m) { this.config = { ...this.config, pageType: 'group', deviceGroup: m[1] }; this._activePage = 'group'; }
    else if (path.includes('room-')) { const aid = path.split('room-')[1]; this.config = { ...this.config, pageType: 'room', areaId: aid, areaName: aid }; this._activePage = 'room'; }
    else if (path.includes('scenes')) { this.config = { ...this.config, pageType: 'scenes' }; this._activePage = 'scenes'; }
    else if (path.includes('cameras')) { this.config = { ...this.config, pageType: 'cameras' }; this._activePage = 'cameras'; }
    else { this.config = { ...this.config, pageType: 'home' }; this._activePage = 'home'; }
    this.renderPage('locationChanged');
  }

  private setCurrentActiveInstance() { (window as any).appleHomeActiveView = this; }

  async setConfig(config: any) {
    this.config = config;
    this._activePage = config.pageType || 'home';
    if (this._hass) await this.renderPage('setConfig');
  }

  set hass(hass: any) {
    const first = !this._hass; this._hass = hass;
    setupLocalize(hass);
    this.customizationManager.setHass(hass);
    this.appleHeader.setHass(hass);
    if (this.sidebarElement) this.sidebarElement.hass = hass;
    if (this.tabBarElement) this.tabBarElement.hass = hass;
    if (this.chipsElement) this.chipsElement.hass = hass;
    if (first) this.renderPage('setHassFirst');
    else this.updateExistingCards(hass);
  }

  private async handleGlobalRefresh(cust: any) {
    await this.customizationManager.setCustomizations(cust);
    this.renderPage('globalRefresh');
  }

  private async handleHideEntity(eid: string, aid?: string) {
    if (aid === 'favorites') await this.customizationManager.removeFavorite(eid);
    else await this.customizationManager.hideEntityFromHome(eid);
    this.renderPage('hideEntity');
  }

  private async handleSaveOrder(aid: string) {
    const grid = this.content?.querySelector(`[data-area-id="${aid}"]`);
    if (!grid) return;
    const ids = Array.from(grid.querySelectorAll('.entity-card-wrapper')).map(w => (w as HTMLElement).dataset.entityId).filter(Boolean) as string[];
    await this.customizationManager.saveCardOrderWithContext(aid, ids, this._activePage);
  }

  private async renderPage(source: string) {
    if (!this.content || !this._hass || this._isTransitioning) return;
    this._isTransitioning = true;
    const isMobile = this.customizationManager.isMobileViewActive();
    const isIpad = this.customizationManager.isIpadModeActive();
    this.classList.toggle('is-mobile-view', isMobile);
    this.classList.toggle('is-ipad-mode', isIpad);
    this.backgroundManager.applyBackgroundOnly(this.backgroundManager.getCurrentBackground());

    const headerConfig: HeaderConfig = { 
      title: this.config?.title || localize('pages.my_home'), 
      isGroupPage: this._activePage === 'group', 
      isSpecialPage: ['room', 'scenes', 'cameras'].includes(this._activePage), 
      showMenu: true, 
      showBackButton: this._activePage !== 'home', 
      pageType: this._activePage 
    };
    await this.appleHeader.init(this.content, headerConfig);

    if (this._activePage === 'home') {
      await this.ensureChipsExist();
      this.updateChips();
      await this.homePage.render(this.content, this._hass, headerConfig.title, (eid, aid) => this.toggleTall(eid, aid));
    } else {
      if (this.chipsElement) { this.chipsElement.destroy(); this.chipsElement = undefined; this.shadowRoot!.querySelector('.permanent-chips')!.innerHTML = ''; }
      if (this._activePage === 'group') await this.groupPage.render(this.content, this.config.deviceGroup, this._hass, (eid, aid) => this.toggleTall(eid, aid));
      else if (this._activePage === 'room') await this.roomPage.render(this.content, this.config.areaId, this.config.areaName, this._hass, (eid, aid) => this.toggleTall(eid, aid));
      else if (this._activePage === 'scenes') await this.scenesPage.render(this.content, this._hass, (eid, aid) => this.toggleTall(eid, aid));
      else if (this._activePage === 'cameras') await this.camerasPage.render(this.content, this._hass, (eid, aid) => this.toggleTall(eid, aid));
    }

    if (isIpad && !this.sidebarElement) {
      const container = this.shadowRoot!.querySelector('.sidebar-container') as HTMLElement;
      this.sidebarElement = new AppleSidebar(container);
      this.sidebarElement.hass = this._hass;
    }
    
    if (isMobile && !this.tabBarElement) {
      const container = this.shadowRoot!.querySelector('.tab-bar-container') as HTMLElement;
      this.tabBarElement = new AppleTabBar(container);
      this.tabBarElement.hass = this._hass;
    }

    this._rendered = true; this._isTransitioning = false;
  }

  private async ensureChipsExist() {
    const container = this.shadowRoot!.querySelector('.permanent-chips') as HTMLElement;
    if (!this.chipsElement) {
      this.chipsElement = new AppleChips(container, this.customizationManager);
      this.chipsElement.onGroupChange = (g) => this.onChipsGroupChange(g);
    }
  }

  private async updateChips() {
    if (!this.chipsElement || !this._hass) return;
    const config = await ChipsConfigurationManager.generateConfig(this._hass, this.customizationManager);
    this.chipsElement.setConfig(config);
    this.chipsElement.hass = this._hass;
    this.appleHeader.setChipsElement(this.chipsElement);
  }

  private onChipsGroupChange(group: DeviceGroup | null) {
    if (!group) return;
    const current = window.location.pathname, base = current.split('/').filter(x => x.length > 0)[0] || 'lovelace';
    window.history.pushState(null, '', `/${base}/group-${group}`);
    window.dispatchEvent(new Event('location-changed', { bubbles: true, composed: true }));
  }

  private updateExistingCards(hass: any) {
    if (!this.content) return;
    this.content.querySelectorAll('apple-home-card').forEach((c: any) => c.hass = hass);
    if (this.sidebarElement) this.sidebarElement.hass = hass;
    if (this.tabBarElement) this.tabBarElement.hass = hass;
    if (this.chipsElement) this.chipsElement.hass = hass;
  }

  private handleEditModeChange(edit: boolean) {
    this.content?.classList.toggle('edit-mode', edit);
    if (edit) {
      this.dragAndDropManager.enableDragAndDrop(this.content!);
      if (this._activePage === 'scenes') this.scenesPage.updateDragAndDrop(true, this.content!);
      else if (this._activePage === 'cameras') this.camerasPage.updateDragAndDrop(true, this.content!);
    } else {
      this.dragAndDropManager.disableDragAndDrop(this.content!);
      if (this._activePage === 'scenes') this.scenesPage.updateDragAndDrop(false, this.content!);
      else if (this._activePage === 'cameras') this.camerasPage.updateDragAndDrop(false, this.content!);
      this.customizationManager.saveLayoutToStorage(this._hass);
    }
    this.content?.querySelectorAll('.entity-card-wrapper').forEach((w: any) => {
      w.classList.toggle('edit-mode', edit);
      const card = w.querySelector('apple-home-card') as any;
      if (card?.refreshEditMode) card.refreshEditMode();
    });
  }

  private async toggleTall(eid: string, aid: string) {
    const tall = await this.cardManager.toggleTallCard(eid, aid, this._activePage);
    const wrap = this.content?.querySelector(`[data-entity-id="${eid}"]`);
    if (wrap) {
      wrap.classList.toggle('tall', tall);
      const card = wrap.querySelector('apple-home-card') as any;
      if (card) card.setConfig({ ...card.config, is_tall: tall });
    }
  }

  getCardSize() { return 1; }
}
customElements.define('apple-home-view', AppleHomeView);
