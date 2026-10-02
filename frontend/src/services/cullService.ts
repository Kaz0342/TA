import api from './api';

export interface BaglogCullItem {
  id: number;
  baglog_batch_id: number;
  batch_code: string;
  slot_code: string;
  cull_date: string;
  quantity: number;
  reason: 'TRICHODERMA' | 'BUSUK_BASAH' | 'HAMA' | 'KERING' | 'HABIS_PRODUKSI' | 'LAINNYA';
  notes: string | null;
  created_at: string;
}

export interface CreateCullPayload {
  baglog_batch_id: number;
  slot_code: string;
  cull_date: string;
  quantity: number;
  reason: 'TRICHODERMA' | 'BUSUK_BASAH' | 'HAMA' | 'KERING' | 'HABIS_PRODUKSI' | 'LAINNYA';
  notes?: string;
}

export const cullService = {
  async getCulls(params?: {
    baglog_batch_id?: number;
    slot_code?: string;
    reason?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<BaglogCullItem[]> {
    const res = await api.get('/baglog-culls', { params });
    return res.data.data;
  },

  async createCull(payload: CreateCullPayload): Promise<{
    cull: BaglogCullItem;
    slot_active_capacity_remaining: number;
  }> {
    const res = await api.post('/baglog-culls', payload);
    return res.data.data;
  },

  async voidCull(id: number, reason: string): Promise<BaglogCullItem> {
    const res = await api.post(`/baglog-culls/${id}/void`, { reason });
    return res.data.data;
  },
};
