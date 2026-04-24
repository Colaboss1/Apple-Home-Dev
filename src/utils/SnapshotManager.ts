import { CustomizationManager } from './CustomizationManager';
import { DashboardStateManager } from './DashboardStateManager';

interface SnapshotData { entityId: string; base64Data: string | null; timestamp: number; isLoading: boolean; hasError: boolean; fetchTimer?: number; registrationCount: number; }
interface Hass { states: Record<string, any>; callService: (domain: string, service: string, serviceData: any) => Promise<any>; callWS: (msg: any) => Promise<any>; }

export class SnapshotManager {
  private static instance: SnapshotManager | null = null;
  private snapshots: Map<string, SnapshotData> = new Map();
  private fetchInterval: number = 10000;
  private hass?: Hass;
  private dashboardStateManager: DashboardStateManager;
  private isPaused = false;
  private dashboardStateListener?: (isActive: boolean, dashboardKey?: string | null) => void;

  private constructor() {
    this.dashboardStateManager = DashboardStateManager.getInstance();
    this.dashboardStateListener = (isActive: boolean) => isActive ? this.resume() : this.pause();
    this.dashboardStateManager.addListener(this.dashboardStateListener);
  }

  static getInstance(): SnapshotManager { if (!SnapshotManager.instance) SnapshotManager.instance = new SnapshotManager(); return SnapshotManager.instance; }
  public setHass(hass: Hass): void { this.hass = hass; }

  public registerCamera(id: string): void {
    let d = this.snapshots.get(id);
    if (!d) { d = { entityId: id, base64Data: null, timestamp: 0, isLoading: false, hasError: false, registrationCount: 1 }; this.snapshots.set(id, d); this.startCameraFetchCycle(id); }
    else d.registrationCount++;
  }

  public unregisterCamera(id: string): void {
    const d = this.snapshots.get(id); if (!d) return; d.registrationCount--;
    if (d.registrationCount <= 0) { if (d.fetchTimer) clearTimeout(d.fetchTimer); this.snapshots.delete(id); }
  }

  public isRegistered(id: string): boolean { return this.snapshots.has(id); }
  public getSnapshot(id: string): SnapshotData | null { return this.snapshots.get(id) || null; }
  public getSecondsAgo(id: string): number { const d = this.snapshots.get(id); return (!d || d.timestamp === 0) ? 0 : Math.floor((Date.now() - d.timestamp) / 1000); }

  public forceRefresh(id: string): void {
    const d = this.snapshots.get(id);
    if (d) { if (d.fetchTimer) { clearTimeout(d.fetchTimer); d.fetchTimer = undefined; } this.startCameraFetchCycle(id); }
  }

  private startCameraFetchCycle(id: string): void { if (!this.isPaused) this.fetchSnapshot(id); }

  private scheduleNextFetch(id: string): void {
    if (this.isPaused) return; const d = this.snapshots.get(id); if (!d) return;
    if (d.fetchTimer) clearTimeout(d.fetchTimer);
    d.fetchTimer = window.setTimeout(() => this.startCameraFetchCycle(id), this.fetchInterval);
  }

  private pause(): void { this.isPaused = true; this.snapshots.forEach(d => { if (d.fetchTimer) { clearTimeout(d.fetchTimer); d.fetchTimer = undefined; } }); }
  private resume(): void { if (this.isPaused) { this.isPaused = false; this.snapshots.forEach((_, id) => this.startCameraFetchCycle(id)); } }

  private async fetchSnapshot(id: string): Promise<void> {
    const d = this.snapshots.get(id); if (!d || !this.hass || d.isLoading) return;
    d.isLoading = true; d.hasError = false;
    try {
      const s = this.hass.states[id];
      if (!s || s.state === 'unavailable') { d.hasError = true; d.isLoading = false; this.scheduleNextFetch(id); return; }
      const b64 = await this.getCameraSnapshotBase64(id);
      if (b64) { d.base64Data = b64; d.timestamp = Date.now(); d.hasError = false; } else d.hasError = true;
    } catch { d.hasError = true; } finally { d.isLoading = false; this.scheduleNextFetch(id); }
  }

  private async getCameraSnapshotBase64(id: string): Promise<string | null> {
    if (!this.hass) return null;
    try {
      const s = this.hass.states[id]; if (!s || s.state === 'unavailable') return null;
      let url = s.attributes.entity_picture || '';
      if (!url) { const res = await this.hass.callService('camera', 'snapshot', { entity_id: id, filename: 'temp_snapshot.jpg' }); if (res?.path) url = `/local/${res.path}`; }
      if (!url) return null;
      const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`); if (!res.ok) throw new Error();
      const b = await res.blob();
      return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(b); });
    } catch { return null; }
  }

  public static destroy(): void {
    if (SnapshotManager.instance) {
      if (SnapshotManager.instance.dashboardStateListener) SnapshotManager.instance.dashboardStateManager.removeListener(SnapshotManager.instance.dashboardStateListener);
      SnapshotManager.instance.snapshots.forEach(d => { if (d.fetchTimer) clearTimeout(d.fetchTimer); });
      SnapshotManager.instance.snapshots.clear(); SnapshotManager.instance = null;
    }
  }
}
