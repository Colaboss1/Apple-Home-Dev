import { CustomizationManager } from '../utils/CustomizationManager';
import { localize } from '../utils/LocalizationService';

interface EnergyPrefs { energy_sources?: Array<{ type: string; stat_energy_from?: string; stat_energy_to?: string; stat_compensation?: string; entity_energy_from?: string; entity_energy_to?: string; flow_from?: Array<{ stat_energy_from: string; stat_cost?: string }>; flow_to?: Array<{ stat_energy_to: string; stat_compensation?: string }>; stat_energy_price?: string; config_entry_solar_forecast?: string[]; }>; device_consumption?: Array<{ stat_consumption: string }>; }
interface BarData { label: string; value: number; }
interface EnergyData { currentPower: number | null; todayTotal: number | null; hourlyData: BarData[]; solarPower: number | null; solarToday: number | null; batteryPercent: number | null; gridReturn: number | null; hasSolar: boolean; hasBattery: boolean; gridEntityId: string | null; }
interface FullEnergyData { currentPower: number | null; periodTotal: number | null; previousPeriodTotal: number | null; barData: BarData[]; solarPower: number | null; solarPeriodTotal: number | null; solarBarData: BarData[]; batteryPercent: number | null; batteryCharged: number | null; batteryDischarged: number | null; gridReturn: number | null; selfSufficiency: number | null; hasSolar: boolean; hasBattery: boolean; hasGridReturn: boolean; devices: DeviceConsumption[]; costTotal: number | null; }
interface DeviceConsumption { entityId: string; name: string; consumption: number; percentage: number; }
type Period = 'day' | 'week' | 'month';

export class EnergySection {
  private customizationManager: CustomizationManager;
  private prefsCache: { data: EnergyPrefs; timestamp: number } | null = null;
  private periodStatsCache: Map<string, { data: any; timestamp: number }> = new Map();
  private static readonly CACHE_TTL = 300000;
  private static cachedGridEntityIds: string[] | null = null;
  private selectedPeriod: Period = 'day';
  private currentContainer: HTMLElement | null = null;
  private currentHass: any = null;

  constructor(cm: CustomizationManager) { this.customizationManager = cm; }

  async render(container: HTMLElement, hass: any, context: 'home' | 'group' = 'home'): Promise<void> {
    this.currentContainer = container; this.currentHass = hass;
    if (context === 'group') await this.renderFullPage(container, hass); else await this.renderHomeCard(container, hass);
  }

  private async renderHomeCard(container: HTMLElement, hass: any): Promise<void> {
    const data = await this.fetchEnergyData(hass); if (!data || (data.currentPower === null && data.todayTotal === null && data.hourlyData.length === 0)) return;
    this.injectStyles(container);
    const card = document.createElement('div'); card.className = 'apple-energy-card'; card.addEventListener('click', () => { window.history.pushState(null, '', '/energy'); window.dispatchEvent(new Event('location-changed', { bubbles: true, composed: true })); });
    card.innerHTML = `<div class="energy-header"><div class="energy-header-left"><ha-icon icon="mdi:flash" class="energy-icon"></ha-icon><span class="energy-label">${localize('energy.current_usage')}</span></div><div class="energy-header-right">${localize('energy.today')}</div></div><div class="energy-values"><div class="energy-current-power">${data.currentPower !== null ? this.formatPower(data.currentPower) : '--'}</div><div class="energy-today-total">${data.todayTotal !== null ? this.formatEnergy(data.todayTotal) : '--'}</div></div>`;
    if (data.hourlyData.length > 0) card.appendChild(this.renderBarChart(data.hourlyData, 'day'));
    if (data.hasSolar || data.hasBattery) {
      const extra = document.createElement('div'); extra.className = 'energy-extra-row';
      if (data.hasSolar) extra.innerHTML += `<div class="energy-extra-item"><div class="energy-extra-main"><ha-icon icon="mdi:solar-power" class="energy-extra-icon solar"></ha-icon><span>${localize('energy.solar')} ${data.solarPower !== null ? this.formatPower(data.solarPower) : '--'}</span></div></div>`;
      if (data.hasBattery) extra.innerHTML += `<div class="energy-extra-item"><div class="energy-extra-main"><ha-icon icon="mdi:battery" class="energy-extra-icon battery"></ha-icon><span>${localize('energy.battery')} ${data.batteryPercent !== null ? `${Math.round(data.batteryPercent)}%` : '--'}</span></div></div>`;
      card.appendChild(extra);
    }
    container.appendChild(card);
  }

  private async renderFullPage(container: HTMLElement, hass: any): Promise<void> {
    this.injectStyles(container); const wrapper = document.createElement('div'); wrapper.className = 'energy-full-page';
    const prefs = await this.getEnergyPrefs(hass); const cur = this.findCurrentPower(hass, prefs?.energy_sources?.find((s: any) => s.type === 'grid')?.flow_from?.map((f: any) => f.stat_energy_from) || []);
    wrapper.innerHTML = `<div class="energy-page-current"><div class="energy-page-current-left"><ha-icon icon="mdi:flash" class="energy-page-icon"></ha-icon><span class="energy-page-current-label">${localize('energy.current_usage')}</span></div><div class="energy-page-current-value">${cur !== null ? this.formatPower(cur) : '--'}</div></div>`;
    this.renderPeriodSelector(wrapper); const dynamic = document.createElement('div'); dynamic.className = 'energy-dynamic-area'; wrapper.appendChild(dynamic);
    container.appendChild(wrapper); await this.updateDynamicContent(dynamic, hass);
  }

  private renderPeriodSelector(parent: HTMLElement): void {
    const s = document.createElement('div'); s.className = 'energy-period-selector';
    (['day', 'week', 'month'] as Period[]).forEach(p => {
      const b = document.createElement('button'); b.className = `energy-period-btn${p === this.selectedPeriod ? ' active' : ''}`; b.textContent = localize(`energy.${p}`);
      b.addEventListener('click', () => { if (p === this.selectedPeriod) return; this.selectedPeriod = p; s.querySelectorAll('.energy-period-btn').forEach(x => x.classList.remove('active')); b.classList.add('active'); this.handlePeriodChange(); });
      s.appendChild(b);
    });
    parent.appendChild(s);
  }

  private async handlePeriodChange(): Promise<void> {
    if (!this.currentContainer || !this.currentHass) return; const dyn = this.currentContainer.querySelector('.energy-dynamic-area') as HTMLElement; if (!dyn) return;
    dyn.style.opacity = '0'; await new Promise(r => setTimeout(r, 200)); await this.updateDynamicContent(dyn, this.currentHass); requestAnimationFrame(() => dyn.style.opacity = '1');
  }

  private async updateDynamicContent(dyn: HTMLElement, hass: any): Promise<void> {
    dyn.innerHTML = ''; const data = await this.fetchFullEnergyData(hass, this.selectedPeriod); if (!data) { dyn.innerHTML = `<div class="energy-no-data">${localize('energy.no_data')}</div>`; return; }
    this.renderSummaryStats(dyn, data); if (data.barData.length > 0) this.renderConsumptionChart(dyn, data.barData, this.selectedPeriod);
    if (data.hasSolar || data.hasBattery || data.hasGridReturn) {
      const grid = document.createElement('div'); grid.className = 'energy-flow-grid';
      if (data.hasSolar) this.renderSolarCard(grid, data); if (data.hasBattery) this.renderBatteryCard(grid, data); if (data.hasGridReturn) this.renderGridReturnCard(grid, data);
      if (data.hasSolar && data.selfSufficiency !== null) this.renderSelfSufficiencyCard(grid, data.selfSufficiency);
      dyn.appendChild(grid);
    }
    if (data.devices.length > 0) this.renderDeviceBreakdown(dyn, data.devices);
  }

  private renderSummaryStats(parent: HTMLElement, data: FullEnergyData): void {
    const s = document.createElement('div'); s.className = 'energy-summary-stats';
    s.innerHTML = `<div class="energy-stat"><div class="energy-stat-label">${localize('energy.total_consumption')}</div><div class="energy-stat-value">${data.periodTotal !== null ? this.formatEnergy(data.periodTotal) : '--'}</div></div>`;
    if (data.costTotal !== null) s.innerHTML += `<div class="energy-stat"><div class="energy-stat-label">${localize('energy.cost')}</div><div class="energy-stat-value">${this.formatCost(data.costTotal)}</div></div>`;
    if (data.previousPeriodTotal && data.periodTotal && data.previousPeriodTotal > 0) {
      const d = ((data.periodTotal - data.previousPeriodTotal) / data.previousPeriodTotal) * 100;
      s.innerHTML += `<div class="energy-stat"><div class="energy-stat-label">${localize('energy.vs_previous')}</div><div class="energy-stat-value" style="color:${d <= 0 ? '#4ADE80' : '#FF6B6B'}">${d >= 0 ? '+' : ''}${d.toFixed(0)}%</div></div>`;
    }
    parent.appendChild(s);
  }

  private renderConsumptionChart(parent: HTMLElement, bars: BarData[], p: Period): void { const s = document.createElement('div'); s.className = 'energy-chart-section'; s.appendChild(this.renderBarChart(bars, p)); parent.appendChild(s); }

  private renderSolarCard(parent: HTMLElement, data: FullEnergyData): void {
    const c = document.createElement('div'); c.className = 'energy-flow-card';
    c.innerHTML = `<div class="flow-card-header"><ha-icon icon="mdi:solar-power" class="flow-card-icon solar"></ha-icon><span class="flow-card-title">${localize('energy.solar_production')}</span></div><div class="flow-card-values"><div class="flow-card-primary">${data.solarPower !== null ? this.formatPower(data.solarPower) : '--'}</div><div class="flow-card-secondary">${data.solarPeriodTotal !== null ? this.formatEnergy(data.solarPeriodTotal) : '--'}</div></div>`;
    if (data.solarBarData.length > 0) c.appendChild(this.renderMiniBarChart(data.solarBarData, '#FFD60A'));
    parent.appendChild(c);
  }

  private renderBatteryCard(parent: HTMLElement, data: FullEnergyData): void {
    const c = document.createElement('div'); c.className = 'energy-flow-card'; const pct = data.batteryPercent !== null ? Math.round(data.batteryPercent) : null;
    c.innerHTML = `<div class="flow-card-header"><ha-icon icon="mdi:battery" class="flow-card-icon battery"></ha-icon><span class="flow-card-title">${localize('energy.battery_status')}</span></div><div class="flow-card-values"><div class="flow-card-primary">${pct !== null ? `${pct}%` : '--'}</div></div><div class="battery-bar-container"><div class="battery-bar-fill" style="width:${pct ?? 0}%"></div></div><div class="battery-charge-stats"><span>${localize('energy.charged')}: ${data.batteryCharged !== null ? this.formatEnergy(data.batteryCharged) : '--'}</span><span>${localize('energy.discharged')}: ${data.batteryDischarged !== null ? this.formatEnergy(data.batteryDischarged) : '--'}</span></div>`;
    parent.appendChild(c);
  }

  private renderGridReturnCard(parent: HTMLElement, data: FullEnergyData): void {
    const c = document.createElement('div'); c.className = 'energy-flow-card';
    c.innerHTML = `<div class="flow-card-header"><ha-icon icon="mdi:transmission-tower-export" class="flow-card-icon grid-return"></ha-icon><span class="flow-card-title">${localize('energy.returned_to_grid')}</span></div><div class="flow-card-values"><div class="flow-card-primary">${data.gridReturn !== null ? this.formatEnergy(data.gridReturn) : '--'}</div></div>`;
    parent.appendChild(c);
  }

  private renderSelfSufficiencyCard(parent: HTMLElement, pct: number): void {
    const c = document.createElement('div'); c.className = 'energy-flow-card self-sufficiency'; const r = Math.round(pct); const circ = 2 * Math.PI * 36;
    c.innerHTML = `<div class="flow-card-header"><ha-icon icon="mdi:circle-half-full" class="flow-card-icon sufficiency"></ha-icon><span class="flow-card-title">${localize('energy.self_sufficiency')}</span></div><div class="self-sufficiency-ring"><svg viewBox="0 0 80 80" class="sufficiency-svg"><circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="5"/><circle cx="40" cy="40" r="36" fill="none" stroke="#4ADE80" stroke-width="5" stroke-dasharray="${circ}" stroke-dashoffset="${circ - (circ * r / 100)}" stroke-linecap="round" transform="rotate(-90 40 40)"/></svg><div class="sufficiency-pct">${r}%</div></div>`;
    parent.appendChild(c);
  }

  private renderDeviceBreakdown(parent: HTMLElement, devices: DeviceConsumption[]): void {
    const s = document.createElement('div'); s.className = 'energy-devices-section'; s.innerHTML = `<div class="energy-devices-title">${localize('energy.devices')}</div>`;
    devices.forEach(d => { s.innerHTML += `<div class="energy-device-row"><div class="device-row-info"><span class="device-row-name">${d.name}</span><span class="device-row-value">${this.formatEnergy(d.consumption)}</span></div><div class="device-row-bar-container"><div class="device-row-bar-fill" style="width:${d.percentage}%"></div></div><div class="device-row-pct">${Math.round(d.percentage)}%</div></div>`; });
    parent.appendChild(s);
  }

  private renderBarChart(data: BarData[], p: Period): HTMLElement {
    const c = document.createElement('div'); c.className = 'energy-chart'; const b = document.createElement('div'); b.className = 'energy-bars';
    const max = Math.max(...data.map(x => x.value), 0.001); const cur = new Date().getHours();
    data.forEach((d, i) => { const f = document.createElement('div'); f.className = 'energy-bar'; if (p === 'day') { if (i === cur) f.classList.add('current'); if (i > cur) f.classList.add('future'); } else if (i === data.length - 1) f.classList.add('current'); const fl = document.createElement('div'); fl.className = 'energy-bar-fill'; fl.style.height = `${Math.max((d.value / max) * 100, 2)}%`; f.appendChild(fl); b.appendChild(f); });
    c.appendChild(b); const l = document.createElement('div'); l.className = 'energy-chart-labels';
    if (p === 'day') {
      [{ p: 0, t: '00' }, { p: 6, t: '06' }, { p: 12, t: '12' }, { p: 18, t: '18' }, { p: cur, t: localize('energy.now') }].reduce((acc, x) => { const e = acc.find(a => a.p === x.p); if (e) { if (x.t === localize('energy.now')) e.t = x.t; } else acc.push(x); return acc; }, [] as any[]).forEach(x => { const e = document.createElement('span'); e.className = `energy-chart-label${x.t === localize('energy.now') ? ' now' : ''}`; e.style.left = `${(x.p / 23) * 100}%`; e.textContent = x.t; l.appendChild(e); });
    } else {
      const tot = data.length; (tot <= 7 ? data.map((_, i) => i) : [0, Math.floor(tot / 4), Math.floor(tot / 2), Math.floor(3 * tot / 4), tot - 1]).forEach(i => { const e = document.createElement('span'); e.className = `energy-chart-label${i === tot - 1 ? ' now' : ''}`; e.style.left = `${(i / Math.max(tot - 1, 1)) * 100}%`; e.textContent = data[i]?.label || ''; l.appendChild(e); });
    }
    c.appendChild(l); return c;
  }

  private renderMiniBarChart(data: BarData[], col: string): HTMLElement {
    const c = document.createElement('div'); c.className = 'energy-mini-chart'; const max = Math.max(...data.map(x => x.value), 0.001);
    data.forEach(d => { const b = document.createElement('div'); b.className = 'energy-mini-bar'; b.style.height = `${Math.max((d.value / max) * 100, 2)}%`; b.style.background = col; c.appendChild(b); });
    return c;
  }

  private formatPower(w: number): string { return w >= 1000 ? `${(w / 1000).toFixed(1)} kW` : `${Math.round(w)} W`; }
  private formatEnergy(kwh: number): string { return `${kwh.toFixed(1)} kWh`; }
  private formatCost(c: number): string { return `$${c.toFixed(2)}`; }

  private async fetchEnergyData(hass: any): Promise<EnergyData | null> {
    try {
      const prefs = await this.getEnergyPrefs(hass); if (!prefs?.energy_sources?.length) return null;
      const g = prefs.energy_sources.find((s: any) => s.type === 'grid'); if (!g) return null;
      const gids = g.flow_from?.map((f: any) => f.stat_energy_from) || []; const cur = this.findCurrentPower(hass, gids);
      const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const stats = await this.fetchPeriodStatistics(hass, gids, start, now, 'hour');
      let tot = 0; const hdata: BarData[] = []; for (let h = 0; h < 24; h++) hdata.push({ label: h.toString().padStart(2, '0'), value: 0 });
      if (stats) gids.forEach(id => { stats[id]?.forEach((s: any) => { const hr = new Date(s.start).getHours(); const ch = s.change ?? 0; tot += ch; hdata[hr].value += ch; }); });
      const sol = prefs.energy_sources.find((s: any) => s.type === 'solar'); let solP = null, solT = null; if (sol) { const eid = (sol as any).stat_energy_from; if (eid) { solP = this.findCurrentPower(hass, [eid]); const s = await this.fetchPeriodStatistics(hass, [eid], start, now, 'hour'); if (s?.[eid]) solT = s[eid].reduce((sum: number, x: any) => sum + (x.change ?? 0), 0); } }
      const batt = prefs.energy_sources.find((s: any) => s.type === 'battery'); let bPct = null; if (batt) { const eid = (batt as any).stat_energy_from; if (eid) bPct = this.findBatterySoc(hass, eid); }
      const tids = g.flow_to?.map((f: any) => f.stat_energy_to) || []; let gRet = null; if (tids.length > 0) { const s = await this.fetchPeriodStatistics(hass, tids, start, now, 'hour'); if (s) { gRet = 0; tids.forEach(id => { if (s[id]) gRet! += s[id].reduce((sum: number, x: any) => sum + (x.change ?? 0), 0); }); } }
      return { currentPower: cur, todayTotal: tot > 0 ? tot : null, hourlyData: hdata, solarPower: solP, solarToday: solT, batteryPercent: bPct, gridReturn: gRet, hasSolar: !!sol, hasBattery: !!batt, gridEntityId: gids[0] || null };
    } catch { return null; }
  }

  private async fetchFullEnergyData(hass: any, p: Period): Promise<FullEnergyData | null> {
    try {
      const prefs = await this.getEnergyPrefs(hass); if (!prefs?.energy_sources?.length) return null;
      const g = prefs.energy_sources.find((s: any) => s.type === 'grid'); if (!g) return null;
      const gids = g.flow_from?.map((f: any) => f.stat_energy_from) || [], tids = g.flow_to?.map((f: any) => f.stat_energy_to) || [], cids = g.flow_from?.map((f: any) => f.stat_cost).filter(Boolean) || [];
      const cur = this.findCurrentPower(hass, gids); const { start, end, statPeriod } = this.getStartDateForPeriod(p); const { start: pS, end: pE } = this.getPreviousPeriodDates(p);
      const lang = hass.locale?.language || hass.language || 'en'; const all = [...gids];
      const sol = prefs.energy_sources.find((s: any) => s.type === 'solar') as any, eid_sol = sol?.stat_energy_from; if (eid_sol) all.push(eid_sol);
      const bat = prefs.energy_sources.find((s: any) => s.type === 'battery') as any, eid_bf = bat?.stat_energy_from, eid_bt = bat?.stat_energy_to; if (eid_bf) all.push(eid_bf); if (eid_bt) all.push(eid_bt);
      all.push(...tids); all.push(...cids);
      const [cStats, pStats, dData] = await Promise.all([this.fetchPeriodStatistics(hass, all, start, end, statPeriod), this.fetchPeriodStatistics(hass, gids, pS, pE, statPeriod), this.fetchDeviceConsumption(hass, prefs, start, end, statPeriod)]);
      let pTot = 0; const bMap = new Map<string, number>();
      if (cStats) gids.forEach(id => { cStats[id]?.forEach((s: any) => { const ch = s.change ?? 0; pTot += ch; const k = this.getBarLabel(s.start, p, lang); bMap.set(k, (bMap.get(k) || 0) + ch); }); });
      const bData: BarData[] = []; if (p === 'day') for (let h = 0; h < 24; h++) { const l = h.toString().padStart(2, '0'); bData.push({ label: l, value: bMap.get(l) || 0 }); } else this.generatePeriodLabels(p, start, lang).forEach(l => bData.push({ label: l, value: bMap.get(l) || 0 }));
      let prevTot: number | null = null; if (pStats) { prevTot = 0; gids.forEach(id => { if (pStats[id]) prevTot! += pStats[id].reduce((sum: number, s: any) => sum + (s.change ?? 0), 0); }); }
      let cTot: number | null = null; if (cids.length > 0 && cStats) { cTot = 0; cids.forEach(id => { if (cStats[id]) cTot! += cStats[id].reduce((sum: number, s: any) => sum + (s.change ?? 0), 0); }); if (cTot === 0) cTot = null; }
      let sP = null, sPTot = null; const sBData: BarData[] = [];
      if (eid_sol && cStats?.[eid_sol]) { sP = this.findCurrentPower(hass, [eid_sol]); sPTot = 0; const sMap = new Map<string, number>(); cStats[eid_sol].forEach((s: any) => { const ch = s.change ?? 0; sPTot! += ch; const k = this.getBarLabel(s.start, p, lang); sMap.set(k, (sMap.get(k) || 0) + ch); }); if (p === 'day') for (let h = 0; h < 24; h++) { const l = h.toString().padStart(2, '0'); sBData.push({ label: l, value: sMap.get(l) || 0 }); } else this.generatePeriodLabels(p, start, lang).forEach(l => sBData.push({ label: l, value: sMap.get(l) || 0 })); }
      let bPct = null, bCh = null, bDis = null; if (bat) { if (eid_bf) { bPct = this.findBatterySoc(hass, eid_bf); if (cStats?.[eid_bf]) bDis = cStats[eid_bf].reduce((sum: number, s: any) => sum + (s.change ?? 0), 0); } if (eid_bt && cStats?.[eid_bt]) bCh = cStats[eid_bt].reduce((sum: number, s: any) => sum + (s.change ?? 0), 0); }
      let gRet = null; if (tids.length > 0 && cStats) { gRet = 0; tids.forEach(id => { if (cStats[id]) gRet! += cStats[id].reduce((sum: number, s: any) => sum + (s.change ?? 0), 0); }); }
      let selfS = (sPTot && sPTot > 0 && pTot > 0) ? Math.min(100, Math.max(0, ((sPTot - (gRet || 0)) / pTot) * 100)) : null;
      return { currentPower: cur, periodTotal: pTot > 0 ? pTot : null, previousPeriodTotal: prevTot, barData: bData, solarPower: sP, solarPeriodTotal: sPTot, solarBarData: sBData, batteryPercent: bPct, batteryCharged: bCh, batteryDischarged: bDis, gridReturn: gRet, selfSufficiency: selfS, hasSolar: !!sol, hasBattery: !!bat, hasGridReturn: tids.length > 0, devices: dData, costTotal: cTot };
    } catch { return null; }
  }

  private async fetchDeviceConsumption(hass: any, prefs: EnergyPrefs, start: Date, end: Date, period: string): Promise<DeviceConsumption[]> {
    if (!prefs.device_consumption?.length) return []; const ids = prefs.device_consumption.map(d => d.stat_consumption); const stats = await this.fetchPeriodStatistics(hass, ids, start, end, period); if (!stats) return [];
    let tot = 0; const devs: DeviceConsumption[] = [];
    prefs.device_consumption.forEach(p => { const id = p.stat_consumption; if (stats[id]) { const ch = stats[id].reduce((sum: number, s: any) => sum + (s.change ?? 0), 0); if (ch > 0) { tot += ch; devs.push({ entityId: id, name: hass.states[id]?.attributes?.friendly_name || id.split('.').pop() || id, consumption: ch, percentage: 0 }); } } });
    if (tot > 0) devs.forEach(d => d.percentage = (d.consumption / tot) * 100); return devs.sort((a, b) => b.consumption - a.consumption);
  }

  private async getEnergyPrefs(hass: any): Promise<EnergyPrefs | null> {
    if (this.prefsCache && Date.now() - this.prefsCache.timestamp < 300000) return this.prefsCache.data;
    try { const p = await hass.callWS({ type: 'energy/get_prefs' }); this.prefsCache = { data: p, timestamp: Date.now() }; EnergySection.cachedGridEntityIds = p?.energy_sources?.find((s: any) => s.type === 'grid')?.flow_from?.map((f: any) => f.stat_energy_from) || null; return p; } catch { return null; }
  }

  private async fetchPeriodStatistics(hass: any, ids: string[], start: Date, end: Date, period: string): Promise<any> {
    if (!ids.length) return null; const key = `${period}:${start.getTime()}:${ids.sort().join(',')}`; const c = this.periodStatsCache.get(key); if (c && Date.now() - c.timestamp < 300000) return c.data;
    try { const r = await hass.callWS({ type: 'recorder/statistics_during_period', start_time: start.toISOString(), end_time: end.toISOString(), statistic_ids: ids, period, types: ['change'] }); this.periodStatsCache.set(key, { data: r, timestamp: Date.now() }); return r; } catch { return null; }
  }

  private getStartDateForPeriod(p: Period): { start: Date; end: Date; statPeriod: string } {
    const now = new Date(), end = now;
    if (p === 'day') return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end, statPeriod: 'hour' };
    if (p === 'week') return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6), end, statPeriod: 'day' };
    return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29), end, statPeriod: 'day' };
  }

  private getPreviousPeriodDates(p: Period): { start: Date; end: Date } {
    const now = new Date(); if (p === 'day') { const e = new Date(now.getFullYear(), now.getMonth(), now.getDate()); return { start: new Date(e.getTime() - 86400000), end: e }; }
    if (p === 'week') { const e = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6); return { start: new Date(e.getTime() - 604800000), end: e }; }
    const e = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29); return { start: new Date(e.getTime() - 2592000000), end: e };
  }

  private getBarLabel(start: string, p: Period, lang: string): string { const d = new Date(start); if (p === 'day') return d.getHours().toString().padStart(2, '0'); if (p === 'week') return d.toLocaleDateString(lang, { weekday: 'short' }); return `${d.getDate()}`; }

  private generatePeriodLabels(p: Period, start: Date, lang: string): string[] {
    const l: string[] = [], now = new Date();
    if (p === 'week') for (let i = 0; i < 7; i++) l.push(new Date(start.getTime() + i * 86400000).toLocaleDateString(lang, { weekday: 'short' }));
    else { const days = Math.ceil((now.getTime() - start.getTime()) / 86400000); for (let i = 0; i < days; i++) l.push(`${new Date(start.getTime() + i * 86400000).getDate()}`); }
    return l;
  }

  private findCurrentPower(hass: any, ids: string[]): number | null {
    let tot = 0, found = false;
    for (const id of ids) {
      const reg = hass.entities?.[id]; if (!reg?.device_id) continue;
      for (const [eid, r] of Object.entries(hass.entities || {})) {
        if ((r as any).device_id !== reg.device_id || eid === id) continue;
        const s = hass.states[eid]; if (s?.attributes?.device_class === 'power' && s.attributes?.state_class !== undefined) { const v = parseFloat(s.state); if (!isNaN(v)) { tot += v; found = true; break; } }
      }
    }
    return found ? tot : null;
  }

  private findBatterySoc(hass: any, id: string): number | null {
    const reg = hass.entities?.[id]; if (!reg?.device_id) return null;
    for (const [eid, r] of Object.entries(hass.entities || {})) { if ((r as any).device_id === reg.device_id) { const s = hass.states[eid]; if (s?.attributes?.device_class === 'battery') { const v = parseFloat(s.state); if (!isNaN(v)) return v; } } }
    return null;
  }

  static hasEnergySensors(hass: any): boolean { if (!hass?.states) return false; return Object.keys(hass.states).some(id => id.startsWith('sensor.') && (hass.states[id]?.attributes?.device_class === 'energy' || hass.states[id]?.attributes?.device_class === 'power') && hass.states[id]?.attributes?.state_class); }

  static getTotalPower(hass: any): number | null {
    if (!hass?.states) return null;
    if (EnergySection.cachedGridEntityIds?.length && hass.entities) {
      let tot = 0, f = false;
      for (const id of EnergySection.cachedGridEntityIds) {
        const reg = hass.entities[id] as any; if (!reg?.device_id) continue;
        for (const [eid, r] of Object.entries(hass.entities)) { if ((r as any).device_id === reg.device_id && eid !== id) { const s = hass.states[eid]; if (s?.attributes?.device_class === 'power' && s.attributes?.state_class !== undefined) { const v = parseFloat(s.state); if (!isNaN(v)) { tot += v; f = true; break; } } } }
      }
      if (f) return tot;
    }
    if (hass.entities) {
      const ids: string[] = []; Object.keys(hass.states).forEach(id => { if (id.startsWith('sensor.') && hass.states[id]?.attributes?.device_class === 'energy' && hass.states[id]?.attributes?.state_class === 'total_increasing' && !(hass.entities[id] as any)?.hidden_by) ids.push(id); });
      if (ids.length > 0) { let tot = 0, f = false; const seen = new Set<string>(); for (const id of ids) { const r = hass.entities[id] as any; if (!r?.device_id || seen.has(r.device_id)) continue; seen.add(r.device_id); for (const [eid, er] of Object.entries(hass.entities)) { if ((er as any).device_id === r.device_id && eid !== id) { const s = hass.states[eid]; if (s?.attributes?.device_class === 'power' && s.attributes?.state_class) { const v = parseFloat(s.state); if (!isNaN(v) && v >= 0) { tot += v; f = true; break; } } } } } if (f) return tot; }
    }
    let tot = 0, f = false;
    Object.keys(hass.states).forEach(id => { if (id.startsWith('sensor.') && hass.states[id]?.attributes?.device_class === 'power' && hass.states[id]?.attributes?.state_class) { const v = parseFloat(hass.states[id].state); if (!isNaN(v) && v >= 0) { tot += v; f = true; } } });
    return f ? tot : null;
  }

  private injectStyles(container: HTMLElement): void {
    const root = container.getRootNode() as ShadowRoot; if (!root || !(root instanceof ShadowRoot) || root.querySelector('#apple-energy-section-styles')) return;
    const s = document.createElement('style'); s.id = 'apple-energy-section-styles';
    s.textContent = `.apple-energy-card{border-radius:var(--apple-card-radius,22px);padding:20px 22px 16px;margin-top:20px;color:#fff;cursor:pointer;transition:transform .2s ease;-webkit-tap-highlight-color:transparent;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,sans-serif;position:relative;overflow:hidden;background:var(--apple-card-bg-inactive,rgba(0,0,0,.3));backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.08);width:100%;max-width:100%;box-sizing:border-box}.apple-energy-card:active{transform:scale(.99)}.energy-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}.energy-header-left{display:flex;align-items:center;gap:6px}.energy-icon{--mdc-icon-size:20px;color:#4ADE80}.energy-label{font-size:14px;font-weight:500;color:rgba(255,255,255,.7)}.energy-header-right{font-size:14px;font-weight:500;color:rgba(255,255,255,.5)}.energy-values{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px}.energy-current-power{font-size:42px;font-weight:200;line-height:1;letter-spacing:-2px;color:#fff}.energy-today-total{font-size:16px;font-weight:400;color:rgba(255,255,255,.55)}.energy-chart{margin-bottom:12px;position:relative}.energy-bars{display:flex;align-items:flex-end;gap:2px;height:60px}.energy-bar{flex:1;display:flex;align-items:flex-end;height:100%}.energy-bar-fill{width:100%;background:#4ADE80;border-radius:2px 2px 0 0;min-height:1px;transition:height .3s ease;opacity:.7}.energy-bar.current .energy-bar-fill{opacity:1;background:#30D158}.energy-bar.future .energy-bar-fill{opacity:.15;height:2%!important}.energy-chart-labels{position:relative;height:18px;margin-top:4px}.energy-chart-label{position:absolute;transform:translateX(-50%);font-size:10px;font-weight:500;color:rgba(255,255,255,.4)}.energy-chart-label.now{color:#4ADE80;font-weight:600}.energy-extra-row{display:flex;gap:20px;padding-top:12px;border-top:1px solid rgba(255,255,255,.08);flex-wrap:wrap}.energy-extra-item{flex:1;min-width:120px}.energy-extra-main{display:flex;align-items:center;gap:6px;font-size:14px;font-weight:500;color:rgba(255,255,255,.8)}.energy-extra-icon{--mdc-icon-size:16px}.energy-extra-icon.solar{color:#FFD60A}.energy-extra-icon.battery{color:#4ADE80}.energy-full-page{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,sans-serif;color:#fff}.energy-dynamic-area{transition:opacity .2s ease}.energy-page-current{display:flex;justify-content:space-between;align-items:center;padding:16px 0;margin-bottom:8px}.energy-page-current-left{display:flex;align-items:center;gap:8px}.energy-page-icon{--mdc-icon-size:24px;color:#4ADE80}.energy-page-current-label{font-size:18px;font-weight:600;color:rgba(255,255,255,.9)}.energy-page-current-value{font-size:32px;font-weight:200;letter-spacing:-1px;color:#fff}.energy-period-selector{display:flex;background:rgba(0,0,0,.3);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:3px;margin-bottom:20px;gap:2px}.energy-period-btn{flex:1;padding:8px 16px;border:none;border-radius:10px;background:transparent;color:rgba(255,255,255,.6);font-size:14px;font-weight:600;cursor:pointer;transition:all .2s ease;font-family:inherit;-webkit-tap-highlight-color:transparent}.energy-period-btn.active{background:rgba(255,255,255,.2);color:#fff}.energy-period-btn:active{transform:scale(.97)}.energy-summary-stats{display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap}.energy-stat{flex:1;min-width:80px;background:rgba(0,0,0,.3);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-radius:14px;padding:14px 16px;border:1px solid rgba(255,255,255,.08)}.energy-stat-label{font-size:12px;font-weight:500;color:rgba(255,255,255,.5);margin-bottom:4px}.energy-stat-value{font-size:20px;font-weight:300;color:#fff;letter-spacing:-.5px}.energy-chart-section{background:rgba(0,0,0,.3);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-radius:16px;padding:16px;margin-bottom:20px;border:1px solid rgba(255,255,255,.08)}.energy-chart-section .energy-bars{height:100px}.energy-flow-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px}.energy-flow-card{background:rgba(0,0,0,.3);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-radius:16px;padding:16px;border:1px solid rgba(255,255,255,.08)}.flow-card-header{display:flex;align-items:center;gap:6px;margin-bottom:10px}.flow-card-icon{--mdc-icon-size:18px}.flow-card-icon.solar{color:#FFD60A}.flow-card-icon.battery{color:#4ADE80}.flow-card-icon.grid-return{color:#5AC8FA}.flow-card-icon.sufficiency{color:#4ADE80}.flow-card-title{font-size:13px;font-weight:600;color:rgba(255,255,255,.7)}.flow-card-values{display:flex;align-items:baseline;gap:8px}.flow-card-primary{font-size:24px;font-weight:200;color:#fff;letter-spacing:-.5px}.flow-card-secondary{font-size:14px;font-weight:400;color:rgba(255,255,255,.5)}.battery-bar-container{height:6px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden;margin:10px 0 8px}.battery-bar-fill{height:100%;background:#4ADE80;border-radius:3px;transition:width .3s ease}.battery-charge-stats{display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,.45)}.self-sufficiency-ring{position:relative;width:80px;height:80px;margin:8px auto 0}.sufficiency-svg{width:100%;height:100%}.sufficiency-pct{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:300;color:#fff}.energy-mini-chart{display:flex;align-items:flex-end;gap:1px;height:30px;margin-top:10px}.energy-mini-bar{flex:1;border-radius:1px 1px 0 0;min-height:1px;opacity:.6}.energy-devices-section{background:rgba(0,0,0,.3);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-radius:16px;padding:16px;border:1px solid rgba(255,255,255,.08)}.energy-devices-title{font-size:16px;font-weight:600;color:rgba(255,255,255,.9);margin-bottom:14px}.energy-device-row{padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05)}.energy-device-row:last-child{border-bottom:none;padding-bottom:0}.device-row-info{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.device-row-name{font-size:14px;font-weight:500;color:rgba(255,255,255,.85);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;margin-right:8px}.device-row-value{font-size:14px;font-weight:400;color:rgba(255,255,255,.55);flex-shrink:0}.device-row-bar-container{height:4px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;flex:1}.device-row-bar-fill{height:100%;background:#4ADE80;border-radius:2px;transition:width .3s ease;opacity:.8}.device-row-pct{font-size:12px;font-weight:500;color:rgba(255,255,255,.45);min-width:32px;text-align:right;margin-top:4px}.energy-no-data{text-align:center;color:rgba(255,255,255,.4);font-size:14px;padding:40px 0}@container apple-home-view (max-width: 755px){.energy-flow-grid{grid-template-columns:1fr}}@container apple-home-view (max-width: 555px){.apple-energy-card{width:100%}.energy-current-power{font-size:34px}.energy-today-total{font-size:14px}.energy-bars{height:48px}.energy-extra-row{flex-direction:column;gap:10px}.energy-page-current-value{font-size:26px}.energy-stat-value{font-size:17px}.energy-chart-section .energy-bars{height:70px}.flow-card-primary{font-size:20px}}@container apple-home-view (max-width: 355px){.energy-current-power{font-size:28px}.energy-bars{height:40px}}@media (prefers-reduced-motion:reduce){.apple-energy-card,.energy-bar-fill,.battery-bar-fill,.device-row-bar-fill,.energy-period-btn,.energy-dynamic-area{transition:none!important}}`;
    root.appendChild(s);
  }
}
