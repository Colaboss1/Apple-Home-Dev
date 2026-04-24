import { CustomizationManager } from '../utils/CustomizationManager';
import { DataService } from '../utils/DataService';
import { DashboardConfig, DeviceGroup } from '../config/DashboardConfig';
import { ScenesSection } from '../sections/ScenesSection';
import { CamerasSection } from '../sections/CamerasSection';
import { AreaSection } from '../sections/AreaSection';
import { StatusSection } from '../sections/StatusSection';
import { WeatherSection } from '../sections/WeatherSection';
import { EnergySection } from '../sections/EnergySection';
import { Entity } from '../types/types';

export class GroupPage {
  private customizationManager?: CustomizationManager;
  private scenesSection?: ScenesSection;
  private camerasSection?: CamerasSection;
  private areaSection?: AreaSection;
  private statusSection?: StatusSection;
  private weatherSection?: WeatherSection;
  private energySection?: EnergySection;
  private _hass?: any;
  private _group?: DeviceGroup;
  private _config?: any;

  constructor() {
  }

  set hass(hass: any) {
    this._hass = hass;
    
    if (this.statusSection) {
      this.statusSection.hass = hass;
    }
  }

  get hass() {
    return this._hass;
  }

  async setConfig(config: any) {
    this._config = config;
    this._group = config.group;
    
    if (config.customizations && this._hass) {
      this.customizationManager = CustomizationManager.getInstance(this._hass);
      await this.customizationManager.setCustomizations(config.customizations);
      this.initializeSections();
    }
  }

  private initializeSections() {
    if (this.customizationManager) {
      this.scenesSection = new ScenesSection(this.customizationManager);
      this.camerasSection = new CamerasSection(this.customizationManager);
      this.areaSection = new AreaSection(this.customizationManager);
      this.statusSection = new StatusSection(this.customizationManager);
      this.weatherSection = new WeatherSection(this.customizationManager);
      this.energySection = new EnergySection(this.customizationManager);
    }
  }

  private getEntityAreaId(entity: Entity, devices: any[]): string {
    if (entity.area_id) {
      return entity.area_id;
    }
    
    if (entity.device_id) {
      const device = devices.find(d => d.id === entity.device_id);
      if (device?.area_id) {
        return device.area_id;
      }
    }
    
    return 'no_area';
  }

  private isEntityInHiddenArea(entity: Entity, devices: any[], hiddenSections: string[]): boolean {
    if (hiddenSections.length === 0) return false;
    
    const areaId = this.getEntityAreaId(entity, devices);
    return hiddenSections.includes(areaId);
  }

  private createGroupTitle(group: DeviceGroup): HTMLElement {
    const titleElement = document.createElement('h1');
    titleElement.className = 'apple-page-title';
    
    const groupStyle = DashboardConfig.getGroupStyle(group);
    titleElement.textContent = typeof groupStyle.name === 'function' ? groupStyle.name() : groupStyle.name;
    
    return titleElement;
  }

  async render(
    container: HTMLElement,
    group: DeviceGroup,
    hass: any,
    onTallToggle?: (entityId: string, areaId: string) => void | Promise<void | boolean>
  ): Promise<void> {
    const permanentSelectors = ['.apple-home-header', '.permanent-chips'];
    Array.from(container.children).forEach(child => {
      const isPermanent = permanentSelectors.some(sel => child.matches(sel));
      if (!isPermanent) child.remove();
    });

    const groupTitle = this.createGroupTitle(group);
    const existingPermanentChips = container.querySelector('.permanent-chips');
    if (existingPermanentChips) {
      container.insertBefore(groupTitle, existingPermanentChips);
    } else {
      container.appendChild(groupTitle);
    }

    try {
      const [areas, entities, devices] = await Promise.all([
        DataService.getAreas(hass),
        DataService.getEntities(hass),
        DataService.getDevices(hass)
      ]);
      
      const hiddenSections = this.customizationManager?.getHiddenSections() || [];
      
      const supportedEntities = entities.filter(entity => {
        if (entity.entity_category === 'config' || entity.entity_category === 'diagnostic') {
          return false;
        }
        const domain = entity.entity_id.split('.')[0];
        return DashboardConfig.isSupportedDomain(domain);
      });

      const statusEntities = entities.filter(entity => {
        if (entity.entity_category === 'config' || entity.entity_category === 'diagnostic') {
          return false;
        }
        const domain = entity.entity_id.split('.')[0];
        return DashboardConfig.isStatusDomain(domain);
      });

      const excludedFromDashboard = new Set(await this.customizationManager?.getExcludedFromDashboard() || []);

      const filteredEntities = supportedEntities.filter(entity =>
        !excludedFromDashboard.has(entity.entity_id) && !this.isEntityInHiddenArea(entity, devices, hiddenSections)
      );
      const filteredStatusEntities = statusEntities.filter(entity =>
        !excludedFromDashboard.has(entity.entity_id) && !this.isEntityInHiddenArea(entity, devices, hiddenSections)
      );
      
      const scenesEntities = filteredEntities.filter(entity => 
        DashboardConfig.isScenesDomain(entity.entity_id.split('.')[0])
      );
      
      const camerasEntities = filteredEntities.filter(entity => 
        DashboardConfig.isCamerasDomain(entity.entity_id.split('.')[0])
      );
      
      const regularEntities = filteredEntities.filter(entity => 
        !DashboardConfig.isSpecialSectionDomain(entity.entity_id.split('.')[0])
      );
      
      const entitiesByArea = DataService.groupEntitiesByArea(regularEntities, areas, devices);
      
      const showSwitches = await this.customizationManager?.getShowSwitches() || false;
      const includedSwitches = await this.customizationManager?.getIncludedSwitches() || [];
      
      const groupEntitiesByArea: { [areaId: string]: Entity[] } = {};
      
      for (const [areaId, entities] of Object.entries(entitiesByArea)) {
        const groupEntities = entities.filter(entity => {
          const domain = entity.entity_id.split('.')[0];
          const entityState = this.hass?.states[entity.entity_id];
          
          if (domain === 'switch') {
            if (showSwitches) {
              const entityGroup = DashboardConfig.getDeviceGroup(domain, entity.entity_id, entityState?.attributes, showSwitches);
              return entityGroup === group;
            } else {
              const isOutlet = DashboardConfig.isOutlet(entity.entity_id, entityState?.attributes);
              const isIncluded = includedSwitches.includes(entity.entity_id);
              if (isOutlet || isIncluded) {
                const entityGroup = DashboardConfig.getDeviceGroup(domain, entity.entity_id, entityState?.attributes, true);
                return entityGroup === group;
              }
              return false;
            }
          } else {
            const entityGroup = DashboardConfig.getDeviceGroup(domain, entity.entity_id, entityState?.attributes, showSwitches);
            return entityGroup === group;
          }
        });
        
        if (groupEntities.length > 0) {
          groupEntitiesByArea[areaId] = groupEntities;
        }
      }

      if (group === DeviceGroup.ENERGY) {
        const energySensors = entities.filter(entity => {
          if (entity.entity_category === 'config' || entity.entity_category === 'diagnostic') return false;
          if (excludedFromDashboard.has(entity.entity_id)) return false;
          if (this.isEntityInHiddenArea(entity, devices, hiddenSections)) return false;
          const domain = entity.entity_id.split('.')[0];
          if (domain !== 'sensor') return false;
          const state = hass.states[entity.entity_id];
          if (!state) return false;
          const dc = state.attributes?.device_class;
          const reg = (hass.entities as any)?.[entity.entity_id];
          if (reg?.hidden_by || reg?.disabled_by) return false;
          return (dc === 'energy' || dc === 'power') && !!state.attributes?.state_class;
        });

        for (const entity of energySensors) {
          const areaId = this.getEntityAreaId(entity, devices);
          if (!groupEntitiesByArea[areaId]) {
            groupEntitiesByArea[areaId] = [];
          }
          if (!groupEntitiesByArea[areaId].some(e => e.entity_id === entity.entity_id)) {
            groupEntitiesByArea[areaId].push(entity);
          }
        }
      }

      const groupEntityIds = new Set<string>();
      Object.values(groupEntitiesByArea).forEach(entities => {
        entities.forEach(e => groupEntityIds.add(e.entity_id));
      });
      
      const statusGroupEntities = filteredStatusEntities.filter(entity => {
        const domain = entity.entity_id.split('.')[0];
        const entityState = this.hass?.states[entity.entity_id];
        const deviceClass = entityState?.attributes?.device_class;
        
        if (domain === 'sensor' && deviceClass === 'battery') {
          const batteryEntityRegistry = entities.find(e => e.entity_id === entity.entity_id);
          if (!batteryEntityRegistry?.device_id) {
            return false;
          }
          
          const deviceId = batteryEntityRegistry.device_id;
          const deviceHasGroupEntities = entities.some(e => 
            e.device_id === deviceId && 
            e.entity_id !== entity.entity_id && 
            groupEntityIds.has(e.entity_id)
          );
          
          return deviceHasGroupEntities;
        }
        
        if (domain === 'switch') {
          if (showSwitches) {
            const entityGroup = DashboardConfig.getDeviceGroup(domain, entity.entity_id, entityState?.attributes, showSwitches);
            return entityGroup === group;
          } else {
            const isOutlet = DashboardConfig.isOutlet(entity.entity_id, entityState?.attributes);
            const isIncluded = includedSwitches.includes(entity.entity_id);
            if (isOutlet || isIncluded) {
              const entityGroup = DashboardConfig.getDeviceGroup(domain, entity.entity_id, entityState?.attributes, true);
              return entityGroup === group;
            }
            return false;
          }
        } else {
          const entityGroup = DashboardConfig.getDeviceGroup(domain, entity.entity_id, entityState?.attributes, showSwitches);
          return entityGroup === group;
        }
      });
      
      if (this.statusSection && statusGroupEntities.length > 0) {
        await this.statusSection.render(container, statusGroupEntities, hass, this._group || 'group');
      }
      
      if (!this.customizationManager) {
        throw new Error('CustomizationManager not initialized');
      }
      
      const customizations = this.customizationManager.getCustomizations();
      const customizedAreas = this.applyCustomizations(groupEntitiesByArea, customizations);
      
      let groupScenesEntities: Entity[] = [];
      let groupCamerasEntities: Entity[] = [];
      
      if (group === DeviceGroup.SECURITY) {
        groupCamerasEntities = camerasEntities;
      }
      
      if (group === DeviceGroup.LIGHTING) {
        groupScenesEntities = scenesEntities;
      }
      
      await this.renderSectionsInOrder(
        container, 
        customizedAreas, 
        groupScenesEntities, 
        groupCamerasEntities, 
        hass, 
        onTallToggle
      );
      
    } catch (error) {
      console.error('Error rendering group page:', error);
    }
  }

  private async renderSectionsInOrder(
    container: HTMLElement,
    entitiesByArea: { [areaId: string]: Entity[] },
    scenesEntities: Entity[],
    camerasEntities: Entity[],
    hass: any,
    onTallToggle?: (entityId: string, areaId: string) => void | Promise<void | boolean>
  ): Promise<void> {
    if (!this.customizationManager || !this.scenesSection || !this.camerasSection || !this.areaSection) {
      throw new Error('Required sections not initialized');
    }

    const sectionOrder = this.customizationManager.getSavedSectionOrder();
    const hiddenSections = this.customizationManager.getHiddenSections();

    const availableSections = new Map<string, () => Promise<void>>();

    if (this._group === DeviceGroup.CLIMATE && this.weatherSection) {
      const weatherEntity = await this.customizationManager?.getWeatherEntity();
      if (weatherEntity && hass.states[weatherEntity]) {
        availableSections.set('weather_section', async () => {
          await this.weatherSection!.render(container, hass);
        });
      }
    }

    if (this._group === DeviceGroup.ENERGY && this.energySection) {
      availableSections.set('energy_section', async () => {
        await this.energySection!.render(container, hass, 'group');
      });
    }

    if (scenesEntities.length > 0) {
      availableSections.set('scenes_section', async () => {
        await this.scenesSection!.render(container, scenesEntities, hass, onTallToggle, 'room', false);
      });
    }
    
    if (camerasEntities.length > 0) {
      availableSections.set('cameras_section', async () => {
        await this.camerasSection!.render(container, camerasEntities, hass, onTallToggle, 'room', false);
      });
    }
    
    for (const areaId of Object.keys(entitiesByArea)) {
      if (entitiesByArea[areaId].length > 0) {
        availableSections.set(areaId, async () => {
          await this.areaSection!.renderSingleArea(container, areaId, entitiesByArea[areaId], hass, onTallToggle, 'room', false);
        });
      }
    }
    
    let orderedSectionIds: string[] = [];
    
    if (sectionOrder.length > 0) {
      orderedSectionIds = sectionOrder.filter(id => availableSections.has(id));
      
      for (const sectionId of availableSections.keys()) {
        if (!orderedSectionIds.includes(sectionId)) {
          if (sectionId === 'weather_section' || sectionId === 'energy_section') {
            orderedSectionIds.unshift(sectionId);
          } else {
            orderedSectionIds.push(sectionId);
          }
        }
      }
    } else {
      orderedSectionIds = Array.from(availableSections.keys()).sort((a, b) => {
        if (a === 'weather_section') return -1;
        if (b === 'weather_section') return 1;
        if (a === 'energy_section') return -1;
        if (b === 'energy_section') return 1;
        if (a === 'cameras_section') return -1;
        if (b === 'cameras_section') return 1;
        if (a === 'scenes_section') return -1;
        if (b === 'scenes_section') return 1;
        return a.localeCompare(b);
      });
    }
    
    for (const sectionId of orderedSectionIds) {
      if (!hiddenSections.includes(sectionId) && availableSections.has(sectionId)) {
        await availableSections.get(sectionId)!();
      }
    }
  }

  private applyCustomizations(entitiesByArea: { [areaId: string]: Entity[] }, customizations: any): { [areaId: string]: Entity[] } {
    const result: { [areaId: string]: Entity[] } = {};
    
    const areaIds = Object.keys(entitiesByArea);
    let sortedAreaIds = areaIds;
    
    if (customizations.home?.sections?.order) {
      sortedAreaIds = [...areaIds].sort((a, b) => {
        const aOrder = customizations.home.sections.order!.indexOf(a);
        const bOrder = customizations.home.sections.order!.indexOf(b);
        
        if (aOrder !== -1 && bOrder !== -1) {
          return aOrder - bOrder;
        }
        if (aOrder !== -1) return -1;
        if (bOrder !== -1) return 1;
        return 0;
      });
    }
    
    for (const areaId of sortedAreaIds) {
      const areaEntities = [...entitiesByArea[areaId]];
      const areaCustomizations = customizations.home?.entities_order?.[areaId];
      
      if (areaCustomizations) {
        const entityOrder = Array.isArray(areaCustomizations) ? areaCustomizations : [];
        if (entityOrder.length > 0) {
          areaEntities.sort((a, b) => {
            const aOrder = entityOrder.indexOf(a.entity_id);
            const bOrder = entityOrder.indexOf(b.entity_id);
            
            if (aOrder !== -1 && bOrder !== -1) {
              return aOrder - bOrder;
            }
            if (aOrder !== -1) return -1;
            if (bOrder !== -1) return 1;
            return 0;
          });
        }
      }
        
      if (customizations.home?.tall_cards) {
        areaEntities.forEach(entity => {
          if (customizations.home.tall_cards.includes(entity.entity_id)) {
            (entity as any).is_tall = true;
          } else if (customizations.home.tall_cards.includes(`!${entity.entity_id}`)) {
            (entity as any).is_tall = false;
          }
        });
      }
      
      result[areaId] = areaEntities;
    }
    
    return result;
  }
}
