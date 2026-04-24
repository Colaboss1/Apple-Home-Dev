import { CustomizationManager } from './CustomizationManager';
import { DashboardConfig } from '../config/DashboardConfig';

export class CardManager {
  private customizationManager: CustomizationManager;

  constructor(cm: CustomizationManager) { this.customizationManager = cm; }

  shouldCardBeTall(eid: string, aid: string, ctx: string = 'home'): boolean {
    let t: string[] = [];
    if (ctx === 'home') t = this.customizationManager.getCustomization('home').tall_cards || [];
    else t = this.customizationManager.getCustomization('pages')[aid]?.tall_cards || [];
    if (t.includes(eid)) return true;
    if (t.includes(`!${eid}`)) return false;
    return DashboardConfig.isDefaultTallDomain(eid.split('.')[0]);
  }

  async shouldCardBeTallAsync(eid: string, aid: string, ctx: string = 'home'): Promise<boolean> { await this.customizationManager.ensureCustomizationsLoaded(); return this.shouldCardBeTall(eid, aid, ctx); }

  async toggleTallCard(eid: string, aid: string, ctx: string = 'home'): Promise<boolean> {
    let t: string[] = [];
    if (ctx === 'home') t = this.customizationManager.getCustomization('home').tall_cards || [];
    else { const p = this.customizationManager.getCustomization('pages'); if (!p[aid]) p[aid] = {}; t = p[aid].tall_cards || []; }
    const i = t.indexOf(eid), inv = t.indexOf(`!${eid}`); let res = false;
    if (i !== -1) { t.splice(i, 1); t.push(`!${eid}`); res = false; }
    else if (inv !== -1) { t.splice(inv, 1); t.push(eid); res = true; }
    else { if (DashboardConfig.isDefaultTallDomain(eid.split('.')[0])) { t.push(`!${eid}`); res = false; } else { t.push(eid); res = true; } }
    if (ctx === 'home') { const h = this.customizationManager.getCustomization('home'); h.tall_cards = t; await this.customizationManager.setCustomization('home', h); }
    else { const p = this.customizationManager.getCustomization('pages'); p[aid].tall_cards = t; await this.customizationManager.setCustomization('pages', p); }
    return res;
  }

  async saveCardOrder(aid: string, ord: string[], dom?: string) { await this.saveCardOrderWithContext(aid, ord, 'home', dom); }
  async saveCardOrderWithContext(aid: string, ord: string[], ctx: string = 'home', dom?: string) { await this.customizationManager.saveCardOrderWithContext(aid, ord, ctx, dom); }
  getSavedCardOrder(aid: string, dom?: string): string[] { return this.getSavedCardOrderWithContext(aid, 'home', dom); }
  getSavedCardOrderWithContext(aid: string, ctx: string = 'home', dom?: string): string[] { return this.customizationManager.getSavedCardOrderWithContext(aid, ctx, dom); }

  applySavedCardOrder(cards: any[], ord: string[]): any[] {
    if (!ord || ord.length === 0) return cards;
    const map = new Map(), res: any[] = [], used = new Set<string>();
    cards.forEach(c => { const id = c.entity || c.entityId; if (id) map.set(id, c); });
    ord.forEach(id => { if (map.has(id)) { res.push(map.get(id)); used.add(id); } });
    cards.forEach(c => { const id = c.entity || c.entityId; if (id && !used.has(id)) res.push(c); });
    return res;
  }

  async updateCarouselOrder(aid: string, type: string, ord: string[]) { await this.updateCarouselOrderWithContext(aid, type, ord, 'home'); }

  async updateCarouselOrderWithContext(aid: string, type: string, ord: string[], ctx: string = 'home') {
    const e = this.customizationManager.getCustomization('entities'); if (!e[aid]) e[aid] = {};
    const key = `${type}Order${ctx === 'home' ? '' : `_${ctx}`}`; e[aid][key] = ord;
    await this.customizationManager.setCustomization('entities', e);
  }

  getSavedCarouselOrder(aid: string, type: string): string[] { return this.getSavedCarouselOrderWithContext(aid, type, 'home'); }

  getSavedCarouselOrderWithContext(aid: string, type: string, ctx: string = 'home'): string[] {
    const key = `${type}Order${ctx === 'home' ? '' : `_${ctx}`}`;
    return this.customizationManager.getCustomization('entities')[aid]?.[key] || [];
  }
}
