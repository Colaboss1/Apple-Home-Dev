import { CustomizationManager } from './CustomizationManager';
import Sortable from 'sortablejs';
import { localize } from './LocalizationService';
import { RTLHelper } from './RTLHelper';
import { injectLiquidGlassStyles, LiquidGlassClasses } from './LiquidGlassStyles';
import { EnergySection } from '../sections/EnergySection';

interface SectionItem { id: string; name: string; type: 'area' | 'scenes' | 'cameras' | 'favorites' | 'weather' | 'energy'; visible: boolean; order: number; }

export class SectionReorderManager {
  private modal?: HTMLElement;
  private customizationManager: CustomizationManager;
  private onSaveCallback: () => void;
  private sections: SectionItem[] = [];
  private sortableInstance?: Sortable;

  constructor(cm: CustomizationManager, cb: () => void) { this.customizationManager = cm; this.onSaveCallback = cb; }

  public async showReorderModal(areas: any[], hass: any) { this.sections = await this.prepareSectionsData(areas, hass); this.createModal(); this.setupEventListeners(); this.showModal(); }

  private async prepareSectionsData(areas: any[], hass: any): Promise<SectionItem[]> {
    const res: SectionItem[] = [], c = this.customizationManager.getCustomizations(), ord = c.home?.sections?.order || [], hid = c.home?.sections?.hidden || [], w = await this.customizationManager.getWeatherEntity();
    if (w && hass.states[w]) res.push({ id: 'weather_section', name: localize('section_titles.weather'), type: 'weather', visible: !hid.includes('weather_section'), order: ord.indexOf('weather_section') !== -1 ? ord.indexOf('weather_section') : 0 });
    const hasW = !!(w && hass.states[w]), showE = await this.customizationManager.getShowEnergy(), hasE = showE && EnergySection.hasEnergySensors(hass);
    if (hasE) res.push({ id: 'energy_section', name: localize('section_titles.energy'), type: 'energy', visible: !hid.includes('energy_section'), order: ord.indexOf('energy_section') !== -1 ? ord.indexOf('energy_section') : (hasW ? 1 : 0) });
    const cams = Object.values(hass.states).filter((s: any) => s.entity_id.startsWith('camera.') && !hass.entities?.[s.entity_id]?.hidden_by && !hass.entities?.[s.entity_id]?.disabled_by);
    if (cams.length > 0) res.push({ id: 'cameras_section', name: localize('section_titles.cameras'), type: 'cameras', visible: !hid.includes('cameras_section'), order: ord.indexOf('cameras_section') !== -1 ? ord.indexOf('cameras_section') : (hasW ? 1 : 0) + (hasE ? 1 : 0) });
    const scns = Object.values(hass.states).filter((s: any) => (s.entity_id.startsWith('scene.') || s.entity_id.startsWith('script.')) && !hass.entities?.[s.entity_id]?.hidden_by && !hass.entities?.[s.entity_id]?.disabled_by);
    if (scns.length > 0) { const b = (hasW ? 1 : 0) + (hasE ? 1 : 0) + (cams.length > 0 ? 1 : 0); res.push({ id: 'scenes_section', name: localize('section_titles.scenes'), type: 'scenes', visible: !hid.includes('scenes_section'), order: ord.indexOf('scenes_section') !== -1 ? ord.indexOf('scenes_section') : b }); }
    const favs = await this.customizationManager.getFavoriteAccessories();
    if (favs.length > 0) { const b = (hasW ? 1 : 0) + (hasE ? 1 : 0) + (cams.length > 0 ? 1 : 0) + (scns.length > 0 ? 1 : 0); res.push({ id: 'favorites_section', name: localize('section_titles.favorites'), type: 'favorites', visible: !hid.includes('favorites_section'), order: ord.indexOf('favorites_section') !== -1 ? ord.indexOf('favorites_section') : b }); }
    areas.forEach((a, i) => { const id = a.area_id || a.id, b = (hasW ? 1 : 0) + (hasE ? 1 : 0) + (cams.length > 0 ? 1 : 0) + (scns.length > 0 ? 1 : 0) + (favs.length > 0 ? 1 : 0) + i; res.push({ id, name: a.name || id, type: 'area', visible: !hid.includes(id), order: ord.indexOf(id) !== -1 ? ord.indexOf(id) : b }); });
    let hasDef = false; try { const e = hass.entities ? (Object.values(hass.entities) as any[]) : [], d = hass.devices ? (Object.values(hass.devices) as any[]) : []; hasDef = e.some((x: any) => !x.area_id && (!x.device_id || !d.find((y: any) => y.id === x.device_id)?.area_id)); } catch { hasDef = true; }
    if (hasDef) { const b = (hasW ? 1 : 0) + (hasE ? 1 : 0) + (cams.length > 0 ? 1 : 0) + (scns.length > 0 ? 1 : 0) + (favs.length > 0 ? 1 : 0) + areas.length; res.push({ id: 'no_area', name: localize('pages.default_room'), type: 'area', visible: !hid.includes('no_area'), order: ord.indexOf('no_area') !== -1 ? ord.indexOf('no_area') : b }); }
    return res.sort((a, b) => a.order - b.order);
  }

  private createModal() {
    this.modal = document.createElement('div'); this.modal.className = `apple-section-reorder-modal ${RTLHelper.isRTL() ? 'rtl' : 'ltr'}`;
    this.modal.innerHTML = `<div class="modal-backdrop"></div><div class="modal-content"><div class="modal-header"><button class="modal-cancel ${LiquidGlassClasses.modalCancel}"><ha-icon icon="mdi:close"></ha-icon></button><h2>${localize('section_reorder.title')}</h2><button class="modal-done ${LiquidGlassClasses.modalDone}"><ha-icon icon="mdi:check"></ha-icon><div class="save-spinner"></div></button></div><div class="modal-body"><div class="sections-list">${this.sections.map((s, i) => `<div class="section-item" data-section-id="${s.id}" data-index="${i}"><button class="section-visibility-toggle ${s.visible ? 'visible' : 'hidden'}" data-section-id="${s.id}"><ha-icon icon="${s.visible ? 'mdi:eye' : 'mdi:eye-off'}"></ha-icon></button><div class="section-info"><span class="section-name">${s.name}</span></div><div class="section-drag-handle"><ha-icon icon="mdi:menu"></ha-icon></div></div>`).join('')}</div></div></div>`;
    this.addModalStyles(); document.body.appendChild(this.modal);
  }

  private addModalStyles() {
    injectLiquidGlassStyles(); if (document.querySelector('#apple-section-reorder-styles')) return; const s = document.createElement('style'); s.id = 'apple-section-reorder-styles';
    s.textContent = `.apple-section-reorder-modal{position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center}.modal-backdrop{position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.4);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}.modal-content{position:relative;width:600px;max-width:90vw;max-height:80vh;background:#1c1c1e;border-radius:var(--apple-modal-radius,20px);overflow-y:auto;overflow-x:hidden;box-shadow:0 20px 40px rgba(0,0,0,.5);transform:scale(.9);opacity:0;transition:all .3s cubic-bezier(.25,.46,.45,.94)}.apple-section-reorder-modal.show .modal-content{transform:scale(1);opacity:1}.modal-header{background:transparent;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;position:sticky;top:0;z-index:10}.modal-header::before{content:'';position:absolute;top:0;left:0;right:0;bottom:-30px;background:linear-gradient(to bottom,#1c1c1e 0%,rgba(28,28,30,.95) 30%,rgba(28,28,30,.7) 60%,rgba(28,28,30,0) 100%);z-index:-1;pointer-events:none}.modal-header h2{margin:0;font-size:17px;font-weight:600;color:#fff;text-align:center;flex:1;position:relative;z-index:2}.modal-body{padding:0 0 20px}.sections-list{padding:0;border-radius:var(--apple-input-radius,10px)!important;overflow:hidden;margin:15px}.section-item{display:flex;align-items:center;padding:6px 12px;border-bottom:.5px solid rgba(84,84,88,.8);background:rgb(39 39 39 / 80%);user-select:none;-webkit-user-select:none;transition:background .2s ease}.section-item:last-child{border-bottom:none}.section-item.dragging{background:#2c2c2e;transform:scale(1.02);box-shadow:0 4px 12px rgba(0,0,0,.3);z-index:1000}.section-drag-handle{color:#858585;cursor:grab;padding:8px;margin:-8px;touch-action:none}.section-drag-handle:active{cursor:grabbing}.section-info{flex:1;min-width:0}.section-name{color:#fff;font-size:14px;font-weight:500;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.section-visibility-toggle{background:none;border:none;color:#fff;cursor:pointer;border-radius:16px;margin-right:12px;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;touch-action:manipulation}.section-visibility-toggle.hidden{color:#ffffff80}.section-item.hidden{opacity:.6}.apple-section-reorder-modal.rtl .section-visibility-toggle{margin-right:0;margin-left:12px}.sortable-ghost{opacity:0!important}.apple-section-reorder-modal .section-item.sortable-chosen{background:#323234!important}.apple-section-reorder-modal .section-item.sortable-drag{opacity:1!important;visibility:visible!important;display:flex!important;background:#3a3a3c!important;transform:scale(1.02)!important;box-shadow:0 8px 24px rgba(0,0,0,.4)!important;z-index:10000!important;border-radius:10px!important}@media (max-width:480px){.apple-section-reorder-modal{align-items:flex-end}.modal-content{width:100vw;height:calc(100dvh - env(safe-area-inset-top) - 20px);max-width:100vw;max-height:calc(100dvh - env(safe-area-inset-top) - 20px);border-radius:var(--apple-modal-radius,20px) var(--apple-modal-radius,20px) 0 0;transform:translateY(100%);opacity:1;margin:0}.apple-section-reorder-modal.show .modal-content{transform:translateY(0)}.section-item{padding:16px 20px}}.modal-done .save-spinner{display:none;width:18px;height:18px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite}.apple-section-reorder-modal.saving .modal-done ha-icon{display:none}.apple-section-reorder-modal.saving .modal-done .save-spinner{display:block}@keyframes spin{to{transform:rotate(360deg)}}`;
    document.head.appendChild(s);
  }

  private setupEventListeners() {
    if (!this.modal) return;
    this.modal.querySelector('.modal-cancel')?.addEventListener('click', () => this.closeModal());
    this.modal.querySelector('.modal-done')?.addEventListener('click', () => this.saveAndClose());
    this.modal.querySelector('.modal-backdrop')?.addEventListener('click', () => this.closeModal());
    const list = this.modal.querySelector('.sections-list');
    list?.addEventListener('click', (e) => { const t = (e.target as HTMLElement).closest('.section-visibility-toggle'); if (t) { e.preventDefault(); e.stopPropagation(); this.toggleSectionVisibility(t as HTMLElement); } }, { capture: true });
    list?.addEventListener('touchstart', (e) => { const t = (e.target as HTMLElement).closest('.section-visibility-toggle'); if (t) { e.preventDefault(); e.stopPropagation(); this.toggleSectionVisibility(t as HTMLElement); } }, { capture: true });
    this.setupSortable(); document.addEventListener('keydown', this.handleEscapeKey);
  }

  private setupSortable() {
    const list = this.modal?.querySelector('.sections-list'); if (!list) return; if (this.sortableInstance) this.sortableInstance.destroy();
    this.sortableInstance = new Sortable(list as HTMLElement, { scroll: true, scrollSensitivity: 100, scrollSpeed: 3, bubbleScroll: false, forceAutoScrollFallback: true, forceFallback: true, fallbackOnBody: true, swapThreshold: 1, animation: 150, easing: "cubic-bezier(1, 0, 0, 1)", delay: 150, delayOnTouchOnly: true, draggable: '.section-item', handle: '.section-drag-handle', filter: '.section-visibility-toggle', preventOnFilter: false, ghostClass: 'sortable-ghost', dragClass: 'sortable-drag', chosenClass: 'sortable-chosen', fallbackClass: 'sortable-fallback', onStart: () => { document.body.style.userSelect = 'none'; }, onEnd: (evt: any) => { document.body.style.userSelect = ''; this.handleItemMoved(evt); } });
  }

  private handleItemMoved(evt: any) { const { oldIndex, newIndex } = evt; if (oldIndex === newIndex) return; const moved = this.sections.splice(oldIndex, 1)[0]; this.sections.splice(newIndex, 0, moved); this.sections.forEach((s, i) => s.order = i); }

  private toggleSectionVisibility(btn: HTMLElement) {
    const id = btn.dataset.sectionId, s = this.sections.find(x => x.id === id); if (!s) return;
    btn.style.transform = 'scale(0.85)'; btn.style.background = 'rgba(255, 255, 255, 0.2)'; s.visible = !s.visible;
    setTimeout(() => { btn.classList.toggle('visible', s.visible); btn.classList.toggle('hidden', !s.visible); const i = btn.querySelector('ha-icon'); if (i) i.setAttribute('icon', s.visible ? 'mdi:eye' : 'mdi:eye-off'); const item = btn.closest('.section-item'); if (item) item.classList.toggle('hidden', !s.visible); btn.style.transform = ''; btn.style.background = ''; }, 100);
  }

  private showModal() { if (!this.modal) return; document.body.style.overflow = 'hidden'; requestAnimationFrame(() => this.modal?.classList.add('show')); }
  private closeModal() { if (!this.modal) return; document.body.style.overflow = ''; this.sortableInstance?.destroy(); this.sortableInstance = undefined; this.modal.classList.remove('show'); setTimeout(() => { document.removeEventListener('keydown', this.handleEscapeKey); if (this.modal?.parentNode) this.modal.parentNode.removeChild(this.modal); this.modal = undefined; }, 300); }

  private async saveAndClose() {
    if (this.modal) this.modal.classList.add('saving'); this.sortableInstance?.destroy(); this.sortableInstance = undefined;
    const h = this.customizationManager.getCustomization('home') || {}; h.sections = { order: this.sections.map(s => s.id), hidden: this.sections.filter(s => !s.visible).map(s => s.id) };
    await this.customizationManager.setCustomization('home', h); if (this.onSaveCallback) this.onSaveCallback(); this.closeModal();
  }

  private handleEscapeKey = (e: KeyboardEvent) => { if (e.key === 'Escape') this.closeModal(); };
  public destroy() { this.closeModal(); document.querySelector('#apple-section-reorder-styles')?.remove(); }
}
