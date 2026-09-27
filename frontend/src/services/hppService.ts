import api from './api';

export interface BatchHppData {
  batch_id: number;
  batch_code: string;
  entry_date: string;
  age_days: number;
  cycle_target_days?: number;
  cycle_progress_percent?: number;
  persen_siklus?: number;
  initial_quantity?: number;
  total_quantity?: number;
  active_capacity?: number;
  culled_quantity?: number;
  total_culls_qty?: number;
  mortality_rate_percent?: number;
  price_per_baglog?: number;
  baglog_capital_cost?: number;
  modal_baglog_awal?: number;
  operational_expense_allocated?: number;
  biaya_operasional?: number;
  total_modal_investasi?: number;
  total_biaya?: number;
  total_harvest_kg?: number;
  total_panen_kg?: number;
  hpp_per_kg_harvested?: number;
  total_sales_revenue?: number;
  omzet_kotor?: number;
  total_sales_kg?: number;
  avg_selling_price_per_kg?: number;
  margin_kontribusi?: number;
  bep_harvest_kg?: number;
  bep_progress_percent?: number;
}

export interface HppSummaryData {
  total_batches: number;
  total_modal_investasi: number;
  total_sales_revenue: number;
  total_operational_expense: number;
  total_margin_kontribusi: number;
  total_harvest_kg: number;
  avg_hpp_per_kg: number;
}

export interface OperationalExpenseItem {
  id: number;
  expense_date: string;
  category: 'LISTRIK' | 'AIR' | 'NUTRISI' | 'LABOR' | 'PACKAGING' | 'LAINNYA';
  amount: number;
  notes: string | null;
  created_at: string;
}

export interface CreateExpensePayload {
  expense_date: string;
  category: 'LISTRIK' | 'AIR' | 'NUTRISI' | 'LABOR' | 'PACKAGING' | 'LAINNYA';
  amount: number;
  notes?: string;
}

export const hppService = {
  async getBatchHpp(batchId: number): Promise<BatchHppData> {
    const res = await api.get(`/baglogs/${batchId}/hpp`);
    return res.data.data;
  },

  async getHppSummary(): Promise<HppSummaryData> {
    const res = await api.get('/baglogs/hpp-summary');
    return res.data.data;
  },

  async getExpenses(params?: {
    category?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<OperationalExpenseItem[]> {
    const res = await api.get('/operational-expenses', { params });
    return Array.isArray(res.data.data) ? res.data.data : (res.data.data?.expenses || []);
  },

  async createExpense(payload: CreateExpensePayload): Promise<OperationalExpenseItem> {
    const res = await api.post('/operational-expenses', payload);
    return res.data.data;
  },

  async deleteExpense(id: number): Promise<{ message: string }> {
    const res = await api.delete(`/operational-expenses/${id}`);
    return res.data;
  },
};
