import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Banknote, 
  TrendingUp, 
  Scale, 
  Layers, 
  Plus, 
  Trash2, 
  Clock,
  Info
} from 'lucide-react';
import { hppService, type HppSummaryData, type BatchHppData, type OperationalExpenseItem } from '../services/hppService';
import AnimatedProgressBar from './AnimatedProgressBar';
import RecordExpenseModal from './RecordExpenseModal';
import { useToastStore } from '../stores/toastStore';

interface HppAnalysisCardProps {
  batches: Array<{
    id: number;
    batch_code: string;
    quantity: number;
    status: string;
  }>;
  isAdmin: boolean;
}

export default function HppAnalysisCard({ batches, isAdmin }: HppAnalysisCardProps) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);

  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(
    batches.length > 0 ? batches[0].id : null
  );
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // Auto-select first batch when batches are loaded or change
  useEffect(() => {
    if (!selectedBatchId && batches.length > 0) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches, selectedBatchId]);

  // Fetch High-level HPP Summary
  const { data: summary } = useQuery<HppSummaryData>({
    queryKey: ['hppSummary'],
    queryFn: () => hppService.getHppSummary(),
  });

  // Fetch Selected Batch HPP Detail
  const { data: batchHpp, isLoading: isBatchHppLoading } = useQuery<BatchHppData>({
    queryKey: ['batchHpp', selectedBatchId],
    queryFn: () => hppService.getBatchHpp(selectedBatchId!),
    enabled: !!selectedBatchId,
  });

  // Fetch Operational Expenses List
  const { data: expenses = [] } = useQuery<OperationalExpenseItem[]>({
    queryKey: ['operationalExpenses'],
    queryFn: () => hppService.getExpenses(),
  });

  // Delete Expense Mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: (id: number) => hppService.deleteExpense(id),
    onSuccess: () => {
      addToast('Biaya operasional berhasil dihapus', 'success');
      queryClient.invalidateQueries({ queryKey: ['operationalExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['hppSummary'] });
      queryClient.invalidateQueries({ queryKey: ['batchHpp'] });
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Gagal menghapus biaya', 'error');
    },
  });

  const categoryBadges: Record<string, { bg: string; text: string; label: string }> = {
    LISTRIK: { bg: 'bg-amber-100 dark:bg-amber-950/80', text: 'text-amber-800 dark:text-amber-300', label: 'Listrik' },
    AIR: { bg: 'bg-blue-100 dark:bg-blue-950/80', text: 'text-blue-800 dark:text-blue-300', label: 'Air' },
    NUTRISI: { bg: 'bg-emerald-100 dark:bg-emerald-950/80', text: 'text-emerald-800 dark:text-emerald-300', label: 'Nutrisi' },
    LABOR: { bg: 'bg-purple-100 dark:bg-purple-950/80', text: 'text-purple-800 dark:text-purple-300', label: 'Tenaga Kerja' },
    PACKAGING: { bg: 'bg-teal-100 dark:bg-teal-950/80', text: 'text-teal-800 dark:text-teal-300', label: 'Kemasan' },
    LAINNYA: { bg: 'bg-slate-100 dark:bg-[#1a2e22]', text: 'text-slate-700 dark:text-[#a3c9b4]', label: 'Lainnya' },
  };

  return (
    <div className="space-y-6">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* Total Modal Investasi */}
        <div className="bg-white dark:bg-[#142219] rounded-2xl sm:rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8]">
            <span className="font-bold text-[10px] sm:text-xs uppercase tracking-wider text-[#526a5e] dark:text-[#a3c9b4]">
              Total Modal Awal
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-50 dark:bg-[#163321] text-emerald-700 dark:text-[#86efac] flex items-center justify-center shrink-0">
              <Banknote className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-base sm:text-2xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight">
              Rp {Number(summary?.total_modal_investasi || 0).toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#759183] dark:text-[#6b8a78] mt-0.5 sm:mt-1 font-medium truncate">
              Pengadaan baglog ({summary?.total_batches || 0} batch)
            </p>
          </div>
        </div>

        {/* Biaya Operasional Total */}
        <div className="bg-white dark:bg-[#142219] rounded-2xl sm:rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8]">
            <span className="font-bold text-[10px] sm:text-xs uppercase tracking-wider text-[#526a5e] dark:text-[#a3c9b4]">
              Beban Operasional
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-amber-50 dark:bg-[#332205] text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Scale className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-base sm:text-2xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight">
              Rp {Number(summary?.total_operational_expense || 0).toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#759183] dark:text-[#6b8a78] mt-0.5 sm:mt-1 font-medium truncate">
              Listrik, air, nutrisi, upah harian
            </p>
          </div>
        </div>

        {/* Total Omzet Penjualan */}
        <div className="bg-white dark:bg-[#142219] rounded-2xl sm:rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8]">
            <span className="font-bold text-[10px] sm:text-xs uppercase tracking-wider text-[#526a5e] dark:text-[#a3c9b4]">
              Omzet Penjualan
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-blue-50 dark:bg-[#0f283d] text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-base sm:text-2xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight">
              Rp {Number(summary?.total_sales_revenue || 0).toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#759183] dark:text-[#6b8a78] mt-0.5 sm:mt-1 font-medium truncate">
              Hasil panen {Number(summary?.total_harvest_kg || 0).toFixed(1)} Kg
            </p>
          </div>
        </div>

        {/* Margin Kontribusi */}
        <div className="bg-white dark:bg-[#142219] rounded-2xl sm:rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#192e22] dark:text-[#e4efe8]">
            <span className="font-bold text-[10px] sm:text-xs uppercase tracking-wider text-[#526a5e] dark:text-[#a3c9b4]">
              Keuntungan Kotor
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-50 dark:bg-[#163321] text-emerald-700 dark:text-[#86efac] flex items-center justify-center shrink-0">
              <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div
              className={`text-base sm:text-2xl font-bold tracking-tight ${
                (summary?.total_margin_kontribusi || 0) >= 0
                  ? 'text-emerald-700 dark:text-[#86efac]'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              Rp {Number(summary?.total_margin_kontribusi || 0).toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#759183] dark:text-[#6b8a78] mt-0.5 sm:mt-1 font-medium truncate">
              Rata-rata HPP: Rp {Number(summary?.avg_hpp_per_kg || 0).toLocaleString('id-ID')}/Kg
            </p>
          </div>
        </div>
      </div>

      {/* Batch Breakdown & Operational Ledger Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Detailed Batch HPP Card (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-base font-bold text-[#192e22] dark:text-[#e4efe8]">
                  Perhitungan HPP &amp; BEP Per Batch
                </h3>
                <p className="text-xs text-[#526a5e] dark:text-[#a3c9b4]">
                  Evaluasi profitabilitas dan titik impas panen media tanam
                </p>
              </div>

              {/* Batch Selector Dropdown */}
              <div className="relative">
                <select
                  value={selectedBatchId || ''}
                  onChange={(e) => setSelectedBatchId(e.target.value ? Number(e.target.value) : null)}
                  className="bg-[#edf5f0] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] rounded-2xl px-3.5 py-1.5 text-xs text-[#192e22] dark:text-[#e4efe8] font-bold outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batch_code} ({b.status.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isBatchHppLoading ? (
              <div className="py-12 text-center text-xs text-slate-400 font-medium">
                Memuat data HPP batch...
              </div>
            ) : batchHpp ? (
              <div className="space-y-5">
                {/* Cycle Progress Bar (Audit Recommendation: Young batches are not failing!) */}
                <div className="bg-[#fbfdfc] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-[#86efac]" />
                      Siklus Umur Batch: Hari ke-{batchHpp.age_days ?? 0} dari target {batchHpp.cycle_target_days ?? 120} hari
                    </span>
                    <span className="text-xs font-extrabold text-emerald-700 dark:text-[#86efac]">
                      {batchHpp.cycle_progress_percent ?? batchHpp.persen_siklus ?? 0}%
                    </span>
                  </div>
                  <AnimatedProgressBar percentage={batchHpp.cycle_progress_percent ?? batchHpp.persen_siklus ?? 0} />
                  <p className="text-[10px] text-[#759183] dark:text-[#6b8a78] mt-2 italic flex items-center gap-1">
                    <Info className="w-3 h-3 text-emerald-600 shrink-0" />
                    Batch muda membutuhkan waktu hingga panen flush berikutnya untuk mencapai titik impas (BEP).
                  </p>
                </div>

                {/* BEP Progress Bar */}
                <div className="bg-[#fbfdfc] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        Target Titik Impas (BEP): {Number(batchHpp.total_harvest_kg ?? batchHpp.total_panen_kg ?? 0).toFixed(1)} / {Number(batchHpp.bep_harvest_kg ?? 0).toFixed(1)} Kg
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-blue-700 dark:text-blue-400">
                      {batchHpp.bep_progress_percent ?? 0}%
                    </span>
                  </div>
                  <AnimatedProgressBar percentage={batchHpp.bep_progress_percent ?? 0} />
                  <p className="text-[10px] text-[#759183] dark:text-[#6b8a78] mt-2">
                    Estimasi BEP dihitung berdasarkan harga rata-rata jual Rp {Math.round(batchHpp.avg_selling_price_per_kg || 25000).toLocaleString('id-ID')}/Kg.
                  </p>
                </div>

                {/* Grid Metric Numbers */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-[#edf5f0]/60 dark:bg-[#182c20]/60 rounded-2xl p-3 border border-[#d6e9df] dark:border-[#1e382b]">
                    <span className="text-[10px] font-bold text-[#526a5e] dark:text-[#a3c9b4] uppercase">Modal Baglog</span>
                    <p className="text-sm font-extrabold text-[#192e22] dark:text-[#e4efe8] mt-0.5">
                      Rp {Number(batchHpp.baglog_capital_cost ?? batchHpp.modal_baglog_awal ?? 0).toLocaleString('id-ID')}
                    </p>
                    <span className="text-[10px] text-[#759183] dark:text-[#6b8a78]">
                      @{batchHpp.initial_quantity ?? batchHpp.total_quantity ?? 0} x Rp {Math.round(batchHpp.price_per_baglog ?? 0).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="bg-[#edf5f0]/60 dark:bg-[#182c20]/60 rounded-2xl p-3 border border-[#d6e9df] dark:border-[#1e382b]">
                    <span className="text-[10px] font-bold text-[#526a5e] dark:text-[#a3c9b4] uppercase">Alokasi Beban</span>
                    <p className="text-sm font-extrabold text-[#192e22] dark:text-[#e4efe8] mt-0.5">
                      Rp {Number(batchHpp.operational_expense_allocated ?? batchHpp.biaya_operasional ?? 0).toLocaleString('id-ID')}
                    </p>
                    <span className="text-[10px] text-[#759183] dark:text-[#6b8a78]">
                      Beban dibagi rata
                    </span>
                  </div>

                  <div className="bg-[#edf5f0]/60 dark:bg-[#182c20]/60 rounded-2xl p-3 border border-[#d6e9df] dark:border-[#1e382b]">
                    <span className="text-[10px] font-bold text-[#526a5e] dark:text-[#a3c9b4] uppercase">HPP / Kg Panen</span>
                    <p className="text-sm font-extrabold text-[#192e22] dark:text-[#e4efe8] mt-0.5">
                      Rp {Math.round(batchHpp.hpp_per_kg_harvested ?? 0).toLocaleString('id-ID')}
                    </p>
                    <span className="text-[10px] text-[#759183] dark:text-[#6b8a78]">
                      Total panen: {Number(batchHpp.total_harvest_kg ?? batchHpp.total_panen_kg ?? 0).toFixed(1)} Kg
                    </span>
                  </div>

                  <div className="bg-[#edf5f0]/60 dark:bg-[#182c20]/60 rounded-2xl p-3 border border-[#d6e9df] dark:border-[#1e382b]">
                    <span className="text-[10px] font-bold text-[#526a5e] dark:text-[#a3c9b4] uppercase">Kapasitas Aktif</span>
                    <p className="text-sm font-extrabold text-[#192e22] dark:text-[#e4efe8] mt-0.5">
                      {batchHpp.active_capacity ?? 0} baglog
                    </p>
                    <span className="text-[10px] text-[#759183] dark:text-[#6b8a78]">
                      Dibuang: {batchHpp.culled_quantity ?? batchHpp.total_culls_qty ?? 0} ({batchHpp.mortality_rate_percent ?? 0}%)
                    </span>
                  </div>

                  <div className="bg-[#edf5f0]/60 dark:bg-[#182c20]/60 rounded-2xl p-3 border border-[#d6e9df] dark:border-[#1e382b]">
                    <span className="text-[10px] font-bold text-[#526a5e] dark:text-[#a3c9b4] uppercase">Omzet Batch</span>
                    <p className="text-sm font-extrabold text-blue-700 dark:text-blue-400 mt-0.5">
                      Rp {Number(batchHpp.total_sales_revenue ?? batchHpp.omzet_kotor ?? 0).toLocaleString('id-ID')}
                    </p>
                    <span className="text-[10px] text-[#759183] dark:text-[#6b8a78]">
                      Terjual: {Number(batchHpp.total_sales_kg ?? 0).toFixed(1)} Kg
                    </span>
                  </div>

                  <div className="bg-[#edf5f0]/60 dark:bg-[#182c20]/60 rounded-2xl p-3 border border-[#d6e9df] dark:border-[#1e382b]">
                    <span className="text-[10px] font-bold text-[#526a5e] dark:text-[#a3c9b4] uppercase">Keuntungan Kotor</span>
                    <p
                      className={`text-sm font-extrabold mt-0.5 ${
                        (batchHpp.margin_kontribusi ?? 0) >= 0
                          ? 'text-emerald-700 dark:text-[#86efac]'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      Rp {Number(batchHpp.margin_kontribusi ?? 0).toLocaleString('id-ID')}
                    </p>
                    <span className="text-[10px] text-[#759183] dark:text-[#6b8a78]">
                      {(batchHpp.margin_kontribusi ?? 0) >= 0 ? 'Surplus Operasional' : 'Defisit Sementara'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                Pilih batch untuk melihat kalkulasi HPP
              </div>
            )}
          </div>
        </div>

        {/* Right: Operational Expenses Ledger (5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#192e22] dark:text-[#e4efe8]">
                  Buku Kas Operasional
                </h3>
                <p className="text-xs text-[#526a5e] dark:text-[#a3c9b4]">
                  Catatan pengeluaran harian budidaya
                </p>
              </div>

              {isAdmin && (
                <button
                  onClick={() => setIsExpenseModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Catat Biaya</span>
                </button>
              )}
            </div>

            {/* Expenses List */}
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {expenses.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 font-medium">
                  Belum ada biaya operasional yang dicatat.
                </div>
              ) : (
                expenses.map((item) => {
                  const badge = categoryBadges[item.category] || categoryBadges.LAINNYA;
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-[#fbfdfc] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                          <span className="text-[11px] text-[#759183] dark:text-[#6b8a78] font-medium">
                            {item.expense_date}
                          </span>
                        </div>
                        {item.notes && (
                          <p className="text-xs text-[#192e22] dark:text-[#e4efe8] font-medium mt-1 truncate">
                            {item.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-extrabold text-[#192e22] dark:text-[#e4efe8]">
                          Rp {Number(item.amount).toLocaleString('id-ID')}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => deleteExpenseMutation.mutate(item.id)}
                            disabled={deleteExpenseMutation.isPending}
                            title="Hapus Pengeluaran"
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Record Expense Modal */}
      <RecordExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
      />
    </div>
  );
}
