import api from './api';

export interface SlotData {
  slot_code: string;
  row: string;
  bay: number;
  tier: number;
  max_capacity: number;
  is_occupied: boolean;
  active_batch: {
    id: number;
    batch_code: string;
    supplier: string;
    status: string;
  } | null;
  assignment: {
    id: number;
    initial_quantity: number;
    active_capacity: number;
    initial_mycelium_stage: string;
    current_status: string;
    assigned_at: string;
    total_harvest_kg?: number;
    badge: { 
      label: string; 
      class: string; 
      dot: string;
      description?: string;
      age_days?: number;
    };
  } | null;
}

export interface SlotHeatmapData {
  slot_code: string;
  row: string;
  bay: number;
  tier: number;
  total_kg: number;
  intensity: number; // 0.0 to 1.0
}

export interface AssignBatchPayload {
  baglog_batch_id: number;
  assigned_at: string;
  slots: {
    slot_code: string;
    initial_quantity: number;
    initial_mycelium_stage: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
  }[];
}

export const slotService = {
  async getSlots(params?: { row?: string; status?: 'occupied' | 'empty' }): Promise<SlotData[]> {
    const res = await api.get('/slots', { params });
    return res.data.data;
  },

  async getHeatmap(params?: { batch_id?: number }): Promise<{ max_kg_in_slot: number; slots: SlotHeatmapData[] }> {
    const res = await api.get('/slots/heatmap', { params });
    return res.data.data;
  },

  async assignBatch(payload: AssignBatchPayload): Promise<any> {
    const res = await api.post('/batch-slot-assignments', payload);
    return res.data;
  }
};
