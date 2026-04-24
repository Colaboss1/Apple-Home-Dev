import { CustomizationManager } from '../utils/CustomizationManager';
import { localize } from '../utils/LocalizationService';

const METEOCONS_BASE = 'https://basmilus.github.io/weather-icons/production/fill/all';
const CONDITION_MAP: Record<string, { icon: string; iconNight?: string; gradient: [string, string] }> = {
  'sunny': { icon: 'clear-day', iconNight: 'clear-night', gradient: ['#1565C0', '#42A5F5'] }, 'clear-night': { icon: 'clear-night', gradient: ['#0D1B2A', '#1B3A5C'] }, 'cloudy': { icon: 'overcast', gradient: ['#546E7A', '#78909C'] }, 'partlycloudy': { icon: 'partly-cloudy-day', iconNight: 'partly-cloudy-night', gradient: ['#37474F', '#607D8B'] }, 'rainy': { icon: 'rain', gradient: ['#263238', '#455A64'] }, 'pouring': { icon: 'extreme-rain', gradient: ['#1A237E', '#37474F'] }, 'snowy': { icon: 'snow', gradient: ['#546E7A', '#90A4AE'] }, 'snowy-rainy': { icon: 'sleet', gradient: ['#455A64', '#78909C'] }, 'fog': { icon: 'fog', gradient: ['#616161', '#9E9E9E'] }, 'hail': { icon: 'hail', gradient: ['#37474F', '#78909C'] }, 'lightning': { icon: 'thunderstorms', gradient: ['#1A1A2E', '#3D3D6B'] }, 'lightning-rainy': { icon: 'thunderstorms-rain', gradient: ['#1A1A2E', '#37474F'] }, 'windy': { icon: 'wind', gradient: ['#455A64', '#78909C'] }, 'windy-variant': { icon: 'wind', gradient: ['#455A64', '#78909C'] }, 'exceptional': { icon: 'extreme', gradient: ['#4A148C', '#7B1FA2'] }
};
const MDI_ICONS: Record<string, string> = { 'sunny': 'mdi:weather-sunny', 'clear-night': 'mdi:weather-night', 'cloudy': 'mdi:weather-cloudy', 'partlycloudy': 'mdi:weather-partly-cloudy', 'rainy': 'mdi:weather-rainy', 'pouring': 'mdi:weather-pouring', 'snowy': 'mdi:weather-snowy', 'snowy-rainy': 'mdi:weather-snowy-rainy', 'fog': 'mdi:weather-fog', 'hail': 'mdi:weather-hail', 'lightning': 'mdi:weather-lightning', 'lightning-rainy': 'mdi:weather-lightning-rainy', 'windy': 'mdi:weather-windy', 'windy-variant': 'mdi:weather-windy-variant', 'exceptional': 'mdi:alert-circle-outline' };
interface ForecastDay { datetime: string; temperature?: number; templow?: number; condition?: string; }
function tempToColor(t: number): string { if (t <= 0) return '#4FC3F7'; if (t <= 10) return '#29B6F6'; if (t <= 15) return '#26C6DA'; if (t <= 20) return '#66BB6A'; if (t <= 25) return '#FFEE58'; if (t <= 30) return '#FFA726'; if (t <= 35) return '#EF5350'; return '#D32F2F'; }
function isNightTime(hass: any): boolean { return hass.states?.['sun.sun']?.state === 'below_horizon'; }

export class WeatherSection {
  private customizationManager: CustomizationManager;
  private forecastCache: { entityId: string; data: ForecastDay[]; timestamp: number } | null = null;
  private clockInterval: ReturnType<typeof setInterval> | null = null;

  constructor(cm: CustomizationManager) { this.customizationManager = cm; }

  async render(container: HTMLElement, hass: any): Promise<void> {
    const eid = await this.customizationManager.getWeatherEntity(); if (!eid) return;
    const s = hass.states[eid]; if (!s || s.state === 'unavailable' || s.state === 'unknown') return;
    this.injectStyles(container); if (this.clockInterval) { clearInterval(this.clockInterval); this.clockInterval = null; }
    const forecast = await this.fetchForecast(hass, eid, s), t_fc = forecast.length > 0 ? forecast[0] : null, attrs = s.attributes;
    const temp = Math.round(attrs.temperature ?? 0), cond = s.state, info = CONDITION_MAP[cond] || CONDITION_MAP['cloudy'], night = isNightTime(hass);
    const lang = hass.locale?.language || hass.language || 'en', tf = hass.locale?.time_format ?? 'language';
    const iconUrl = `${METEOCONS_BASE}/${(night && info.iconNight) ? info.iconNight : info.icon}.svg`, grad = (night && cond !== 'clear-night') ? ['#0D1B2A', '#1B3A5C'] : info.gradient;
    const card = document.createElement('div'); card.className = 'apple-weather-card'; card.style.setProperty('--weather-tint', grad[0]);
    card.addEventListener('click', () => card.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: eid }, bubbles: true, composed: true })));
    const inner = document.createElement('div'); inner.className = 'weather-card-inner';
    const cSide = document.createElement('div'); cSide.className = 'weather-clock-side';
    const timeEl = document.createElement('div'); timeEl.className = 'weather-clock-time';
    const dateEl = document.createElement('div'); dateEl.className = 'weather-clock-date';
    const upd = () => { const now = new Date(); if (tf === '12') timeEl.textContent = now.toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit', hour12: true }); else if (tf === '24') timeEl.textContent = now.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', hour12: false }); else timeEl.textContent = now.toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit' }); dateEl.textContent = now.toLocaleDateString(lang, { weekday: 'long', month: 'long', day: 'numeric' }); };
    upd(); this.clockInterval = setInterval(upd, 15000); cSide.appendChild(timeEl); cSide.appendChild(dateEl); inner.appendChild(cSide);
    const wSide = document.createElement('div'); wSide.className = 'weather-content-side';
    const hero = document.createElement('div'); hero.className = 'weather-hero';
    const iWrap = document.createElement('div'); iWrap.className = 'weather-icon-wrap';
    const iImg = document.createElement('img'); iImg.className = 'weather-icon-img'; iImg.src = iconUrl; iImg.onerror = () => iWrap.innerHTML = `<ha-icon icon="${MDI_ICONS[cond] || 'mdi:weather-cloudy'}" class="weather-icon-fallback"></ha-icon>`;
    iWrap.appendChild(iImg); hero.appendChild(iWrap);
    const hInfo = document.createElement('div'); hInfo.className = 'weather-hero-info';
    const tEl = document.createElement('div'); tEl.className = 'weather-temp'; tEl.textContent = `${temp}°`; const u = document.createElement('span'); u.className = 'weather-temp-unit'; u.textContent = (hass.config?.unit_system?.temperature || '°C') === '°F' ? 'F' : 'C'; tEl.appendChild(u); hInfo.appendChild(tEl);
    const condEl = document.createElement('div'); condEl.className = 'weather-condition'; condEl.textContent = localize(`weather.conditions.${cond}`) || cond; hInfo.appendChild(condEl);
    if (t_fc) { const hl = document.createElement('div'); hl.className = 'weather-hi-lo'; hl.textContent = `${localize('weather.high')}:${t_fc.temperature != null ? Math.round(t_fc.temperature) : '--'}°  ${localize('weather.low')}:${t_fc.templow != null ? Math.round(t_fc.templow) : '--'}°`; hInfo.appendChild(hl); }
    hero.appendChild(hInfo); wSide.appendChild(hero);
    if (attrs.humidity != null || attrs.wind_speed != null) {
      const details = document.createElement('div'); details.className = 'weather-details';
      if (attrs.humidity != null) details.innerHTML += `<div class="weather-detail-pill"><ha-icon icon="mdi:water-percent"></ha-icon><span>${localize('weather.humidity')} ${attrs.humidity}%</span></div>`;
      if (attrs.wind_speed != null) details.innerHTML += `<div class="weather-detail-pill"><ha-icon icon="mdi:weather-windy"></ha-icon><span>${localize('weather.wind')} ${Math.round(attrs.wind_speed)} ${attrs.wind_speed_unit || 'km/h'}</span></div>`;
      wSide.appendChild(details);
    }
    inner.appendChild(wSide); card.appendChild(inner);
    const fcs = forecast.slice(1, 6);
    if (fcs.length > 0) {
      const fcCont = document.createElement('div'); fcCont.className = 'weather-forecast';
      let gMin = Infinity, gMax = -Infinity; fcs.concat(t_fc ? [t_fc] : []).forEach(d => { if (d.templow != null) gMin = Math.min(gMin, d.templow); if (d.temperature != null) gMax = Math.max(gMax, d.temperature); });
      const range = gMax - gMin || 1;
      fcs.forEach(d => {
        const row = document.createElement('div'); row.className = 'forecast-row'; const dt = new Date(d.datetime); const h = d.temperature != null ? Math.round(d.temperature) : null, l = d.templow != null ? Math.round(d.templow) : null;
        row.innerHTML = `<span class="forecast-day-name">${dt.toLocaleDateString(lang, { weekday: 'short' })}</span><img class="forecast-icon" src="${METEOCONS_BASE}/${this.getMeteoconName(d.condition || 'cloudy')}.svg" onerror="this.replaceWith(Object.assign(document.createElement('ha-icon'),{icon:MDI_ICONS['${d.condition || ''}']||'mdi:weather-cloudy',className:'forecast-icon-fallback'}))"><span class="forecast-temp-low">${l != null ? l + '°' : '--'}</span><div class="forecast-bar-wrap"><div class="forecast-bar-bg"><div class="forecast-bar-fill" style="${l != null && h != null ? `left:${((l - gMin) / range) * 100}%;width:${((h - gMin) / range) * 100 - ((l - gMin) / range) * 100}%;background:linear-gradient(to right,${tempToColor(l)},${tempToColor(h)})` : ''}"></div></div></div><span class="forecast-temp-high">${h != null ? h + '°' : '--'}</span>`;
        fcCont.appendChild(row);
      });
      card.appendChild(fcCont);
    }
    container.appendChild(card);
  }

  private getMeteoconName(c: string): string { return CONDITION_MAP[c]?.icon || 'overcast'; }

  private async fetchForecast(hass: any, eid: string, s: any): Promise<ForecastDay[]> {
    if (this.forecastCache?.entityId === eid && Date.now() - this.forecastCache.timestamp < 600000) return this.forecastCache.data;
    try { const res = await hass.callWS({ type: 'weather/get_forecasts', entity_id: eid, forecast_type: 'daily' }); const f = res?.[eid]?.forecast || []; if (f.length > 0) { this.forecastCache = { entityId: eid, data: f, timestamp: Date.now() }; return f; } } catch {}
    const af = s.attributes?.forecast; if (Array.isArray(af) && af.length > 0) { this.forecastCache = { entityId: eid, data: af, timestamp: Date.now() }; return af; }
    return [];
  }

  private injectStyles(container: HTMLElement): void {
    const root = container.getRootNode() as ShadowRoot; if (!root || !(root instanceof ShadowRoot) || root.querySelector('#apple-weather-section-styles')) return;
    const s = document.createElement('style'); s.id = 'apple-weather-section-styles';
    s.textContent = `.apple-weather-card{border-radius:var(--apple-card-radius,22px);padding:20px 22px 16px;margin-top:20px;color:#fff;cursor:pointer;transition:transform .2s ease;-webkit-tap-highlight-color:transparent;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,sans-serif;position:relative;overflow:hidden;background:var(--apple-card-bg-inactive,rgba(40,40,40,.7));backdrop-filter:none;-webkit-backdrop-filter:none;border:1px solid rgba(255,255,255,.08);width:fit-content;max-width:100%;box-sizing:border-box}.apple-weather-card::after{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 30% 20%,var(--weather-tint,transparent) 0%,transparent 70%);opacity:.15;pointer-events:none}.apple-weather-card:active{transform:scale(.99)}.weather-card-inner{display:flex;flex-direction:row;gap:24px;align-items:center;position:relative}.weather-clock-side{flex-shrink:0;display:flex;flex-direction:column;justify-content:center;min-width:0;padding-right:24px;border-right:1px solid rgba(255,255,255,.1)}.weather-clock-time{font-size:48px;font-weight:600;color:#fff;line-height:1.1;letter-spacing:-1px;font-variant-numeric:tabular-nums;white-space:nowrap}.weather-clock-date{font-size:15px;font-weight:400;color:rgba(255,255,255,.55);margin-top:4px;letter-spacing:.2px;text-transform:capitalize;white-space:nowrap}.weather-content-side{flex:1;min-width:0}.weather-hero{display:flex;align-items:center;gap:10px;position:relative}.weather-icon-wrap{flex-shrink:0;width:100px;height:100px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 8px rgba(0,0,0,.3))}.weather-icon-img{width:100%;height:100%;object-fit:contain}.weather-icon-fallback{--mdc-icon-size:48px;color:#fff}.weather-temp{font-size:44px;font-weight:100;line-height:1;letter-spacing:-2px;position:relative}.weather-temp-unit{font-size:16px;font-weight:300;letter-spacing:0;vertical-align:super;margin-left:1px;opacity:.7}.weather-condition{font-size:15px;font-weight:500;color:rgba(255,255,255,.9);margin-top:2px;text-transform:capitalize}.weather-hi-lo{font-size:13px;font-weight:400;color:rgba(255,255,255,.55);margin-top:1px;letter-spacing:.3px}.weather-details{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}.weather-detail-pill{display:flex;align-items:center;gap:4px;background:rgba(255,255,255,.12);border-radius:20px;padding:4px 10px;font-size:12px;font-weight:500;color:rgba(255,255,255,.85)}.weather-detail-pill ha-icon{--mdc-icon-size:14px;color:rgba(255,255,255,.65)}.weather-forecast{margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:6px;position:relative}.forecast-row{display:flex;align-items:center;gap:8px;height:26px}.forecast-day-name{width:34px;font-size:13px;font-weight:500;color:rgba(255,255,255,.85);text-transform:capitalize;flex-shrink:0}.forecast-icon{width:24px;height:24px;flex-shrink:0;object-fit:contain;filter:drop-shadow(0 1px 2px rgba(0,0,0,.2))}.forecast-icon-fallback{--mdc-icon-size:18px;color:rgba(255,255,255,.8)}.forecast-temp-low{width:28px;text-align:right;font-size:13px;font-weight:400;color:rgba(255,255,255,.5);flex-shrink:0}.forecast-temp-high{width:28px;text-align:left;font-size:13px;font-weight:500;color:rgba(255,255,255,.95);flex-shrink:0}.forecast-bar-wrap{flex:1;min-width:50px;height:4px;position:relative}.forecast-bar-bg{position:absolute;inset:0;background:rgba(255,255,255,.12);border-radius:2px;overflow:hidden}.forecast-bar-fill{position:absolute;top:0;bottom:0;border-radius:2px;transition:width .6s ease,left .6s ease}@container apple-home-view (max-width: 555px){.apple-weather-card{width:100%;max-height:calc(100svh - 170px);overflow:hidden}.weather-card-inner{flex-direction:column;gap:10px;align-items:center;text-align:center}.weather-clock-side{padding-right:0;border-right:none;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.1);width:100%;align-items:center}.weather-content-side{display:flex;flex-direction:column;align-items:center}.weather-hero{justify-content:center}.weather-details{justify-content:center}.weather-clock-time{font-size:38px}.weather-clock-date{font-size:14px;margin-top:2px}.weather-icon-wrap{width:60px;height:60px}.weather-temp{font-size:36px}.weather-condition{font-size:14px}.weather-hi-lo{font-size:12px}.weather-detail-pill{font-size:11px;padding:3px 9px}.weather-forecast{display:none}}@container apple-home-view (max-width: 355px){.weather-clock-time{font-size:32px}.weather-clock-date{font-size:13px}.weather-temp{font-size:30px}.weather-icon-wrap{width:50px;height:50px}}@media (prefers-reduced-motion:reduce){.apple-weather-card,.forecast-bar-fill{transition:none!important}}`;
    root.appendChild(s);
  }
}
