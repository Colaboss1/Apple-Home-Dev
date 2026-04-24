export interface RegistryChangeEvent { type: 'entity' | 'device' | 'area' | 'entity_state'; action: 'create' | 'update' | 'remove'; data?: any; }
export type RegistryChangeCallback = (event: RegistryChangeEvent) => void;

export class RegistrySubscriptionManager {
  private static instance: RegistrySubscriptionManager | null = null;
  private hass: any = null;
  private entityRegistryUnsubscribe: (() => void) | null = null;
  private deviceRegistryUnsubscribe: (() => void) | null = null;
  private areaRegistryUnsubscribe: (() => void) | null = null;
  private listeners: Set<RegistryChangeCallback> = new Set();
  private isSubscribed = false;
  private pendingUpdate: ReturnType<typeof setTimeout> | null = null;
  private debounceMs = 500;
  private lastEntityHash = '';
  private lastDeviceHash = '';
  private lastAreaHash = '';
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private pollingIntervalMs = 3000;

  private constructor() {}

  static getInstance(): RegistrySubscriptionManager { if (!RegistrySubscriptionManager.instance) RegistrySubscriptionManager.instance = new RegistrySubscriptionManager(); return RegistrySubscriptionManager.instance; }

  setHass(hass: any): void { const changed = this.hass !== hass; this.hass = hass; if (changed && hass?.connection) this.subscribe(); }
  addListener(cb: RegistryChangeCallback): void { this.listeners.add(cb); }
  removeListener(cb: RegistryChangeCallback): void { this.listeners.delete(cb); }

  private async subscribe(): Promise<void> {
    if (!this.hass?.connection) return; this.unsubscribe();
    try {
      try { this.entityRegistryUnsubscribe = await this.hass.connection.subscribeEvents((e: any) => this.scheduleUpdate({ type: 'entity', action: e.data?.action || 'update', data: e.data }), 'entity_registry_updated'); } catch {}
      try { this.deviceRegistryUnsubscribe = await this.hass.connection.subscribeEvents((e: any) => this.scheduleUpdate({ type: 'device', action: e.data?.action || 'update', data: e.data }), 'device_registry_updated'); } catch {}
      try { this.areaRegistryUnsubscribe = await this.hass.connection.subscribeEvents((e: any) => this.scheduleUpdate({ type: 'area', action: e.data?.action || 'update', data: e.data }), 'area_registry_updated'); } catch {}
      this.isSubscribed = true; await this.initializeHashes();
    } catch {}
  }

  private async initializeHashes(): Promise<void> { if (!this.hass) return; try { const [e, d, a] = await Promise.all([this.hass.callWS({ type: 'config/entity_registry/list' }), this.hass.callWS({ type: 'config/device_registry/list' }), this.hass.callWS({ type: 'config/area_registry/list' })]); this.lastEntityHash = this.createEntityHash(e); this.lastDeviceHash = this.createDeviceHash(d); this.lastAreaHash = this.createAreaHash(a); } catch {} }

  private async checkForChanges(): Promise<void> {
    if (!this.hass) return;
    try {
      const [e, d, a] = await Promise.all([this.hass.callWS({ type: 'config/entity_registry/list' }), this.hass.callWS({ type: 'config/device_registry/list' }), this.hass.callWS({ type: 'config/area_registry/list' })]);
      const eh = this.createEntityHash(e), dh = this.createDeviceHash(d), ah = this.createAreaHash(a);
      let type: string | null = null;
      if (eh !== this.lastEntityHash) { this.lastEntityHash = eh; type = 'entity'; }
      if (dh !== this.lastDeviceHash) { this.lastDeviceHash = dh; type = type || 'device'; }
      if (ah !== this.lastAreaHash) { this.lastAreaHash = ah; type = type || 'area'; }
      if (type) this.scheduleUpdate({ type: type as any, action: 'update' });
    } catch {}
  }

  private createEntityHash(entities: any[]): string { if (!Array.isArray(entities)) return ''; return JSON.stringify(entities.map(e => ({ id: e.entity_id, area: e.area_id || '', device: e.device_id || '', hidden: e.hidden_by || '', disabled: e.disabled_by || '' })).sort((a, b) => a.id.localeCompare(b.id))); }
  private createDeviceHash(devices: any[]): string { if (!Array.isArray(devices)) return ''; return JSON.stringify(devices.map(d => ({ id: d.id, area: d.area_id || '' })).sort((a, b) => a.id.localeCompare(b.id))); }
  private createAreaHash(areas: any[]): string { if (!Array.isArray(areas)) return ''; return JSON.stringify(areas.map(a => ({ id: a.area_id, name: a.name })).sort((a, b) => a.id.localeCompare(b.id))); }

  private scheduleUpdate(event: RegistryChangeEvent): void { if (this.pendingUpdate) clearTimeout(this.pendingUpdate); this.pendingUpdate = setTimeout(() => { this.pendingUpdate = null; this.listeners.forEach(cb => { try { cb(event); } catch {} }); }, this.debounceMs); }

  async forceRefresh(): Promise<void> { await this.checkForChanges(); }

  unsubscribe(): void {
    if (this.entityRegistryUnsubscribe) { try { this.entityRegistryUnsubscribe(); } catch {} this.entityRegistryUnsubscribe = null; }
    if (this.deviceRegistryUnsubscribe) { try { this.deviceRegistryUnsubscribe(); } catch {} this.deviceRegistryUnsubscribe = null; }
    if (this.areaRegistryUnsubscribe) { try { this.areaRegistryUnsubscribe(); } catch {} this.areaRegistryUnsubscribe = null; }
    if (this.pollingInterval) { clearInterval(this.pollingInterval); this.pollingInterval = null; }
    this.isSubscribed = false;
  }

  destroy(): void { this.unsubscribe(); this.listeners.clear(); this.hass = null; RegistrySubscriptionManager.instance = null; }
}
