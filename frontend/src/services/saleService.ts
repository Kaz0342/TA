import api from './api';

export interface BuyerRankingItem {
  buyer_name: string;
  total_orders: number;
  total_kg: number;
  total_spent: number;
  avg_price_per_kg: number;
  last_purchase_date: string;
}

export interface PriceTrendData {
  min_price: number;
  max_price: number;
  avg_price: number;
  latest_price: number;
  recommended_presets: number[];
  recent_trend: Array<{
    date: string;
    avg_price: number;
    volume_kg: number;
  }>;
}

export const saleService = {
  async getBuyerRanking(limit: number = 5): Promise<BuyerRankingItem[]> {
    const res = await api.get('/sales/buyer-ranking', { params: { limit } });
    return res.data.data;
  },

  async getPriceTrend(): Promise<PriceTrendData> {
    const res = await api.get('/sales/price-trend');
    return res.data.data;
  },

  async voidSale(id: number, reason: string): Promise<any> {
    const res = await api.post(`/sales/${id}/void`, { reason });
    return res.data.data;
  },
};
