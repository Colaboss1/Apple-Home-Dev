import { CustomizationManager } from '../utils/CustomizationManager';
import { CardManager } from '../utils/CardManager';
import { DataService } from '../utils/DataService';
import { DashboardConfig, DeviceGroup } from '../config/DashboardConfig';
import { ScenesSection } from '../sections/ScenesSection';
import { CamerasSection } from '../sections/CamerasSection';
import { AreaSection } from '../sections/AreaSection';
import { StatusSection } from '../sections/StatusSection';
import { Entity } from '../types/types';
import { localize } from '../utils/LocalizationService';

export class RoomPage {
  private customizationManager?: CustomizationManager;
  private cardManager?: CardManager;
  private scenesSection?: ScenesSection;
  private camerasSection?: CamerasSection;
  private areaSection?: AreaSection;
  private statusSection?: StatusSection;
  private _hass?: any;
  private _areaId?: string;
  private _config?: any;
  private _container?: HTMLElement;

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
    this._areaId = config.areaId;
    
    if (config.customizations && this._hass) {
      this.customizationManager = CustomizationManager.getInstance(this._hass);
      this.cardManager = new CardManager(this.customizationManager);
      await this.customizationManager.setCustomizations(config.customizations);
      this.initializeSections();
    }
  }

  private initializeSections() {
    if (this.customizationManager) {
      this.scenesSection = new ScenesSection(this.customizationManager, this.cardManager);
      this.camerasSection = new CamerasSection(this.customizationManager, this.cardManager);
      this.areaSection = new AreaSection(this.customizationManager, this.cardManager);
      this.statusSection = new StatusSection(this.customizationManager, this.cardManager);
    }
  }

  private createRoomTitle(areaName: string): HTMLElement {
    const titleElement = document.createElement('h1');
    titleElement.className = 'apple-page-title';
    titleElement.textContent = areaName;
    return titleElement;
  }

  async render(
    container: HTMLElement,
    areaId: string,
    areaName: string,
    hass: any,
    onTallToggle?: (entityId: string, areaId: string) => void | Promise<void | boolean>
  ): Promise<void> {
    this._container = container;
    
    const permanentSelectors = ['.apple-home-header', '.permanent-chips'];
    Array.from(container.children).forEach(child => {
      const isPermanent = permanentSelectors.some(sel => child.matches(sel));
      if (!isPermanent) child.remove();
    });

    const roomTitle = this.createRoomTitle(areaName);
    const existingPermanentChips = container.querySelector('.permanent-chips');
    if (existingPermanentChips) {
      container.insertBefore(roomTitle, existingPermanentChips);
    } else {
      container.appendChild(roomTitle);
    }

    try {
      const [areas, entities, devices, showSwitches, includedSwitches, extraAccessories] = await Promise.all([
        DataService.getAreas(hass),
        DataService.getEntities(hass),
        DataService.getDevices(hass),
        this.customizationManager?.getShowSwitches().then(v => v || false) ?? Promise.resolve(false),
        this.customizationManager?.getIncludedSwitches().then(v => v || []) ?? Promise.resolve([] as string[]),
        this.customizationManager?.getExtraAccessories().then(v => v || []) ?? Promise.resolve([] as string[])
      ]);
      
      const supportedEntities = entities.filter(entity => {
        const domain = entity.entity_id.split('.')[0];

        if (extraAccessories.includes(entity.entity_id)) {
          return true;
        }

        if (entity.entity_category === 'config' || entity.entity_category === 'diagnostic') {
          return false;
        }

        if (!DashboardConfig.isSupportedDomain(domain)) {
          return false;
        }
        
        if (domain === 'switch') {
          const entityState = hass.states[entity.entity_id];
          
          if (showSwitches) {
            const entityGroup = DashboardConfig.getDeviceGroup(domain, entity.entity_id, entityState?.attributes, showSwitches);
            return entityGroup !== undefined;
          } else {
            const isOutlet = DashboardConfig.isOutlet(entity.entity_id, entityState?.attributes);
            const isIncluded = includedSwitches.includes(entity.entity_id);
            return isOutlet || isIncluded;
          }
        }
        
        return true;
      });

      const statusEntities = entities.filter(entity => {
        if (entity.entity_category === 'config' || entity.entity_category === 'diagnostic') {
          return false;
        }
        const domain = entity.entity_id.split('.')[0];

        if (!DashboardConfig.isStatusDomain(domain)) {
          return false;
        }
        
        if (domain === 'switch') {
          const entityState = hass.states[entity.entity_id];
          
          if (showSwitches) {
            const entityGroup = DashboardConfig.getDeviceGroup(domain, entity.entity_id, entityState?.attributes, showSwitches);
            return entityGroup !== undefined;
          } else {
            const isOutlet = DashboardConfig.isOutlet(entity.entity_id, entityState?.attributes);
            const isIncluded = includedSwitches.includes(entity.entity_id);
            return isOutlet || isIncluded;
          }
        }
        
        return true;
      });

      const excludedFromDashboard = new Set(await this.customizationManager?.getExcludedFromDashboard() || []);

      const filteredEntities = supportedEntities.filter(entity => !excludedFromDashboard.has(entity.entity_id));
      const filteredStatusEntities = statusEntities.filter(entity => !excludedFromDashboard.has(entity.entity_id));
      
      const entitiesByArea = DataService.groupEntitiesByArea(filteredEntities, areas, devices);
      const statusEntitiesByArea = DataService.groupEntitiesByArea(filteredStatusEntities, areas, devices);
      
      const areaEntities = entitiesByArea[areaId] || [];
      const statusAreaEntities = statusEntitiesByArea[areaId] || [];
      
      if (this.statusSection && statusAreaEntities.length > 0) {
        await this.statusSection.render(container, statusAreaEntities, hass, areaId);
      }
      
      const entitiesByGroup: { [group: string]: Entity[] } = {};
      const deviceGroups = [
        DeviceGroup.LIGHTING,
        DeviceGroup.CLIMATE, 
        DeviceGroup.SECURITY,
        DeviceGroup.MEDIA,
        DeviceGroup.WATER,
        DeviceGroup.OTHER
      ];

      deviceGroups.forEach(group => {
        entitiesByGroup[group] = [];
      });

      areaEntities.forEach(entity => {
        const domain = entity.entity_id.split('.')[0];
        const entityState = this.hass?.states[entity.entity_id];
        
        let entityGroup: DeviceGroup | undefined;
        
        if (domain === 'switch' && !showSwitches) {
          const isOutlet = DashboardConfig.isOutlet(entity.entity_id, entityState?.attributes);
          const isIncluded = includedSwitches.includes(entity.entity_id);
          
          if (isOutlet || isIncluded) {
            entityGroup = DeviceGroup.OTHER;
          } else {
            entityGroup = undefined;
          }
        } else {
          entityGroup = DashboardConfig.getDeviceGroup(domain, entity.entity_id, entityState?.attributes, showSwitches);
        }
        
        if (entityGroup && deviceGroups.includes(entityGroup)) {
          entitiesByGroup[entityGroup].push(entity);
        }
      });

      const cameraEntities = entitiesByGroup[DeviceGroup.SECURITY].filter(entity => 
        entity.entity_id.split('.')[0] === 'camera'
      );
      
      entitiesByGroup[DeviceGroup.SECURITY] = entitiesByGroup[DeviceGroup.SECURITY].filter(entity => 
        entity.entity_id.split('.')[0] !== 'camera'
      );

      if (!this.customizationManager) {
        throw new Error('CustomizationManager not initialized');
      }
      
      const customizations = this.customizationManager.getCustomizations();
      
      const pageCustomizations = customizations.pages?.[areaId];
      if (pageCustomizations) {
        deviceGroups.forEach(group => {
          const groupEntities = entitiesByGroup[group];
          const groupOrderKey = `${group.toLowerCase()}_order`;
          const groupOrder = pageCustomizations[groupOrderKey];
          
          if (groupEntities.length > 0 && groupOrder && Array.isArray(groupOrder)) {
            const sortedEntities = [...groupEntities].sort((a, b) => {
              const aOrder = groupOrder.indexOf(a.entity_id);
              const bOrder = groupOrder.indexOf(b.entity_id);
              
              if (aOrder !== -1 && bOrder !== -1) {
                return aOrder - bOrder;
              }
              if (aOrder !== -1) return -1;
              if (bOrder !== -1) return 1;
              return 0;
            });
            entitiesByGroup[group] = sortedEntities;
          }
          
          if (pageCustomizations.tall_cards) {
            entitiesByGroup[group].forEach(entity => {
              if (pageCustomizations.tall_cards.includes(entity.entity_id)) {
                (entity as any).is_tall = true;
              } else if (pageCustomizations.tall_cards.includes(`!${entity.entity_id}`)) {
                (entity as any).is_tall = false;
              }
            });
          }
        });
      }

      if (cameraEntities.length > 0) {
        await this.renderCamerasSection(container, cameraEntities, hass, onTallToggle);
      }

      await this.renderGroupedSections(
        container,
        entitiesByGroup,
        hass,
        onTallToggle
      );
      
    } catch (error) {
      console.error('Error rendering room page:', error);
    }
  }

  private async renderGroupedSections(
    container: HTMLElement,
    entitiesByGroup: { [group: string]: Entity[] },
    hass: any,
    onTallToggle?: (entityId: string, areaId: string) => void | Promise<void | boolean>
  ): Promise<void> {
    if (!this.customizationManager || !this.areaSection) {
      throw new Error('Required sections not initialized');
    }

    const groupOrder = [
      DeviceGroup.LIGHTING,
      DeviceGroup.CLIMATE,
      DeviceGroup.SECURITY,
      DeviceGroup.MEDIA,
      DeviceGroup.OTHER
    ];

    for (const group of groupOrder) {
      const groupEntities = entitiesByGroup[group];
      
      if (!groupEntities || groupEntities.length === 0) {
        continue;
      }

      const groupStyle = DashboardConfig.getGroupStyle(group);
      
      const titleDiv = document.createElement('div');
      titleDiv.className = 'apple-home-section-title';
      titleDiv.innerHTML = `<span>${typeof groupStyle.name === 'function' ? groupStyle.name() : groupStyle.name}</span>`;
      container.appendChild(titleDiv);

      const gridContainer = document.createElement('div');
      gridContainer.className = 'room-group-grid';
      gridContainer.dataset.areaId = this._areaId;
      gridContainer.dataset.sectionType = 'room-group';
      gridContainer.dataset.deviceGroup = group;

      const savedOrder = this.customizationManager?.getSavedCardOrderWithContext(this._areaId!, this._areaId!, group);
      let orderedEntities = [...groupEntities];
      
      if (savedOrder && savedOrder.length > 0 && this.customizationManager) {
        orderedEntities = this.customizationManager.applySavedCardOrder(groupEntities, savedOrder);
      }

      for (const entity of orderedEntities) {
        const cardConfig = this.createEntityCard(entity.entity_id, hass, entity);
        if (cardConfig) {
          cardConfig.section_type = 'room-group';
          await this.createAndAppendCard(cardConfig, gridContainer, hass, onTallToggle);
        }
      }

      container.appendChild(gridContainer);
    }
  }

  private async renderCamerasSection(
    container: HTMLElement,
    cameraEntities: Entity[],
    hass: any,
    onTallToggle?: (entityId: string, areaId: string) => void | Promise<void | boolean>
  ): Promise<void> {
    if (!this.camerasSection || !this.customizationManager) {
      return;
    }

    const cameraSectionId = `${this._areaId}_cameras`;
    await this.camerasSection.render(
      container,
      cameraEntities,
      hass,
      onTallToggle,
      'room',
      false,
      cameraSectionId
    );
  }

  private createEntityCard(entityId: string, hass: any, entity: Entity): any {
    if (!this.customizationManager) return null;

    const domain = entityId.split('.')[0];
    const stateObj = hass.states[entityId];
    
    if (!stateObj) return null;

    const customizations = this.customizationManager.getCustomizations();
    const entityCustomizations = customizations.entities?.[entityId] || null;
    
    const cardConfig: any = {
      type: 'custom:apple-home-card',
      entity: entityId,
      name: entityCustomizations?.name || stateObj.attributes.friendly_name || entityId,
      area_id: entity.area_id,
      is_tall: this.cardManager?.shouldCardBeTall(entityId, this._areaId || 'unknown', this._areaId!) || false,
      ...entityCustomizations
    };

    return cardConfig;
  }

  private async createAndAppendCard(
    cardConfig: any,
    gridContainer: HTMLElement,
    hass: any,
    onTallToggle?: (entityId: string, areaId: string) => void | Promise<void | boolean>
  ): Promise<void> {
    const wrapper = document.createElement('div');
    wrapper.className = 'entity-card-wrapper';
    wrapper.dataset.entityId = cardConfig.entity;
    wrapper.dataset.areaId = this._areaId || 'unknown';
    
    if (cardConfig.is_tall) {
      wrapper.classList.add('tall');
    }

    const cardElement = document.createElement('apple-home-card') as any;
    cardElement.setConfig(cardConfig);
    cardElement.hass = hass;

    const controls = document.createElement('div');
    controls.className = 'entity-controls';
    
    const tallButton = document.createElement('button');
    tallButton.className = 'entity-control-btn tall-toggle';
    tallButton.innerHTML = `<ha-icon icon="mdi:${cardConfig.is_tall ? 'arrow-collapse' : 'arrow-expand'}"></ha-icon>`;
    tallButton.title = cardConfig.is_tall ? localize('edit.make_normal_size') : localize('edit.make_tall');
    tallButton.classList.toggle('active', cardConfig.is_tall);
    
    tallButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (onTallToggle) {
        const newTallState = await onTallToggle(cardConfig.entity, this._areaId || 'unknown');
        const actualTallState = this.cardManager?.shouldCardBeTall(cardConfig.entity, this._areaId || 'unknown', this._areaId!) || false;
        this.updateTallCardVisual(wrapper, tallButton, cardConfig, actualTallState);
      }
    });

    controls.appendChild(tallButton);
    wrapper.appendChild(controls);
    wrapper.appendChild(cardElement);
    gridContainer.appendChild(wrapper);
  }

  private updateTallCardVisual(
    wrapper: HTMLElement,
    tallButton: HTMLElement,
    cardConfig: any,
    shouldBeTall: boolean
  ): void {
    wrapper.classList.toggle('tall', shouldBeTall);
    tallButton.classList.toggle('active', shouldBeTall);
    tallButton.title = shouldBeTall ? localize('edit.make_normal_size') : localize('edit.make_tall');
    
    const iconElement = tallButton.querySelector('ha-icon');
    if (iconElement) {
      iconElement.setAttribute('icon', shouldBeTall ? 'mdi:arrow-collapse' : 'mdi:arrow-expand');
    }
    
    cardConfig.is_tall = shouldBeTall;
    
    const cardElement = wrapper.querySelector('hui-card, ha-card, [is-card]') as any;
    if (cardElement) {
    }
  }
}
