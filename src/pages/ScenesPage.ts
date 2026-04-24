import { CustomizationManager } from '../utils/CustomizationManager';
import { DataService } from '../utils/DataService';
import { DashboardConfig } from '../config/DashboardConfig';
import { Entity } from '../types/types';
import { DragAndDropManager } from '../utils/DragAndDropManager';
import { localize } from '../utils/LocalizationService';

export class ScenesPage {
  private customizationManager?: CustomizationManager;
  private dragAndDropManager?: DragAndDropManager;
  private _hass?: any;
  private _config?: any;
  private _container?: HTMLElement;

  constructor() {
  }

  set hass(hass: any) {
    this._hass = hass;
  }

  async setConfig(config: any) {
    this._config = config;
    
    if (config.customizations && this._hass) {
      this.customizationManager = CustomizationManager.getInstance(this._hass);
      await this.customizationManager.setCustomizations(config.customizations);
      
      this.dragAndDropManager = new DragAndDropManager(
        (areaId) => this.handleSaveCurrentOrder(areaId),
        this.customizationManager,
        'scenes'
      );
    }
  }

  private createScenesTitle(): HTMLElement {
    const titleElement = document.createElement('h1');
    titleElement.className = 'apple-page-title';
    titleElement.textContent = localize('pages.scenes');
    return titleElement;
  }

  async render(
    container: HTMLElement,
    hass: any,
    onTallToggle?: (entityId: string, areaId: string) => void | Promise<void | boolean>
  ): Promise<void> {
    this._container = container;
    const permanentSelectors = ['.apple-home-header', '.permanent-chips'];
    Array.from(container.children).forEach(child => {
      const isPermanent = permanentSelectors.some(sel => child.matches(sel));
      if (!isPermanent) child.remove();
    });

    const scenesTitle = this.createScenesTitle();
    const existingPermanentChips = container.querySelector('.permanent-chips');
    if (existingPermanentChips) {
      container.insertBefore(scenesTitle, existingPermanentChips);
    } else {
      container.appendChild(scenesTitle);
    }

    try {
      const entities = await DataService.getEntities(hass);
      
      const allScenesEntities = entities.filter(entity => {
        const domain = entity.entity_id.split('.')[0];
        return DashboardConfig.isScenesDomain(domain);
      });

      const scenesEntities = [];
      for (const entity of allScenesEntities) {
        const isExcluded = await this.customizationManager?.isEntityExcludedFromDashboard(entity.entity_id) || false;
        if (!isExcluded) {
          scenesEntities.push(entity);
        }
      }

      if (!this.customizationManager) {
        throw new Error(localize('errors.customization_manager_not_initialized'));
      }
      
      const customizations = this.customizationManager.getCustomizations();
      
      let sortedScenes = [...scenesEntities];
      const savedOrder = this.customizationManager.getSavedCardOrderWithContext('scenes_section', 'scenes');
      
      if (savedOrder.length > 0) {
        const entityMap = new Map(scenesEntities.map(entity => [entity.entity_id, entity]));
        const orderedScenes: Entity[] = [];
        
        savedOrder.forEach((entityId: string) => {
          if (entityMap.has(entityId)) {
            orderedScenes.push(entityMap.get(entityId)!);
            entityMap.delete(entityId);
          }
        });
        
        const remainingScenes = Array.from(entityMap.values());
        orderedScenes.push(...remainingScenes);
        
        sortedScenes = orderedScenes;
      }

      sortedScenes.forEach(entity => {
        (entity as any).is_tall = false;
      });

      await this.renderScenesGrid(
        container,
        sortedScenes,
        hass,
        onTallToggle
      );
      
    } catch (error) {
      console.error('Error rendering scenes page:', error);
    }
  }

  private async renderScenesGrid(
    container: HTMLElement,
    scenesEntities: Entity[],
    hass: any,
    onTallToggle?: (entityId: string, areaId: string) => void | Promise<void | boolean>
  ): Promise<void> {
    if (!this.customizationManager) {
      throw new Error(localize('errors.customization_manager_not_initialized'));
    }

    const gridContainer = document.createElement('div');
    gridContainer.className = 'scenes-grid';
    gridContainer.dataset.areaId = 'scenes_section';
    gridContainer.dataset.sectionType = 'scenes';

    for (const entity of scenesEntities) {
      const cardConfig = this.createEntityCard(entity.entity_id, hass, entity);
      if (cardConfig) {
        cardConfig.section_type = 'scenes';
        await this.createAndAppendCard(cardConfig, gridContainer, hass, onTallToggle);
      }
    }

    container.appendChild(gridContainer);
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
      area_id: 'scenes_section',
      is_tall: (entity as any).is_tall !== undefined ? (entity as any).is_tall : false,
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
    wrapper.dataset.areaId = 'scenes_section';
    
    if (cardConfig.is_tall) {
      wrapper.classList.add('tall');
    }

    const cardElement = document.createElement('apple-home-card') as any;
    cardElement.setConfig(cardConfig);
    cardElement.hass = hass;

    const controls = document.createElement('div');
    controls.className = 'entity-controls';
    
    wrapper.appendChild(controls);
    wrapper.appendChild(cardElement);
    gridContainer.appendChild(wrapper);
  }

  public updateDragAndDrop(editMode: boolean, container: HTMLElement) {
    if (!this.dragAndDropManager) return;
    
    if (editMode) {
      setTimeout(() => {
        this.dragAndDropManager!.enableDragAndDrop(container);
        const entityWrappers = container.querySelectorAll('.entity-card-wrapper');
        entityWrappers.forEach((wrapper) => {
          const element = wrapper as HTMLElement;
          element.classList.toggle('edit-mode', true);
          
          const appleHomeCard = element.querySelector('apple-home-card') as any;
          if (appleHomeCard && typeof appleHomeCard.refreshEditMode === 'function') {
            appleHomeCard.refreshEditMode();
          }
        });
      }, 100);
    } else {
      this.dragAndDropManager.disableDragAndDrop(container);
      const entityWrappers = container.querySelectorAll('.entity-card-wrapper');
      entityWrappers.forEach((wrapper) => {
        const element = wrapper as HTMLElement;
        element.classList.toggle('edit-mode', false);
        
        const appleHomeCard = element.querySelector('apple-home-card') as any;
        if (appleHomeCard && typeof appleHomeCard.refreshEditMode === 'function') {
          appleHomeCard.refreshEditMode();
        }
      });
    }
  }

  private handleSaveCurrentOrder(areaId: string) {
    if (!this._container) {
      return;
    }
    
    const areaContainer = this._container.querySelector(`[data-area-id="${areaId}"]`);
    if (!areaContainer) {
      return;
    }

    const wrappers = areaContainer.querySelectorAll('.entity-card-wrapper:not(.drag-placeholder)');
    const entityOrder = Array.from(wrappers).map(wrapper => {
      const element = wrapper as HTMLElement;
      return element.dataset.entityId || '';
    }).filter(id => id);

    if (this.customizationManager) {
      this.customizationManager.saveCardOrderWithContext(areaId, entityOrder, 'scenes');
    }
  }
}
