import { Area, Entity, Device } from '../types/types';

export class DataService {
  static async getDevices(hass: any): Promise<Device[]> { try { return await hass.callWS({ type: 'config/device_registry/list' }); } catch { return []; } }
  static async getAreas(hass: any): Promise<Area[]> { try { return await hass.callWS({ type: 'config/area_registry/list' }); } catch { return []; } }
  static async getEntities(hass: any): Promise<Entity[]> { try { const e = await hass.callWS({ type: 'config/entity_registry/list' }); return e.filter((x: Entity) => !x.hidden_by && !x.disabled_by); } catch { return []; } }

  static groupEntitiesByArea(entities: Entity[], areas: Area[], devices: Device[] = []): { [areaId: string]: Entity[] } {
    const res: { [areaId: string]: Entity[] } = { no_area: [] }; areas.forEach(a => res[a.area_id] = []);
    entities.forEach(e => {
      let aid = e.area_id; if (!aid && e.device_id) { const d = devices.find(x => x.id === e.device_id); if (d?.area_id) aid = d.area_id; }
      if (!aid) aid = 'no_area'; if (!res[aid]) res[aid] = []; res[aid].push(e);
    });
    return res;
  }
}
