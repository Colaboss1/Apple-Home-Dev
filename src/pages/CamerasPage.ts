import { CustomizationManager } from '../utils/CustomizationManager';
import { DataService } from '../utils/DataService';
import { DashboardConfig } from '../config/DashboardConfig';
import { Entity } from '../types/types';
import { DragAndDropManager } from '../utils/DragAndDropManager';
import { localize } from '../utils/LocalizationService';

export class CamerasPage {
  private _container?: HTMLElement;
  private customizationManager?: CustomizationManager;
  private dragAndDropManager?: DragAndDropManager;
  private _hass?: any;
  private _config?: any;

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
        'cameras'
      );
    }
  }

  private createCamerasTitle(): HTMLElement {
    const titleElement = document.createElement('h1');
    titleElement.className = 'apple-page-title';
    titleElement.textContent = localize('pages.cameras');
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

    const camerasTitle = this.createCamerasTitle();
    const existingPermanentChips = container.querySelector('.permanent-chips');
    if (existingPermanentChips) {
      container.insertBefore(camerasTitle, existingPermanentChips);
    } else {
      container.appendChild(camerasTitle);
    }

    try {
      const entities = await DataService.getEntities(hass);
      
      const allCamerasEntities = entities.filter(entity => {
        const domain = entity.entity_id.split('.')[0];
        return DashboardConfig.isCamerasDomain(domain);
      });

      const camerasEntities = [];
      for (const entity of allCamerasEntities) {
        const isExcluded = await this.customizationManager?.isEntityExcludedFromDashboard(entity.entity_id) || false;
        if (!isExcluded) {
          camerasEntities.push(entity);
        }
      }

      if (!this.customizationManager) {
        throw new Error(localize('errors.customization_manager_not_initialized'));
      }
      
      const customizations = this.customizationManager.getCustomizations();
      
      let sortedCameras = [...camerasEntities];
      const savedOrder = this.customizationManager.getSavedCardOrderWithContext('cameras_section', 'cameras');
      
      if (savedOrder.length > 0) {
        const entityMap = new Map(camerasEntities.map(entity => [entity.entity_id, entity]));
        const orderedCameras: Entity[] = [];
        
        savedOrder.forEach((entityId: string) => {
          if (entityMap.has(entityId)) {
            orderedCameras.push(entityMap.get(entityId)!);
            entityMap.delete(entityId);
          }
        });
        
        const remainingCameras = Array.from(entityMap.values());
        orderedCameras.push(...remainingCameras);
        
        sortedCameras = orderedCameras;
      }

      sortedCameras.forEach(entity => {
        (entity as any).is_tall = true;
      });

      await this.renderCamerasGrid(
        container,
        sortedCameras,
        hass,
        onTallToggle
      );
      
    } catch (error) {
      console.error('Error rendering cameras page:', error);
    }
  }

  private async renderCamerasGrid(
    container: HTMLElement,
    camerasEntities: Entity[],
    hass: any,
    onTallToggle?: (entityId: string, areaId: string) => void | Promise<void | boolean>
  ): Promise<void> {
    if (!this.customizationManager) {
      throw new Error(localize('errors.customization_manager_not_initialized'));
    }

    const gridContainer = document.createElement('div');
    gridContainer.className = 'cameras-grid';
    gridContainer.dataset.areaId = 'cameras_section';
    gridContainer.dataset.sectionType = 'cameras';

    for (const entity of camerasEntities) {
      const cardConfig = this.createEntityCard(entity.entity_id, hass, entity);
      if (cardConfig) {
        cardConfig.section_type = 'cameras';
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
      area_id: 'cameras_section',
      is_tall: (entity as any).is_tall !== undefined ? (entity as any).is_tall : true,
      camera_view: 'snapshot',
      refresh_interval: 10000,
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
    wrapper.dataset.areaId = 'cameras_section';
    
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
      this.dragAndDropManager.destroy();
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
      this.customizationManager.saveCardOrderWithContext(areaId, entityOrder, 'cameras');
    }
  }
}
