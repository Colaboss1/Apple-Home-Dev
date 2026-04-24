import Sortable from 'sortablejs';
import { ChipsConfigurationManager } from './ChipsConfigurationManager';

export class DragAndDropManager {
  private saveOrderCallback: (aid: string) => void;
  private customizationManager: any;
  private context: string;
  private sortableInstances: Map<HTMLElement, Sortable> = new Map();
  private static globalStylesInjected: boolean = false;
  public static isReordering: boolean = false;
  private dragVisual: HTMLElement | null = null;

  constructor(cb: (aid: string) => void, cm?: any, ctx: string = 'home') { this.saveOrderCallback = cb; this.customizationManager = cm; this.context = ctx; this.injectGlobalStyles(); }

  private injectGlobalStyles(): void {
    if (DragAndDropManager.globalStylesInjected) return;
    const s = document.createElement('style'); s.id = 'sortable-drag-styles';
    s.textContent = `.drag-visual-clone{position:fixed!important;pointer-events:none!important;z-index:100000!important;opacity:.95!important;box-shadow:0 15px 50px rgba(0,0,0,.5)!important;transform:scale(1.03) rotate(2deg)!important;border-radius:var(--apple-card-radius,25px)!important;transition:transform .1s ease,box-shadow .1s ease!important;overflow:hidden!important}.drag-visual-clone.chip{border-radius:var(--apple-chip-radius,50px)!important}.sortable-ghost{opacity:.3!important;background:rgba(255,255,255,.1)!important;border-radius:var(--apple-card-radius,25px)!important}.sortable-ghost .entity-controls,.sortable-drag .entity-controls,.sortable-chosen .entity-controls,.dragging .entity-controls{display:none!important;visibility:hidden!important;opacity:0!important}.sortable-drag{opacity:0!important;visibility:hidden!important}.chip-wrapper.sortable-ghost{opacity:.3!important;background:rgba(255,255,255,.1)!important;border-radius:var(--apple-chip-radius,50px)!important}.chip-wrapper.sortable-ghost .chip{opacity:.3!important}.entity-card-wrapper img,.entity-card-wrapper .camera-container,.entity-card-wrapper .camera-snapshot{pointer-events:none}`;
    document.head.appendChild(s); DragAndDropManager.globalStylesInjected = true;
  }

  private createDragVisual(el: HTMLElement, x: number, y: number, isChip: boolean = false): void {
    this.removeDragVisual(); const r = el.getBoundingClientRect(); this.dragVisual = document.createElement('div'); this.dragVisual.className = 'drag-visual-clone' + (isChip ? ' chip' : ''); this.dragVisual.style.width = r.width + 'px'; this.dragVisual.style.height = r.height + 'px'; this.dragVisual.style.left = (x - r.width / 2) + 'px'; this.dragVisual.style.top = (y - r.height / 2) + 'px';
    const card = el.querySelector('apple-home-card');
    if (card?.shadowRoot) {
      const inner = card.shadowRoot.querySelector('.apple-home-card') as HTMLElement;
      if (inner) {
        const s = window.getComputedStyle(inner); this.dragVisual.style.background = s.background; this.dragVisual.style.backdropFilter = s.backdropFilter; (this.dragVisual.style as any).webkitBackdropFilter = (s as any).webkitBackdropFilter; this.dragVisual.style.borderRadius = s.borderRadius;
        const cam = inner.querySelector('.camera-container') as HTMLElement, un = inner.querySelector('.camera-icon-unavailable') as HTMLElement, no = inner.querySelector('.camera-icon-no-snapshot') as HTMLElement;
        if (cam || un || no) this.createCameraDragVisual(inner, cam, un, no);
        else { const c = this.cloneWithStyles(inner); c.style.width = '100%'; c.style.height = '100%'; this.dragVisual.appendChild(c); }
      }
    } else if (isChip) {
      const chip = el.querySelector('.chip') as HTMLElement;
      if (chip) { const s = window.getComputedStyle(chip); this.dragVisual.style.background = s.background || s.backgroundColor; this.dragVisual.style.backdropFilter = s.backdropFilter || 'blur(20px)'; (this.dragVisual.style as any).webkitBackdropFilter = (s as any).webkitBackdropFilter || 'blur(20px)'; this.dragVisual.style.borderRadius = s.borderRadius || '20px'; const c = this.cloneWithStyles(chip); c.style.width = '100%'; c.style.height = '100%'; c.style.margin = '0'; this.dragVisual.appendChild(c); }
      else { const c = this.cloneWithStyles(el); c.style.width = '100%'; c.style.height = '100%'; this.dragVisual.appendChild(c); }
    } else this.dragVisual.style.background = 'rgba(128,128,128,0.5)';
    document.body.appendChild(this.dragVisual);
  }

  private createCameraDragVisual(inner: HTMLElement, cam: HTMLElement | null, un: HTMLElement | null, no: HTMLElement | null): void {
    const s = window.getComputedStyle(inner), cnt = document.createElement('div'); cnt.style.cssText = `width:100%;height:100%;display:flex;flex-direction:column;position:relative;overflow:hidden;border-radius:${s.borderRadius};`;
    if (cam) {
      const imgs = Array.from(cam.querySelectorAll('img')) as HTMLImageElement[]; let src: string | null = null;
      for (const i of imgs) if (window.getComputedStyle(i).opacity !== '0' && i.src) { src = i.src; break; }
      if (src) { const c = document.createElement('img'); c.src = src; c.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;`; cnt.appendChild(c); }
      else cnt.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);"><ha-icon icon="mdi:camera" style="color:white;--mdc-icon-size:48px;"></ha-icon></div>`;
    } else if (un) cnt.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><ha-icon icon="mdi:camera-off" style="color:rgba(255,255,255,0.6);--mdc-icon-size:48px;"></ha-icon></div>`;
    else if (no) cnt.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><ha-icon icon="mdi:camera" style="color:rgba(255,255,255,0.6);--mdc-icon-size:48px;"></ha-icon></div>`;
    const name = inner.querySelector('.entity-name');
    if (name) { const c = document.createElement('div'), ns = window.getComputedStyle(name); c.textContent = name.textContent; c.style.cssText = `position:absolute;bottom:12px;left:12px;right:12px;color:white;font-size:${ns.fontSize};font-weight:${ns.fontWeight};text-shadow:0 1px 3px rgba(0,0,0,0.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`; cnt.appendChild(c); }
    this.dragVisual!.appendChild(cnt);
  }

  private cloneWithStyles(el: HTMLElement): HTMLElement {
    const c = el.cloneNode(false) as HTMLElement, s = window.getComputedStyle(el);
    ['display', 'flexDirection', 'alignItems', 'justifyContent', 'gap', 'padding', 'margin', 'width', 'height', 'minWidth', 'minHeight', 'color', 'fontSize', 'fontWeight', 'fontFamily', 'textAlign', 'background', 'backgroundColor', 'borderRadius', 'overflow', 'whiteSpace', 'textOverflow'].forEach(p => (c.style as any)[p] = (s as any)[p]);
    el.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) c.appendChild(child.cloneNode(true));
      else if (child.nodeType === Node.ELEMENT_NODE) {
        const cel = child as HTMLElement;
        if (cel.tagName === 'HA-ICON') { const h = cel as any, i = h.icon || h.getAttribute('icon'), is = window.getComputedStyle(cel), ic = document.createElement('ha-icon'); ic.setAttribute('icon', i || 'mdi:help'); ic.style.color = is.color; (ic.style as any)['--mdc-icon-size'] = is.getPropertyValue('--mdc-icon-size') || '24px'; c.appendChild(ic); }
        else if (cel.tagName === 'IMG') { const i = cel as HTMLImageElement, ic = document.createElement('img'); ic.src = i.src; ic.style.cssText = `width:100%;height:100%;object-fit:cover;pointer-events:none;`; c.appendChild(ic); }
        else if (cel.classList.contains('camera-container')) {
          const v = cel.querySelector('img[style*="opacity: 1"], img:not([style*="opacity: 0"])') as HTMLImageElement;
          if (v?.src) { const cc = document.createElement('div'); cc.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;overflow:hidden;`; const ic = document.createElement('img'); ic.src = v.src; ic.style.cssText = `width:100%;height:100%;object-fit:cover;`; cc.appendChild(ic); c.appendChild(cc); }
          else { const p = document.createElement('div'); p.style.cssText = `width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);`; p.innerHTML = '<ha-icon icon="mdi:camera" style="color:white;--mdc-icon-size:32px;"></ha-icon>'; c.appendChild(p); }
        } else c.appendChild(this.cloneWithStyles(cel));
      }
    }); return c;
  }

  private updateDragVisual(x: number, y: number): void { if (!this.dragVisual) return; this.dragVisual.style.left = (x - this.dragVisual.offsetWidth / 2) + 'px'; this.dragVisual.style.top = (y - this.dragVisual.offsetHeight / 2) + 'px'; }
  private removeDragVisual(): void { if (this.dragVisual?.parentNode) this.dragVisual.parentNode.removeChild(this.dragVisual); this.dragVisual = null; }

  private getBaseSortableOptions(): Sortable.Options { return { animation: 150, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', delay: 150, delayOnTouchOnly: true, touchStartThreshold: 5, scroll: true, scrollSensitivity: 100, scrollSpeed: 15, bubbleScroll: true, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen', dragClass: 'sortable-drag', forceFallback: true, fallbackClass: 'sortable-fallback-hidden', fallbackOnBody: false, fallbackTolerance: 3, swapThreshold: 0.65, filter: '.entity-controls, .entity-control-btn', preventOnFilter: false, onFilter: () => {}, onMove: () => true }; }

  enableDragAndDrop(c: HTMLElement): void {
    c.querySelectorAll('.area-entities, .room-group-grid').forEach(g => this.setupGridSortable(g as HTMLElement));
    c.querySelectorAll('.carousel-grid:not(.chips)').forEach(cg => this.setupCarouselSortable(cg as HTMLElement));
    if (c.classList.contains('permanent-chips')) this.enableChipsCarousel(c);
  }

  private setupGridSortable(g: HTMLElement): void {
    const ex = this.sortableInstances.get(g); if (ex) ex.destroy();
    const aid = g.dataset.areaId; let lX = 0, lY = 0;
    const mv = (e: MouseEvent | TouchEvent) => { if (e instanceof TouchEvent) { lX = e.touches[0].clientX; lY = e.touches[0].clientY; } else { lX = e.clientX; lY = e.clientY; } this.updateDragVisual(lX, lY); };
    const s = new Sortable(g, { ...this.getBaseSortableOptions(), draggable: '.entity-card-wrapper', onStart: (evt) => { DragAndDropManager.isReordering = true; evt.item.classList.add('dragging'); g.querySelectorAll('.entity-controls').forEach(ctrl => (ctrl as HTMLElement).style.visibility = 'hidden'); const o = (evt as any).originalEvent, t = o?.touches?.[0]; lX = t?.clientX ?? o?.clientX ?? 0; lY = t?.clientY ?? o?.clientY ?? 0; this.createDragVisual(evt.item, lX, lY); document.addEventListener('mousemove', mv); document.addEventListener('touchmove', mv, { passive: true }); if ('vibrate' in navigator) navigator.vibrate(50); document.body.style.userSelect = 'none'; }, onEnd: (evt) => { DragAndDropManager.isReordering = false; evt.item.classList.remove('dragging'); g.querySelectorAll('.entity-controls').forEach(ctrl => (ctrl as HTMLElement).style.visibility = ''); this.removeDragVisual(); document.removeEventListener('mousemove', mv); document.removeEventListener('touchmove', mv); document.body.style.userSelect = ''; if ('vibrate' in navigator) navigator.vibrate(30); this.reconnectSingleCameraManager(evt.item); if (aid) this.saveOrderCallback(aid); } });
    this.sortableInstances.set(g, s);
  }

  private setupCarouselSortable(cg: HTMLElement): void {
    const ex = this.sortableInstances.get(cg); if (ex) ex.destroy();
    const sc = cg.closest('.carousel-container') as HTMLElement; let lX = 0, lY = 0, spd = 0, ani: number | null = null;
    const anim = () => { if (!sc || spd === 0) { ani = null; return; } const max = sc.scrollWidth - sc.clientWidth, cur = sc.scrollLeft; if ((spd < 0 && cur <= 0) || (spd > 0 && cur >= max)) { spd = 0; ani = null; return; } sc.scrollLeft += spd; ani = requestAnimationFrame(anim); };
    const updSpd = (x: number) => { if (!sc) return; const r = sc.getBoundingClientRect(), max = sc.scrollWidth - sc.clientWidth, cur = sc.scrollLeft, z = 100, mS = 15, miS = 3, dL = x - r.left, dR = r.right - x, cL = cur > 0, cR = cur < max; let nS = 0; if (dL < z && dL >= 0 && cL) nS = -(miS + (1 - dL / z) * (mS - miS)); else if (dR < z && dR >= 0 && cR) nS = miS + (1 - dR / z) * (mS - miS); if (Math.abs(nS - spd) > 0.5 || (nS === 0 && spd !== 0)) { spd = nS; if (spd !== 0 && ani === null) ani = requestAnimationFrame(anim); } };
    const stp = () => { spd = 0; if (ani) { cancelAnimationFrame(ani); ani = null; } };
    const mv = (e: MouseEvent | TouchEvent) => { if (e instanceof TouchEvent) { lX = e.touches[0].clientX; lY = e.touches[0].clientY; } else { lX = e.clientX; lY = e.clientY; } this.updateDragVisual(lX, lY); updSpd(lX); };
    const s = new Sortable(cg, { ...this.getBaseSortableOptions(), draggable: '.entity-card-wrapper', direction: 'horizontal', scroll: false, onStart: (evt) => { DragAndDropManager.isReordering = true; evt.item.classList.add('dragging'); cg.querySelectorAll('.entity-controls').forEach(ctrl => (ctrl as HTMLElement).style.visibility = 'hidden'); const o = (evt as any).originalEvent, t = o?.touches?.[0]; lX = t?.clientX ?? o?.clientX ?? 0; lY = t?.clientY ?? o?.clientY ?? 0; this.createDragVisual(evt.item, lX, lY); document.addEventListener('mousemove', mv); document.addEventListener('touchmove', mv, { passive: true }); if ('vibrate' in navigator) navigator.vibrate(50); document.body.style.userSelect = 'none'; }, onEnd: (evt) => { DragAndDropManager.isReordering = false; evt.item.classList.remove('dragging'); stp(); cg.querySelectorAll('.entity-controls').forEach(ctrl => (ctrl as HTMLElement).style.visibility = ''); this.removeDragVisual(); document.removeEventListener('mousemove', mv); document.removeEventListener('touchmove', mv); document.body.style.userSelect = ''; if ('vibrate' in navigator) navigator.vibrate(30); this.reconnectSingleCameraManager(evt.item); const c = evt.item.closest('.carousel-grid') as HTMLElement; if (c) this.updateCarouselConfiguration(c); } });
    this.sortableInstances.set(cg, s);
  }

  enableChipsCarousel(c: HTMLElement): void {
    const cg = c.querySelector('.chips-grid') as HTMLElement; if (!cg) return;
    const ex = this.sortableInstances.get(cg); if (ex) ex.destroy();
    const sc = cg.closest('.carousel-container, .chips-carousel-container') as HTMLElement; let lX = 0, lY = 0, spd = 0, ani: number | null = null;
    const sm = () => { if (sc && spd !== 0) { const max = sc.scrollWidth - sc.clientWidth, cur = sc.scrollLeft; if ((spd < 0 && cur <= 0) || (spd > 0 && cur >= max)) { spd = 0; ani = null; return; } sc.scrollLeft += spd; ani = requestAnimationFrame(sm); } else ani = null; };
    const upd = (x: number) => { if (!sc) return; const r = sc.getBoundingClientRect(), max = sc.scrollWidth - sc.clientWidth, cur = sc.scrollLeft, z = 80, mS = 12, miS = 2, dL = x - r.left, dR = r.right - x, cL = cur > 0, cR = cur < max; spd = (dL < z && dL >= 0 && cL) ? -(miS + (1 - dL / z) * (mS - miS)) : ((dR < z && dR >= 0 && cR) ? (miS + (1 - dR / z) * (mS - miS)) : 0); if (spd !== 0 && !ani) ani = requestAnimationFrame(sm); };
    const stp = () => { spd = 0; if (ani) { cancelAnimationFrame(ani); ani = null; } };
    const mv = (e: MouseEvent | TouchEvent) => { if (e instanceof TouchEvent) { lX = e.touches[0].clientX; lY = e.touches[0].clientY; } else { lX = e.clientX; lY = e.clientY; } this.updateDragVisual(lX, lY); upd(lX); };
    const s = new Sortable(cg, { ...this.getBaseSortableOptions(), draggable: '.chip-wrapper', direction: 'horizontal', scroll: false, onStart: (evt) => { DragAndDropManager.isReordering = true; evt.item.classList.add('dragging'); const o = (evt as any).originalEvent, t = o?.touches?.[0]; lX = t?.clientX ?? o?.clientX ?? 0; lY = t?.clientY ?? o?.clientY ?? 0; this.createDragVisual(evt.item, lX, lY, true); document.addEventListener('mousemove', mv); document.addEventListener('touchmove', mv, { passive: true }); if ('vibrate' in navigator) navigator.vibrate(50); document.body.style.userSelect = 'none'; }, onEnd: (evt) => { DragAndDropManager.isReordering = false; evt.item.classList.remove('dragging'); stp(); this.removeDragVisual(); document.removeEventListener('mousemove', mv); document.removeEventListener('touchmove', mv); document.body.style.userSelect = ''; if ('vibrate' in navigator) navigator.vibrate(30); const c = evt.item.closest('.chips-grid') as HTMLElement; if (c) this.updateChipsConfiguration(c); } });
    this.sortableInstances.set(cg, s);
  }

  private updateCarouselConfiguration(cg: HTMLElement): void {
    const aid = cg.dataset.areaId; if (!aid) return; const ids = Array.from(cg.querySelectorAll('.entity-card-wrapper')).map(w => (w as HTMLElement).dataset.entityId).filter(id => !!id) as string[], p = this.customizationManager.getCustomization('pages') || {};
    if (!p[aid]) p[aid] = {}; p[aid].entities_order = ids; this.customizationManager.setCustomization('pages', p); if (this.saveOrderCallback) this.saveOrderCallback(aid);
  }

  private updateChipsConfiguration(cg: HTMLElement): void { const ids = Array.from(cg.querySelectorAll('.chip-wrapper')).map(w => (w as HTMLElement).dataset.chipId).filter(id => !!id) as string[]; ChipsConfigurationManager.getInstance(this.customizationManager).saveChipsOrder(ids).then(() => { if (this.saveOrderCallback) this.saveOrderCallback('chips'); }); }
  private reconnectSingleCameraManager(el: HTMLElement): void { const c = el.querySelector('apple-home-card') as any; if (c?.reconnectCameraManager) c.reconnectCameraManager(); }
  destroy(): void { this.sortableInstances.forEach(i => i.destroy()); this.sortableInstances.clear(); this.removeDragVisual(); DragAndDropManager.isReordering = false; }
}
