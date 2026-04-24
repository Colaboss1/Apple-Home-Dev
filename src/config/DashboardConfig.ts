import { EntityData, EntityState } from '../types/types';
import { localize } from '../utils/LocalizationService';

export enum DeviceGroup {
  LIGHTING = 'lighting',
  CLIMATE = 'climate', 
  SECURITY = 'security',
  WATER = 'water',
  MEDIA = 'media',
  VACUUM = 'vacuum',
  ENERGY = 'energy',
  OTHER = 'other'
}

export interface GroupStyle {
  iconColor: string;
  activeIconColor?: string;
  icon: string;
  name: string | (() => string);
}

const CLIMATE_MODE_COLORS = {
  heat: '#ff8d13',
  heating: '#ff8d13',
  cool: '#48a0ff',
  cooling: '#48a0ff',
  auto: '#34c759',
  heat_cool: '#34c759',
  dry: '#466680',
  fan_only: '#000000',
  off: '#ffffff',
  eco: '#34c759',
  electric: '#ff8d13',
  performance: '#ff8d13',
  high_demand: '#ff8d13',
  heat_pump: '#ff8d13',
  gas: '#ff8d13'
};

export class DashboardConfig {
  static readonly GROUP_STYLES: Record<DeviceGroup, GroupStyle> = {
    [DeviceGroup.LIGHTING]: {
      iconColor: '#ffcc06',
      icon: 'mdi:lightbulb',
      name: () => localize('groups.lights')
    },
    [DeviceGroup.CLIMATE]: {
      iconColor: '#00c0e8',
      icon: 'mdi:fan',
      name: () => localize('groups.climate')
    },
    [DeviceGroup.SECURITY]: {
      iconColor: '#00cbbf',
      icon: 'mdi:lock',
      name: () => localize('groups.security')
    },
    [DeviceGroup.WATER]: {
      iconColor: '#0b78f6',
      icon: 'mdi:water-outline',
      name: () => localize('groups.water')
    },
    [DeviceGroup.MEDIA]: {
      iconColor: '#ffffff',
      activeIconColor: '#696969',
      icon: 'mdi:speaker',
      name: () => localize('groups.media')
    },
    [DeviceGroup.VACUUM]: {
      iconColor: '#ff9500',
      icon: 'mdi:robot-vacuum',
      name: () => localize('groups.vacuum')
    },
    [DeviceGroup.ENERGY]: {
      iconColor: '#34C759',
      icon: 'mdi:flash',
      name: () => localize('groups.energy')
    },
    [DeviceGroup.OTHER]: {
      iconColor: '#ffcc0f',
      icon: 'mdi:light-switch',
      name: () => localize('groups.other')
    }
  };

  static readonly DOMAIN_TO_GROUP: Record<string, DeviceGroup> = {
    'light': DeviceGroup.LIGHTING,
    'switch': DeviceGroup.OTHER,
    'climate': DeviceGroup.CLIMATE,
    'fan': DeviceGroup.CLIMATE,
    'cover': DeviceGroup.CLIMATE,
    'lock': DeviceGroup.SECURITY,
    'alarm_control_panel': DeviceGroup.SECURITY,
    'media_player': DeviceGroup.MEDIA,
    'camera': DeviceGroup.SECURITY,
    'binary_sensor': DeviceGroup.SECURITY,
    'sensor': DeviceGroup.SECURITY,
    'vacuum': DeviceGroup.VACUUM,
    'water_heater': DeviceGroup.CLIMATE
  };

  static readonly SUPPORTED_DOMAINS = [
    'light', 'switch', 'cover', 'climate', 'fan', 'media_player',
    'lock', 'alarm_control_panel', 'scene', 'script', 'camera', 'vacuum', 'water_heater'
  ] as const;

  static readonly STATUS_SECTION_DOMAINS = [
    'sensor', 'binary_sensor'
  ] as const;

  static readonly SCENES_DOMAINS = ['scene', 'script'] as const;

  static readonly CAMERAS_DOMAINS = ['camera'] as const;

  static readonly DEFAULT_TALL_DOMAINS = ['climate', 'lock', 'alarm_control_panel', 'camera', 'vacuum', 'water_heater'] as const;

  private static readonly INACTIVE_STYLE = {
    backgroundColor: 'var(--apple-card-bg-inactive, rgba(0, 0, 0, 0.25))',
    iconColor: 'var(--apple-icon-inactive, rgba(142, 142, 147, 0.8))',
    iconBackgroundColor: 'var(--apple-icon-bg-inactive, rgba(0, 0, 0, 0.2))',
    textColor: 'var(--apple-text-inactive, #ffffff)'
  };

  private static readonly ACTIVE_BASE_STYLE = {
    backgroundColor: 'var(--apple-card-bg-active, #ffffff)',
    textColor: 'var(--apple-text-active, #1d1d1f)'
  };

  static isGarageDoorOrGate(entityId: string, attributes: any): boolean {
    const deviceClass = attributes?.device_class?.toLowerCase();
    return (deviceClass === 'garage' || deviceClass === 'gate');
  }

  static isOutlet(entityId: string, attributes: any): boolean {
    const deviceClass = attributes?.device_class?.toLowerCase();
    return deviceClass === 'outlet';
  }

  static getDeviceGroup(domain: string, entityId?: string, attributes?: any, showSwitches?: boolean): DeviceGroup | undefined {
    if (domain === 'cover' && entityId && attributes) {
      if (this.isGarageDoorOrGate(entityId, attributes)) {
        return DeviceGroup.SECURITY;
      }
    }
    
    if (domain === 'switch' && entityId && attributes) {
      if (this.isOutlet(entityId, attributes)) {
        return DeviceGroup.OTHER;
      } else if (showSwitches === true) {
        return DeviceGroup.OTHER;
      } else if (showSwitches === undefined) {
        return DeviceGroup.OTHER;
      } else {
        return undefined;
      }
    }
    
    if (domain === 'sensor' && attributes) {
      const deviceClass = attributes.device_class;
      const unitOfMeasurement = attributes.unit_of_measurement;
      
      if (deviceClass === 'temperature' || unitOfMeasurement === '°C' || unitOfMeasurement === '°F') {
        return DeviceGroup.CLIMATE;
      }
      if (deviceClass === 'humidity') {
        return DeviceGroup.CLIMATE;
      }
      if (deviceClass === 'illuminance' || unitOfMeasurement === 'lx') {
        return DeviceGroup.LIGHTING;
      }
      if (deviceClass === 'energy' || deviceClass === 'power') {
        return DeviceGroup.ENERGY;
      }
      if (deviceClass === 'battery') {
        return DeviceGroup.OTHER;
      }
      return DeviceGroup.SECURITY;
    }
    
    if (domain === 'binary_sensor' && attributes) {
      const deviceClass = attributes.device_class;
      
      if (deviceClass === 'motion' || deviceClass === 'occupancy') {
        return DeviceGroup.SECURITY;
      }
      if (deviceClass === 'door' || deviceClass === 'window' || deviceClass === 'opening' || 
          deviceClass === 'garage_door' || deviceClass === 'lock') {
        return DeviceGroup.SECURITY;
      }
      if (deviceClass === 'smoke' || deviceClass === 'gas' || deviceClass === 'carbon_monoxide') {
        return DeviceGroup.SECURITY;
      }
      if (deviceClass === 'light') {
        return DeviceGroup.LIGHTING;
      }
      return DeviceGroup.SECURITY;
    }
    
    return this.DOMAIN_TO_GROUP[domain];
  }

  static getGroupStyle(group: DeviceGroup): GroupStyle {
    return this.GROUP_STYLES[group];
  }

  static isSupportedDomain(domain: string): boolean {
    return this.SUPPORTED_DOMAINS.includes(domain as any);
  }

  static isStatusDomain(domain: string): boolean {
    return this.SUPPORTED_DOMAINS.includes(domain as any) || 
           this.STATUS_SECTION_DOMAINS.includes(domain as any);
  }

  static isScenesDomain(domain: string): boolean {
    return this.SCENES_DOMAINS.includes(domain as any);
  }

  static isCamerasDomain(domain: string): boolean {
    return this.CAMERAS_DOMAINS.includes(domain as any);
  }

  static isSpecialSectionDomain(domain: string): boolean {
    return this.isScenesDomain(domain) || this.isCamerasDomain(domain);
  }

  static isDefaultTallDomain(domain: string): boolean {
    return this.DEFAULT_TALL_DOMAINS.includes(domain as any);
  }

  private static applyGroupStyling(group: DeviceGroup): Partial<EntityData> {
    const groupStyle = this.getGroupStyle(group);
    const iconColor = groupStyle.activeIconColor || '#ffffff';
    
    return {
      ...this.ACTIVE_BASE_STYLE,
      iconBackgroundColor: groupStyle.iconColor,
      iconColor
    };
  }

  private static applyInactiveStyling(group?: DeviceGroup): Partial<EntityData> {
    if (group) {
      const groupStyle = this.getGroupStyle(group);
      return {
        ...this.INACTIVE_STYLE,
        iconColor: groupStyle.iconColor
      };
    }
    return this.INACTIVE_STYLE;
  }

  private static getFallbackIcon(domain: string, entityState: string, attributes: any, entityId?: string): string {
    switch (domain) {
      case 'light':
        return 'mdi:lightbulb-outline';
      case 'switch':
        if (entityId && this.isOutlet(entityId, attributes)) {
          return 'mdi:power-plug-outline';
        }
        return 'mdi:toggle-switch-outline';
      case 'cover':
        if (entityId && this.isGarageDoorOrGate(entityId, attributes)) {
          switch (entityState) {
            case 'opening':
              return 'mdi:garage-open';
            case 'closing':
              return 'mdi:garage';
            case 'open':
              return 'mdi:garage-open';
            case 'closed':
            default:
              return 'mdi:garage';
          }
        }
        if (entityState === 'opening' || entityState === 'closing') {
          return 'mdi:window-shutter-cog';
        }
        return entityState === 'open' ? 'mdi:window-shutter-open' : 'mdi:window-shutter';
      case 'climate':
        return 'mdi:thermostat';
      case 'water_heater':
        return 'mdi:water-boiler';
      case 'fan':
        return 'mdi:fan';
      case 'media_player':
        return this.getMediaPlayerIcon(entityState, attributes);
      case 'lock':
        return entityState === 'unlocked' ? 'mdi:lock-open-outline' : 'mdi:lock-outline';
      case 'alarm_control_panel':
        return 'mdi:alarm-light';
      case 'button':
        return 'mdi:gesture-tap-button';
      case 'input_boolean':
        return entityState === 'on' ? 'mdi:toggle-switch' : 'mdi:toggle-switch-off';
      case 'input_button':
        return 'mdi:gesture-tap-button';
      case 'vacuum':
        return entityState === 'cleaning' ? 'mdi:robot-vacuum' : 'mdi:robot-vacuum';
      case 'sensor': {
        const dc = attributes?.device_class;
        if (dc === 'energy') return 'mdi:flash';
        if (dc === 'power') return 'mdi:flash';
        if (dc === 'temperature') return 'mdi:thermometer';
        if (dc === 'humidity') return 'mdi:water-percent';
        if (dc === 'battery') return 'mdi:battery';
        if (dc === 'illuminance') return 'mdi:brightness-5';
        return 'mdi:eye';
      }
      case 'binary_sensor': {
        const bdc = attributes?.device_class;
        if (bdc === 'motion') return entityState === 'on' ? 'mdi:motion-sensor' : 'mdi:motion-sensor-off';
        if (bdc === 'door') return entityState === 'on' ? 'mdi:door-open' : 'mdi:door-closed';
        if (bdc === 'window') return entityState === 'on' ? 'mdi:window-open' : 'mdi:window-closed';
        if (bdc === 'smoke') return 'mdi:smoke-detector';
        if (bdc === 'gas') return 'mdi:gas-cylinder';
        if (bdc === 'moisture') return 'mdi:water-alert';
        if (bdc === 'occupancy') return 'mdi:home-account';
        if (bdc === 'light') return 'mdi:brightness-5';
        return entityState === 'on' ? 'mdi:checkbox-marked-circle' : 'mdi:checkbox-blank-circle-outline';
      }
      default:
        return 'mdi:help-circle';
    }
  }

  private static applyClimateStyling(entityState: string, isActive: boolean): Partial<EntityData> {
    const climateColor = (CLIMATE_MODE_COLORS as any)[entityState] || (isActive ? CLIMATE_MODE_COLORS.heat : CLIMATE_MODE_COLORS.off);
    
    if (isActive) {
      return {
        ...this.ACTIVE_BASE_STYLE,
        iconBackgroundColor: 'transparent',
        iconColor: climateColor
      };
    } else {
      return {
        ...this.INACTIVE_STYLE,
        iconColor: climateColor
      };
    }
  }

  private static getMediaPlayerIcon(entityState: string, attributes: any): string {
    const deviceClass = attributes.device_class;
    
    switch (deviceClass) {
      case 'tv':
        return 'mdi:television';
      case 'speaker':
        return 'mdi:speaker';
      case 'receiver':
        return 'mdi:audio-video';
      case 'music':
        return 'mdi:music';
      default:
        return 'mdi:cast';
    }
  }

  static getEntityData(state: EntityState, domain: string, isTall: boolean = false, forceWhiteIcons: boolean = false, hass?: any): EntityData {
    const entityState = state.state;
    const attributes = state.attributes;
    const isUnavailableState = ['unavailable', 'unknown', 'none', 'null', ''].includes(entityState.toLowerCase());
    
    if (isUnavailableState) {
      return {
        isActive: false,
        backgroundColor: this.INACTIVE_STYLE.backgroundColor,
        iconColor: '#ffffff',
        iconBackgroundColor: this.INACTIVE_STYLE.iconBackgroundColor,
        textColor: this.INACTIVE_STYLE.textColor,
        stateText: this.getUnavailableStateText(entityState),
        icon: attributes.icon || this.getFallbackIcon(domain, entityState, attributes, state.entity_id)
      };
    }

    if (!this.isStatusDomain(domain)) {
      return this.handleUnsupportedDomain(entityState, attributes, domain, state.entity_id);
    }

    const deviceGroup = this.getDeviceGroup(domain, state.entity_id, attributes);
    const isActive = this.isEntityActive(domain, entityState, attributes);
    const icon = attributes.icon || this.getFallbackIcon(domain, entityState, attributes, state.entity_id);
    const stateText = this.getStateText(domain, entityState, attributes, hass);

    let styling: Partial<EntityData>;
    if (domain === 'climate' || domain === 'water_heater') {
      styling = this.applyClimateStyling(entityState, isActive);
    } else if (isActive && deviceGroup) {
      styling = this.applyGroupStyling(deviceGroup);
    } else {
      styling = this.applyInactiveStyling(deviceGroup);
    }

    if (forceWhiteIcons) {
      styling = {
        ...styling,
        iconColor: '#ffffff'
      };
    }

    return {
      isActive,
      backgroundColor: styling.backgroundColor || this.INACTIVE_STYLE.backgroundColor,
      iconColor: styling.iconColor || this.INACTIVE_STYLE.iconColor,
      iconBackgroundColor: styling.iconBackgroundColor || this.INACTIVE_STYLE.iconBackgroundColor,
      textColor: styling.textColor || this.INACTIVE_STYLE.textColor,
      stateText,
      icon
    };
  }

  private static isEntityActive(domain: string, entityState: string, attributes?: any): boolean {
    let result;
    switch (domain) {
      case 'light':
      case 'switch':
      case 'fan':
        result = entityState === 'on';
        break;
      case 'cover':
        result = entityState === 'open' || entityState === 'opening';
        break;
      case 'climate':
      case 'water_heater':
        result = entityState !== 'off';
        break;
      case 'media_player':
        result = ['playing', 'paused', 'buffering', 'on'].includes(entityState);
        break;
      case 'lock':
        result = entityState === 'unlocked';
        break;
      case 'alarm_control_panel':
        result = entityState !== 'disarmed';
        break;
      case 'binary_sensor':
        result = entityState === 'on';
        break;
      case 'sensor':
        result = true;
        break;
      case 'input_boolean':
        result = entityState === 'on';
        break;
      case 'button':
      case 'input_button':
        result = true;
        break;
      case 'vacuum':
        result = ['cleaning', 'returning', 'paused'].includes(entityState);
        break;
      default:
        result = ['on', 'active', 'enabled', 'open', 'unlocked'].includes(entityState.toLowerCase());
    }
    return result;
  }

  private static getStateText(domain: string, entityState: string, attributes: any, hass?: any): string {
    switch (domain) {
      case 'light':
        if (entityState === 'on' && attributes.brightness) {
          const brightness = Math.round((attributes.brightness / 255) * 100);
          return `${brightness}%`;
        }
        return entityState === 'on' ? localize('status.on') : localize('status.off');
      case 'switch':
        return entityState === 'on' ? localize('status.on') : localize('status.off');
      case 'cover':
        if (entityState === 'closed') {
          return localize('status.closed');
        } else if (entityState === 'open') {
          const position = attributes.current_position;
          if (typeof position === 'number' && position < 100 && position > 0) {
            return `${position}% ${localize('status.open')}`;
          }
          return localize('status.open');
        } else {
          return entityState.charAt(0).toUpperCase() + entityState.slice(1);
        }
      case 'climate':
        return this.getClimateStateText(entityState, attributes, hass);
      case 'water_heater':
        return this.getWaterHeaterStateText(entityState, attributes, hass);
      case 'fan':
        if (entityState === 'on' && attributes.percentage && typeof attributes.percentage === 'number') {
          return `${attributes.percentage}%`;
        }
        return entityState === 'on' ? localize('status.on') : localize('status.off');
      case 'media_player':
        return this.getMediaPlayerStateText(entityState);
      case 'lock':
        return this.getLockStateText(entityState);
      case 'alarm_control_panel':
        return this.getAlarmStateText(entityState);
      case 'binary_sensor':
        return this.getBinarySensorStateText(entityState, attributes);
      case 'sensor':
        return this.getSensorStateText(entityState, attributes);
      case 'input_boolean':
        return entityState === 'on' ? localize('status.on') : localize('status.off');
      case 'button':
      case 'input_button':
        return localize('status.press') || 'Press';
      case 'vacuum':
        return this.getVacuumStateText(entityState, attributes);
      default:
        return entityState === 'on' ? localize('status.on') : localize('status.off');
    }
  }

  private static getClimateStateText(entityState: string, attributes: any, hass?: any): string {
    const targetTemp = attributes.temperature;
    const targetTempHigh = attributes.target_temp_high;
    const targetTempLow = attributes.target_temp_low;
    const tempUnit = attributes.unit_of_measurement || hass?.config?.unit_system?.temperature || '°C';
    switch (entityState) {
      case 'heat':
      case 'heating':
        return targetTemp ? `${localize('status.heat_to')} ${targetTemp}${tempUnit}` : localize('status.heat_to');
      case 'cool':
      case 'cooling':
        return targetTemp ? `${localize('status.cool_to')} ${targetTemp}${tempUnit}` : localize('status.cool_to');
      case 'auto':
      case 'heat_cool':
        if (targetTempLow && targetTempHigh) {
          return `${localize('status.auto')} ${targetTempLow}-${targetTempHigh}${tempUnit}`;
        } else if (targetTemp) {
          return `${localize('status.auto')} ${targetTemp}${tempUnit}`;
        }
        return localize('status.auto');
      case 'dry':
        return localize('status.dry');
      case 'fan_only':
        return localize('status.fan_only');
      case 'off':
        return localize('status.off');
      default:
        return entityState.charAt(0).toUpperCase() + entityState.slice(1);
    }
  }

  private static getWaterHeaterStateText(entityState: string, attributes: any, hass?: any): string {
    const targetTemp = attributes.temperature;
    const tempUnit = attributes.unit_of_measurement || hass?.config?.unit_system?.temperature || '°C';
    if (entityState === 'off') {
      return localize('status.off');
    }
    const lowerState = entityState.toLowerCase();
    const isGenericOn = lowerState === 'true' || lowerState === 'on';
    const modeLabel = isGenericOn ? localize('status.on') : entityState.charAt(0).toUpperCase() + entityState.slice(1).replace(/_/g, ' ');
    if (targetTemp) {
      return `${modeLabel} · ${targetTemp}${tempUnit}`;
    }
    return modeLabel;
  }

  private static getMediaPlayerStateText(entityState: string): string {
    switch (entityState) {
      case 'playing':
        return localize('status.playing');
      case 'paused':
        return localize('status.paused');
      case 'buffering':
        return localize('status.buffering');
      case 'idle':
        return localize('status.idle');
      case 'standby':
        return localize('status.standby');
      case 'on':
        return localize('status.on');
      default:
        return localize('status.off');
    }
  }

  private static getVacuumStateText(entityState: string, attributes: any): string {
    switch (entityState) {
      case 'cleaning':
        return localize('status.cleaning');
      case 'docked':
        return localize('status.docked');
      case 'returning':
        return localize('status.returning');
      case 'paused':
        return localize('status.paused');
      case 'idle':
        return localize('status.idle');
      case 'error':
        return localize('status.error');
      case 'off':
        return localize('status.off');
      default:
        return entityState.charAt(0).toUpperCase() + entityState.slice(1);
    }
  }

  private static getLockStateText(entityState: string): string {
    switch (entityState) {
      case 'locked':
        return localize('status.locked');
      case 'unlocked':
        return localize('status.unlocked');
      case 'jammed':
        return localize('status.jammed');
      default:
        return localize('status.off');
    }
  }

  private static getAlarmStateText(entityState: string): string {
    switch (entityState) {
      case 'disarmed':
        return localize('status.disarmed');
      case 'armed_home':
        return localize('status.armed_home');
      case 'armed_away':
        return localize('status.armed_away');
      case 'armed_night':
        return localize('status.armed_night');
      case 'armed_vacation':
        return localize('status.armed_vacation');
      case 'armed_custom_bypass':
        return localize('status.armed_custom_bypass');
      case 'pending':
        return localize('status.pending');
      case 'arming':
        return localize('status.arming');
      case 'disarming':
        return localize('status.disarming');
      case 'triggered':
        return localize('status.triggered');
      default:
        return localize('status.unknown');
    }
  }

  private static getBinarySensorStateText(entityState: string, attributes: any): string {
    const deviceClass = attributes.device_class;
    if (entityState === 'on') {
      switch (deviceClass) {
        case 'motion':
          return localize('motion.detected');
        case 'occupancy':
          return localize('occupancy.detected');
        case 'door':
        case 'window':
        case 'opening':
          return localize('status.open');
        case 'garage_door':
          return localize('status.open');
        case 'moisture':
        case 'gas':
        case 'problem':
          return localize('status.detected');
        case 'safety':
          return localize('status.unsafe');
        case 'smoke':
          return localize('smoke.detected');
        case 'sound':
          return localize('status.detected');
        case 'vibration':
          return localize('status.detected');
        case 'lock':
          return localize('status.locked');
        case 'plug':
          return localize('status.plugged_in');
        case 'presence':
          return localize('status.home');
        case 'power':
          return localize('status.on');
        case 'running':
          return localize('status.running');
        case 'update':
          return localize('status.update_available');
        default:
          return localize('status.on');
      }
    } else {
      switch (deviceClass) {
        case 'motion':
          return localize('motion.not_detected');
        case 'occupancy':
          return localize('occupancy.not_detected');
        case 'door':
        case 'window':
        case 'opening':
          return localize('status.closed');
        case 'garage_door':
          return localize('status.closed');
        case 'moisture':
        case 'gas':
        case 'problem':
          return localize('status.clear');
        case 'safety':
          return localize('status.safe');
        case 'smoke':
          return localize('smoke.not_detected');
        case 'sound':
          return localize('status.clear');
        case 'vibration':
          return localize('status.clear');
        case 'lock':
          return localize('status.unlocked');
        case 'plug':
          return localize('status.unplugged');
        case 'presence':
          return localize('status.away');
        case 'power':
          return localize('status.off');
        case 'running':
          return localize('status.idle');
        case 'update':
          return localize('status.up_to_date');
        default:
          return localize('status.off');
      }
    }
  }

  private static getSensorStateText(entityState: string, attributes: any): string {
    const deviceClass = attributes.device_class;
    const unitOfMeasurement = attributes.unit_of_measurement;
    if (unitOfMeasurement && entityState !== 'unavailable' && entityState !== 'unknown') {
      return `${entityState} ${unitOfMeasurement}`;
    }
    switch (deviceClass) {
      case 'battery':
      case 'humidity':
        return entityState !== 'unavailable' && entityState !== 'unknown' ? `${entityState}%` : entityState;
      case 'temperature':
        return entityState !== 'unavailable' && entityState !== 'unknown' ? `${entityState}°` : entityState;
      case 'timestamp':
        return entityState;
      default:
        return entityState;
    }
  }

  private static getUnavailableStateText(entityState: string): string {
    switch (entityState.toLowerCase()) {
      case 'unavailable':
        return localize('status.unavailable');
      case 'unknown':
        return localize('status.unknown');
      case 'none':
      case 'null':
      case '':
        return localize('status.none');
      default:
        return entityState;
    }
  }

  private static handleUnsupportedDomain(entityState: string, attributes: any, domain: string, entityId?: string): EntityData {
    const isActive = ['on', 'active', 'enabled', 'open', 'unlocked'].includes(entityState.toLowerCase());
    const stateText = isActive ? localize('status.on') : localize('status.off');
    const icon = attributes.icon || this.getFallbackIcon(domain, entityState, attributes, entityId);

    return {
      isActive,
      backgroundColor: isActive ? this.ACTIVE_BASE_STYLE.backgroundColor : this.INACTIVE_STYLE.backgroundColor,
      iconBackgroundColor: isActive ? '#34c759' : this.INACTIVE_STYLE.iconBackgroundColor,
      iconColor: isActive ? '#ffffff' : this.INACTIVE_STYLE.iconColor,
      textColor: isActive ? this.ACTIVE_BASE_STYLE.textColor : this.INACTIVE_STYLE.textColor,
      stateText,
      icon
    };
  }

  private static readonly DEFAULT_BACKGROUND = `
    url(data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAIBAQEBAQIBAQECAgICAgQDAgICAgUEBAMEBgUGBgYFBgYGBwkIBgcJBwYGCAsICQoKCgoKBggLDAsKDAkKCgr/2wBDAQICAgICAgUDAwUKBwYHCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgr/wAARCANABcADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpan0)
  `;

  static getDashboardBackground(): string {
    return this.DEFAULT_BACKGROUND;
  }
}
