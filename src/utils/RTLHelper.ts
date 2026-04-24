const RTL_LANGS = ['ar', 'he', 'fa', 'ur', 'yi', 'ku', 'dv'];
export type RTLChangeCallback = (isRTL: boolean, language: string) => void;

export class RTLHelper {
  private static _isRTL: boolean | null = null;
  private static _lang: string | null = null;
  private static _listeners: Set<RTLChangeCallback> = new Set();
  private static _lastHass: any = null;

  static addListener(cb: RTLChangeCallback): void { this._listeners.add(cb); }
  static removeListener(cb: RTLChangeCallback): void { this._listeners.delete(cb); }

  private static notify(): void {
    const r = this._isRTL || false, l = this._lang || 'en';
    this._listeners.forEach(cb => { try { cb(r, l); } catch {} });
  }

  static initialize(hass?: any): boolean {
    const pR = this._isRTL, pL = this._lang;
    let l = 'en', r = false; this._lastHass = hass;
    if (hass?.localize?.translationMetadata?.translations) {
      const cur = hass.locale?.language || hass.language || 'en';
      const d = hass.localize.translationMetadata.translations[cur];
      if (d?.isRTL !== undefined) { r = d.isRTL; l = cur; }
    }
    if (!r && hass) { l = hass.locale?.language || hass.language || navigator.language.split('-')[0] || 'en'; r = RTL_LANGS.includes(l); }
    if (!hass) { l = navigator.language.split('-')[0] || 'en'; r = RTL_LANGS.includes(l); }
    this._isRTL = r; this._lang = l; this.update();
    const dC = pR !== null && pR !== r, lC = pL !== null && pL !== l;
    if (dC || lC) this.notify();
    return dC;
  }

  static checkForChanges(hass?: any): boolean {
    const h = hass || this._lastHass; if (!h) return false;
    const pR = this._isRTL, pL = this._lang; this.initialize(h);
    return pR !== this._isRTL || pL !== this._lang;
  }

  static isRTL(): boolean { if (this._isRTL === null) this.initialize(); return this._isRTL || false; }
  static getCurrentLanguage(): string { if (this._lang === null) this.initialize(); return this._lang || 'en'; }

  static update(): void {
    const r = this.isRTL();
    document.documentElement.setAttribute('dir', r ? 'rtl' : 'ltr'); document.body.setAttribute('dir', r ? 'rtl' : 'ltr');
    document.documentElement.classList.toggle('rtl', r); document.documentElement.classList.toggle('ltr', !r);
  }

  static getBackIcon(): string { return this.isRTL() ? 'mdi:chevron-right' : 'mdi:chevron-left'; }
  static getForwardIcon(): string { return this.isRTL() ? 'mdi:chevron-left' : 'mdi:chevron-right'; }
  static getDropdownAlignment(): 'left' | 'right' { return this.isRTL() ? 'left' : 'right'; }

  static getLogicalProperty(p: string): string {
    if (!this.isRTL()) return p;
    const m: Record<string, string> = { 'left': 'right', 'right': 'left', 'margin-left': 'margin-right', 'margin-right': 'margin-left', 'padding-left': 'padding-right', 'padding-right': 'padding-left', 'border-left': 'border-right', 'border-right': 'border-left', 'text-align: left': 'text-align: right', 'text-align: right': 'text-align: left', 'float: left': 'float: right', 'float: right': 'float: left' };
    return m[p] || p;
  }

  static applyRTLStyles(el: HTMLElement, s: Record<string, string>): void { Object.entries(s).forEach(([p, v]) => (el.style as any)[this.getLogicalProperty(p)] = v); }
  static getDirectionalTransform(x: number, y: number = 0): string { return `translate(${this.isRTL() ? -x : x}px, ${y}px)`; }
}
