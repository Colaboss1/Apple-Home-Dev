import { DashboardConfig, DeviceGroup } from './config/DashboardConfig';
import { AppleHomeCard } from './components/AppleHomeCard';
import { AppleHomeView } from './components/AppleHomeView';
import './components/AppleHomePopup';
import { CustomizationManager } from './utils/CustomizationManager';
import { setupLocalize, localize } from './utils/LocalizationService';
import { BackgroundManager } from './utils/BackgroundManager';
import { HomeAssistantUIManager } from './utils/HomeAssistantUIManager';
import { SnapshotManager } from './utils/SnapshotManager';
import { RTLHelper } from './utils/RTLHelper';
import { injectLiquidGlassStyles } from './utils/LiquidGlassStyles';
import { DashboardStateManager } from './utils/DashboardStateManager';

injectLiquidGlassStyles();

declare global {
  interface Window {
    customCards?: any[];
    customStrategies?: { [key: string]: any };
    appleHomeCleanupRegistered?: boolean;
  }
}

function getCurrentDashboardKey(): string {
  const path = window.location.pathname;
  const match = path.match(/^\/([^\/]+)/);
  return match ? match[1] : 'lovelace';
}

async function generateLovelaceDashboard(
  info: { hass: any; narrow?: boolean },
  options?: { title?: string }
) {
  const { hass } = info;
  
  setupLocalize(hass);
  RTLHelper.initialize(hass);
  
  const dashboardKey = getCurrentDashboardKey();
  const dashboardStateManager = DashboardStateManager.getInstance();
  dashboardStateManager.registerDashboard(dashboardKey);
  dashboardStateManager.setDashboardActive(dashboardKey);
  
  const views = [];
  const customizationManager = CustomizationManager.getInstance(hass);
  const customizations = await customizationManager.loadCustomizations();
  
  await customizationManager.setCustomizations(customizations);

  const snapshotManager = SnapshotManager.getInstance();
  snapshotManager.setHass(hass);

  const backgroundManager = new BackgroundManager(customizationManager);
  backgroundManager.initializeBackground();

  const uiManager = HomeAssistantUIManager.initializeWithCustomizations(customizationManager);
  
  setTimeout(() => {
    uiManager.reapplyDashboardSettings();
  }, 100);

  const homeTitle = options?.title || hass?.config?.location_name || localize('pages.my_home');
  views.push({
    title: homeTitle,
    path: 'home',
    icon: 'mdi:home',
    panel: true,
    cards: [{
      type: 'custom:apple-home-view',
      title: homeTitle,
      pageType: 'home',
      customizations: customizations
    }]
  });

  const deviceGroups = (Object.keys(DashboardConfig.GROUP_STYLES) as DeviceGroup[]).filter(group => group !== DeviceGroup.OTHER);
  
  for (const group of deviceGroups) {
    const groupStyle = DashboardConfig.getGroupStyle(group);
    const groupName = typeof groupStyle.name === 'function' ? groupStyle.name() : groupStyle.name;
    
    views.push({
      title: groupName,
      path: group,
      icon: groupStyle.icon,
      panel: true,
      subview: true,
      cards: [{
        type: 'custom:apple-home-view',
        title: groupName,
        pageType: 'group',
        deviceGroup: group,
        customizations: customizations
      }]
    });
  }

  views.push({
    title: localize('pages.scenes'),
    path: 'scenes',
    icon: 'mdi:palette',
    panel: true,
    subview: true,
    cards: [{
      type: 'custom:apple-home-view',
      title: localize('pages.scenes'),
      pageType: 'scenes',
      customizations: customizations
    }]
  });

  views.push({
    title: localize('pages.cameras'),
    path: 'cameras', 
    icon: 'mdi:cctv',
    panel: true,
    subview: true,
    cards: [{
      type: 'custom:apple-home-view',
      title: localize('pages.cameras'),
      pageType: 'cameras',
      customizations: customizations
    }]
  });

  try {
    const areas = await hass.callWS({ type: 'config/area_registry/list' });
    
    for (const area of areas) {
      views.push({
        title: area.name,
        path: `room-${area.area_id}`,
        icon: 'mdi:home-outline',
        panel: true,
        subview: true,
        cards: [{
          type: 'custom:apple-home-view',
          title: area.name,
          pageType: 'room',
          areaId: area.area_id,
          areaName: area.name,
          customizations: customizations
        }]
      });
    }
  } catch (error) {
    console.error('Error fetching areas for room views:', error);
  }

  views.push({
    title: localize('pages.default_room'),
    path: 'room-no_area',
    icon: 'mdi:home-outline',
    panel: true,
    subview: true,
    cards: [{
      type: 'custom:apple-home-view',
      title: localize('pages.default_room'),
      pageType: 'room',
      areaId: 'no_area',
      areaName: localize('pages.default_room'),
      customizations: customizations
    }]
  });

  return { views };
}

class AppleHomeStrategy extends HTMLElement {
  static async generateDashboard(info: { hass: any; config: any }): Promise<{ views: any[] }> {
    const options = info.config?.strategy?.options || {};
    return generateLovelaceDashboard({ hass: info.hass }, options);
  }
}

if (!customElements.get('apple-home-card')) {
  customElements.define('apple-home-card', AppleHomeCard);
}
if (!customElements.get('apple-home-view')) {
  customElements.define('apple-home-view', AppleHomeView);
}

if (!customElements.get('ll-strategy-dashboard-apple-home-strategy')) {
  customElements.define('ll-strategy-dashboard-apple-home-strategy', AppleHomeStrategy);
}

if (window.customCards) {
  window.customCards.push({
    type: 'custom:apple-home-strategy',
    name: 'Apple Home Strategy',
    description: 'Apple Home-style dashboard strategy with stateless architecture',
    preview: false
  });
}

window.customStrategies = window.customStrategies || {};
window.customStrategies['apple-home-strategy'] = generateLovelaceDashboard;
