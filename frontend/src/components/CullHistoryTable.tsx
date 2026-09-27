import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trash2, Search } from 'lucide-react';
import { cullService, type BaglogCullItem } from '../services/cullService';

interface CullHistoryTableProps {
  onOpenRecordModal: () => void;
  isAdmin: boolean;
}

export default function CullHistoryTable({ onOpenRecordModal, isAdmin }: CullHistoryTableProps) {
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data: culls = [], isLoading } = useQuery<BaglogCullItem[]>({
    queryKey: ['baglogCulls'],
    queryFn: () => cullService.getCulls(),
  });

  const reasonLabels: Record<string, { label: string; badge: string }> = {
    TRICHODERMA: {
      label: 'Jamur Hijau (Trichoderma)',
      badge: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
    },
    BUSUK_BASAH: {
      label: 'Busuk Basah (Bakteri)',
      badge: 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700',
    },
    HAMA: {
      label: 'Hama (Ulat / Serangga)',
      badge: 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700',
    },
    KERING: {
      label: 'Kering / Dehidrasi',
      badge: 'bg-orange-100 dark:bg-orange-950/80 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-700',
    },
    LAINNYA: {
      label: 'Lainnya',
      badge: 'bg-slate-100 dark:bg-[#1a2e22] text-slate-700 dark:text-[#a3c9b4] border-slate-300 dark:border-[#2b503d]',
    },
  };

  const filteredCulls = culls.filter((item) => {
    if (reasonFilter !== 'all' && item.reason !== reasonFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchBatch = item.batch_code?.toLowerCase().includes(q);
      const matchSlot = item.slot_code?.toLowerCase().includes(q);
      const matchNotes = item.notes?.toLowerCase().includes(q);
      if (!matchBatch && !matchSlot && !matchNotes) return false;
    }
    return true;
  });

  const totalCulledBags = culls.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return (
    <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-[#192e22] dark:text-[#e4efe8] flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Riwayat Baglog Rusak &amp; Kontaminasi</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
              Total {totalCulledBags} baglog rusak
            </span>
          </h3>
          <p className="text-xs text-[#526a5e] dark:text-[#a3c9b4] mt-0.5">
            Log pembuangan media tanam rusak untuk analisis sanitasi kumbung
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isAdmin && (
            <button
              onClick={onOpenRecordModal}
              className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Catat Baglog Rusak Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'TRICHODERMA', 'BUSUK_BASAH', 'HAMA', 'KERING', 'LAINNYA'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setReasonFilter(r)}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                reasonFilter === r
                  ? 'bg-[#244b37] dark:bg-[#2e7d52] text-white shadow-xs'
                  : 'bg-[#edf5f0] dark:bg-[#182c20] text-[#526a5e] dark:text-[#a3c9b4] hover:bg-[#d6e9df]'
              }`}
            >
              {r === 'all' ? 'Semua Alasan' : reasonLabels[r]?.label.split(' ')[0] || r}
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari batch / slot..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#fbfdfc] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] text-xs text-[#192e22] dark:text-[#e4efe8] outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-[#d6e9df] dark:border-[#1e382b]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#f0f7f2] dark:bg-[#182c20] text-[#192e22] dark:text-[#e4efe8] font-bold border-b border-[#d6e9df] dark:border-[#1e382b]">
            <tr>
              <th className="py-3 px-4">Tanggal</th>
              <th className="py-3 px-4">Batch</th>
              <th className="py-3 px-4">Slot</th>
              <th className="py-3 px-4">Jumlah Rusak</th>
              <th className="py-3 px-4">Alasan Kerusakan</th>
              <th className="py-3 px-4">Catatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf5f0] dark:divide-[#1e382b]">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  Memuat data kerusakan...
                </td>
              </tr>
            ) : filteredCulls.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  Tidak ada catatan baglog rusak yang sesuai.
                </td>
              </tr>
            ) : (
              filteredCulls.map((cull) => {
                const reasonMeta = reasonLabels[cull.reason] || reasonLabels.LAINNYA;
                return (
                  <tr key={cull.id} className="hover:bg-slate-50/60 dark:hover:bg-[#182c20]/50 transition-colors">
                    <td className="py-3 px-4 font-medium text-[#192e22] dark:text-[#e4efe8]">
                      {cull.cull_date}
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-700 dark:text-[#86efac]">
                      {cull.batch_code}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-700 dark:text-blue-400">
                      {cull.slot_code}
                    </td>
                    <td className="py-3 px-4 font-extrabold text-rose-600 dark:text-rose-400">
                      {cull.quantity} baglog
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${reasonMeta.badge}`}>
                        {reasonMeta.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#526a5e] dark:text-[#a3c9b4]">
                      {cull.notes || '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
