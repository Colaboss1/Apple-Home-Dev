import { DeviceGroup } from '../config/DashboardConfig';
import { ChipsConfig } from '../sections/AppleChips';
import { CustomizationManager } from './CustomizationManager';

export interface ChipsSettings { enabled: boolean; chips_config: ChipsConfig; }

export class ChipsConfigurationManager {
  private static instance: ChipsConfigurationManager | null = null;
  private customizationManager?: CustomizationManager;
  private static readonly DEFAULT: ChipsSettings = {
    enabled: true,
    chips_config: {
      climate: { group: DeviceGroup.CLIMATE, enabled: true, show_when_zero: true },
      lights: { group: DeviceGroup.LIGHTING, enabled: true, show_when_zero: false },
      security: { group: DeviceGroup.SECURITY, enabled: true, show_when_zero: true },
      media: { group: DeviceGroup.MEDIA, enabled: true, show_when_zero: false },
      water: { group: DeviceGroup.WATER, enabled: false, show_when_zero: false }
    }
  };

  private constructor(cm?: CustomizationManager) { this.customizationManager = cm; }

  static getInstance(cm?: CustomizationManager): ChipsConfigurationManager { if (!ChipsConfigurationManager.instance) ChipsConfigurationManager.instance = new ChipsConfigurationManager(cm); if (cm && !ChipsConfigurationManager.instance.customizationManager) ChipsConfigurationManager.instance.customizationManager = cm; return ChipsConfigurationManager.instance; }
  static getDefaultSettings(): ChipsSettings { return JSON.parse(JSON.stringify(this.DEFAULT)); }

  static mergeWithDefaults(u?: Partial<ChipsSettings>): ChipsSettings {
    if (!u) return this.getDefaultSettings();
    const res: ChipsSettings = { enabled: u.enabled !== undefined ? u.enabled : this.DEFAULT.enabled, chips_config: { ...this.DEFAULT.chips_config } };
    if (u.chips_config) { Object.keys(u.chips_config).forEach(k => { const ck = k as keyof ChipsConfig; if (u.chips_config![ck]) res.chips_config[ck] = { ...this.DEFAULT.chips_config[ck], ...u.chips_config![ck] }; }); }
    return res;
  }

  static validateSettings(s: any): s is ChipsSettings {
    if (!s || typeof s !== 'object' || typeof s.enabled !== 'boolean' || !s.chips_config || typeof s.chips_config !== 'object') return false;
    const v = ['climate', 'lights', 'security', 'media', 'water'];
    for (const k of Object.keys(s.chips_config)) {
      if (!v.includes(k)) return false; const c = s.chips_config[k];
      if (!c || typeof c !== 'object' || typeof c.enabled !== 'boolean') return false;
      if (c.show_when_zero !== undefined && typeof c.show_when_zero !== 'boolean') return false;
      if (c.navigation_path !== undefined && typeof c.navigation_path !== 'string') return false;
    } return true;
  }

  static getSettingsFromConfig(): ChipsSettings { return this.getDefaultSettings(); }
  async saveChipsOrder(ord: string[]): Promise<void> { if (this.customizationManager) await this.customizationManager.saveChipsOrder(ord); }
  getSavedChipsOrder(): string[] { return this.customizationManager?.getSavedChipsOrder() || []; }
}
