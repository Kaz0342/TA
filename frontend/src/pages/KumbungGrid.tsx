import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Grid as GridIcon, Map, Plus, Check, X, Box, CheckCircle2 } from 'lucide-react';
import { slotService } from '../services/slotService';
import type { SlotData } from '../services/slotService';
import api from '../services/api';
import { useToastStore } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';
import SlotDetailModal from '../components/SlotDetailModal';
import RecordCullModal from '../components/RecordCullModal';

export default function KumbungGrid() {
  const user = useAuthStore((state) => state.user);
  const addToast = useToastStore((state) => state.addToast);
  const queryClient = useQueryClient();

  // Grid Controls
  const [activeRow, setActiveRow] = useState<'A' | 'B' | 'C'>('A');
  const [statusFilter, setStatusFilter] = useState<'all' | 'occupied' | 'empty'>('all');
  const [viewMode, setViewMode] = useState<'physical' | 'heatmap'>('physical');

  // Allocation Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSlotCodes, setSelectedSlotCodes] = useState<Set<string>>(new Set());

  // Detail Modal State
  const [detailModalSlot, setDetailModalSlot] = useState<SlotData | null>(null);

  // Cull Modal State
  const [isCullModalOpen, setIsCullModalOpen] = useState(false);
  const [cullSlot, setCullSlot] = useState<SlotData | null>(null);

  // Allocation Form State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignBatchId, setAssignBatchId] = useState<number | ''>('');
  const [assignMyceliumStage, setAssignMyceliumStage] = useState<'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3'>('LEVEL_2');
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPreviewBatchId, setSelectedPreviewBatchId] = useState<number | null>(null);

  // Fetch Slots
  const { data: slots = [], isLoading: isSlotsLoading } = useQuery<SlotData[]>({
    queryKey: ['slots', activeRow, statusFilter],
    queryFn: () => slotService.getSlots({ row: activeRow, status: statusFilter === 'all' ? undefined : statusFilter }),
  });

  // Fetch Heatmap
  const { data: heatmapData } = useQuery({
    queryKey: ['heatmap', activeRow],
    queryFn: () => slotService.getHeatmap(),
    enabled: viewMode === 'heatmap',
  });

  // Fetch Active Batches for Assignment Dropdown
  const { data: activeBatches = [] } = useQuery({
    queryKey: ['activeBatches'],
    queryFn: async () => {
      const res = await api.get('/baglogs');
      return (res.data.data || []).filter((b: any) => b.status === 'active');
    },
  });

  // Metrik Alokasi Batch ke Slot Rak
  const activePreviewBatch = useMemo(() => {
    if (!activeBatches || activeBatches.length === 0) return null;
    if (selectedPreviewBatchId) {
      const found = activeBatches.find((b: any) => b.id === selectedPreviewBatchId);
      if (found) return found;
    }
    // Prioritaskan batch yang masih punya sisa baglog belum teralokasi, atau batch teratas
    return activeBatches.find((b: any) => (b.unassigned_quantity ?? (b.quantity - (b.assigned_quantity || 0))) > 0) || activeBatches[0];
  }, [activeBatches, selectedPreviewBatchId]);

  const previewBatchUnassigned = useMemo(() => {
    if (!activePreviewBatch) return 0;
    return activePreviewBatch.unassigned_quantity ?? Math.max(0, Number(activePreviewBatch.quantity || 0) - Number(activePreviewBatch.assigned_quantity || 0));
  }, [activePreviewBatch]);

  const previewBatchAssigned = useMemo(() => {
    if (!activePreviewBatch) return 0;
    return activePreviewBatch.assigned_quantity ?? (Number(activePreviewBatch.quantity || 0) - previewBatchUnassigned);
  }, [activePreviewBatch, previewBatchUnassigned]);

  const selectedModalBatch = useMemo(() => {
    const idToFind = assignBatchId || activePreviewBatch?.id;
    if (!idToFind) return null;
    return activeBatches.find((b: any) => b.id === Number(idToFind));
  }, [activeBatches, assignBatchId, activePreviewBatch]);

  // Assign Batch Mutation
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assignBatchId) throw new Error('Pilih batch terlebih dahulu.');
      return slotService.assignBatch({
        baglog_batch_id: Number(assignBatchId),
        assigned_at: assignDate,
        slots: Array.from(selectedSlotCodes).map((code) => ({
          slot_code: code,
          initial_quantity: 10,
          initial_mycelium_stage: assignMyceliumStage,
        })),
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['slots'] });
      addToast(`Berhasil mengalokasikan ${res.data.total_assigned} slot!`, 'success');
      setIsAssignModalOpen(false);
      setIsSelectionMode(false);
      setSelectedSlotCodes(new Set());
      setAssignBatchId('');
    },
    onError: (err: any) => {
      addToast(err.response?.data?.message || 'Gagal mengalokasikan slot.', 'error');
    }
  });

  const handleSlotClick = (slot: SlotData) => {
    if (!isSelectionMode) {
      setDetailModalSlot(slot);
      return;
    }
    
    if (slot.is_occupied) {
      addToast('Slot ini sudah terisi batch aktif.', 'error');
      return;
    }
    const newSet = new Set(selectedSlotCodes);
    if (newSet.has(slot.slot_code)) {
      newSet.delete(slot.slot_code);
    } else {
      newSet.add(slot.slot_code);
    }
    setSelectedSlotCodes(newSet);
  };

  const handleStartAllocation = () => {
    if (user?.role !== 'admin') {
      addToast('Hanya admin yang dapat mengalokasikan baglog.', 'error');
      return;
    }
    setIsSelectionMode(true);
    setViewMode('physical'); // Force physical view for allocation
    setStatusFilter('all'); // Force show all slots so user can see empty ones
  };

  const handleCancelAllocation = () => {
    setIsSelectionMode(false);
    setSelectedSlotCodes(new Set());
  };

  // Render Helpers
  const renderPhysicalSlot = (slot: SlotData) => {
    const isSelected = selectedSlotCodes.has(slot.slot_code);
    const capacityPercent = slot.is_occupied && slot.assignment
      ? (slot.assignment.active_capacity / slot.max_capacity) * 100
      : 0;

    let dotColor = 'bg-slate-300 dark:bg-slate-600';
    if (slot.is_occupied && slot.assignment?.badge?.dot) {
      dotColor = slot.assignment.badge.dot;
    }

    return (
      <div 
        key={slot.slot_code}
        onClick={() => handleSlotClick(slot)}
        className={`relative flex flex-col justify-between p-2 rounded-xl border transition-all ${
          isSelectionMode 
            ? 'cursor-pointer hover:border-emerald-500' 
            : 'cursor-pointer hover:border-blue-400 dark:hover:border-blue-600'
        } ${
          isSelected
            ? 'bg-emerald-50/50 dark:bg-emerald-900/20 border-emerald-500 ring-2 ring-emerald-500/20'
            : slot.is_occupied
              ? 'bg-[#182c20]/40 border-[#1e382b]'
              : 'bg-transparent border-dashed border-[#d6e9df] dark:border-[#3a5a48] opacity-100 hover:bg-slate-50 dark:hover:bg-[#111c15]'
        }`}
        style={{ minHeight: '64px' }}
      >
        <div className="flex justify-between items-start">
          <span className={`text-[10px] font-bold ${isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-[#759183] dark:text-[#6b8a78]'}`}>
            {slot.slot_code}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
        </div>
        
        {slot.is_occupied ? (
          <div className="mt-2 space-y-1.5">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-semibold text-[#192e22] dark:text-[#86efac]">
                Isi
              </span>
              <span className="text-[9px] text-[#526a5e] dark:text-[#a3c9b4]">
                {slot.assignment?.active_capacity}/{slot.max_capacity}
              </span>
            </div>
            {/* Minimal Progress Bar */}
            <div className="h-1 w-full bg-[#111c15] rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500" 
                style={{ width: `${capacityPercent}%` }}
              ></div>
            </div>
          </div>
        ) : (
          <div className="mt-2 text-center text-[9px] font-bold text-slate-400 dark:text-[#526a5e]">
            KOSONG
          </div>
        )}

        {isSelected && (
          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white dark:border-[#111c15]">
            <Check className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>
    );
  };

  const renderHeatmapSlot = (slot: SlotData) => {
    const heatData = heatmapData?.slots.find(s => s.slot_code === slot.slot_code);
    
    if (!heatData || heatData.total_kg === 0) {
      return (
        <div key={slot.slot_code} className="flex flex-col items-center justify-center p-2 rounded-xl bg-transparent border border-dashed border-[#1e382b] opacity-30" style={{ minHeight: '64px' }}>
          <span className="text-[8px] text-[#6b8a78]">{slot.slot_code}</span>
          <span className="text-xs text-slate-600">-</span>
        </div>
      );
    }

    const i = heatData.intensity;
    let bgColor = '';
    let textColor = '';
    
    if (i < 0.3) {
      bgColor = 'bg-[#0f281e]';
      textColor = 'text-[#86efac]';
    } else if (i < 0.7) {
      bgColor = 'bg-[#10b981]';
      textColor = 'text-white';
    } else {
      bgColor = 'bg-[#fbbf24]';
      textColor = 'text-[#78350f]';
    }

    return (
      <div key={slot.slot_code} className={`flex flex-col items-center justify-center p-2 rounded-xl border-none shadow-md ${bgColor}`} style={{ minHeight: '64px' }}>
        <span className="text-[8px] opacity-70 mb-1">{slot.slot_code}</span>
        <span className={`text-sm font-bold ${textColor}`}>{heatData.total_kg}kg</span>
      </div>
    );
  };

  const tiers = Array.from({ length: 10 }, (_, i) => 10 - i);
  const bays = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
      
      {/* Grid Controls Header */}
      <div className="flex flex-col gap-3 bg-[#fbfdfc] dark:bg-[#142219] p-2.5 rounded-2xl border border-[#d6e9df] dark:border-[#1e382b]">
        
        {/* Top Row: Rak Selector + Allocate Button */}
        <div className="flex items-center justify-between gap-3">
          {/* Row Selector */}
          <div className="flex p-1 bg-[#d7ebe0]/50 dark:bg-[#111c15] rounded-xl">
            {['A', 'B', 'C'].map((row) => (
              <button
                key={row}
                onClick={() => setActiveRow(row as any)}
                className={`px-4 sm:px-6 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeRow === row 
                    ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-sm' 
                    : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-white'
                }`}
              >
                Rak {row}
              </button>
            ))}
          </div>

          {/* Allocate Button */}
          {user?.role === 'admin' && !isSelectionMode && viewMode !== 'heatmap' && (
            <button
              onClick={handleStartAllocation}
              className="bg-[#244b37] hover:bg-[#1b3a2b] dark:bg-[#2e7d52] dark:hover:bg-[#246341] active:scale-[0.98] text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Alokasikan Baglog</span>
            </button>
          )}
        </div>

        {/* Bottom Row: Status Filter + Batch Allocation Status Widget + View Mode */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Status Segment */}
          <div className="flex p-1 bg-[#d7ebe0]/50 dark:bg-[#111c15] rounded-xl shrink-0">
            {[
              { id: 'all', label: 'Semua (100)' },
              { id: 'occupied', label: 'Terisi' },
              { id: 'empty', label: 'Kosong' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id as any)}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                  statusFilter === f.id
                    ? 'bg-white dark:bg-[#223629] text-[#192e22] dark:text-white font-bold shadow-xs'
                    : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-white font-medium'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Tengah (Space Kosong Gambar 2): Status Alokasi Batch & Sisa Baglog Belum Terdaftar */}
          {activePreviewBatch ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all shadow-2xs overflow-hidden flex-wrap sm:flex-nowrap bg-white dark:bg-[#111c15] border-[#d6e9df] dark:border-[#1e382b]">
              <div className="flex items-center gap-1.5 font-bold text-[#192e22] dark:text-[#e4efe8] shrink-0">
                <Box className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {activeBatches.length > 1 ? (
                  <select
                    value={activePreviewBatch.id}
                    onChange={(e) => setSelectedPreviewBatchId(Number(e.target.value))}
                    className="bg-transparent font-bold text-xs text-[#192e22] dark:text-[#e4efe8] cursor-pointer outline-hidden pr-1"
                    title="Pilih batch untuk melihat status alokasi slot"
                  >
                    {activeBatches.map((b: any) => (
                      <option key={b.id} value={b.id} className="dark:bg-[#142219]">
                        {b.batch_code}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>{activePreviewBatch.batch_code}</span>
                )}
              </div>

              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>

              <div className="flex items-center gap-1.5 text-[11px] text-[#526a5e] dark:text-[#a3c9b4] shrink-0">
                <span>Total Beli:</span>
                <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">
                  {Number(activePreviewBatch.quantity).toLocaleString('id-ID')}
                </span>
                <span>Baglog</span>
              </div>

              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>

              {previewBatchUnassigned > 0 ? (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-900/60 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>
                    Belum di Rak: <strong>{previewBatchUnassigned.toLocaleString('id-ID')} Baglog</strong>
                  </span>
                  <span className="text-[10px] font-normal text-amber-700/80 dark:text-amber-400/80">
                    (~{Math.ceil(previewBatchUnassigned / 10)} slot lagi)
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900/60 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>100% Baglog Terpasang di Rak ({previewBatchAssigned.toLocaleString('id-ID')} Unit)</span>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-[#759183] dark:text-[#6b8a78] px-3 py-1.5 rounded-xl border border-dashed border-[#d6e9df] dark:border-[#1e382b]">
              <Box className="w-3.5 h-3.5 opacity-60" />
              <span>Belum ada batch baglog aktif</span>
            </div>
          )}

          {/* Mode Segment */}
          <div className="flex p-1 bg-[#d7ebe0]/50 dark:bg-[#111c15] rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('physical')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                viewMode === 'physical'
                  ? 'bg-white dark:bg-[#223629] text-[#192e22] dark:text-white font-bold shadow-xs'
                  : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-white font-medium'
              }`}
            >
              <GridIcon className="w-3.5 h-3.5" />
              Grid Fisik
            </button>
            <button
              onClick={() => setViewMode('heatmap')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                viewMode === 'heatmap'
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400 font-bold shadow-xs'
                  : 'text-[#526a5e] dark:text-[#a3c9b4] hover:text-amber-700 dark:hover:text-amber-400 font-medium'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              Peta Panen
            </button>
          </div>
        </div>

      </div>

      {/* Grid Canvas */}
      <div className="bg-[#0f1712] rounded-3xl py-5 overflow-x-auto relative shadow-inner border border-[#1e382b]">
        
        {isSlotsLoading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-emerald-500 font-bold text-sm">Mapping Koordinat Rak...</p>
            </div>
          </div>
        ) : (
          <div className="min-w-[850px] pr-6">
            {/* Headers (BAY X) */}
            <div className="flex mb-3 items-stretch">
              <div className="w-16 shrink-0 sticky left-0 z-20 bg-[#0f1712] pl-5 pr-2 border-r border-[#1e382b] flex items-center justify-center">
                <span className="text-[9px] font-bold text-[#526a5e] uppercase">TIER</span>
              </div>
              <div className="flex-1 grid grid-cols-10 gap-2 pl-2">
                {bays.map(bay => (
                  <div key={`bay-${bay}`} className="text-center text-[10px] font-bold text-[#6b8a78] uppercase">
                    BAY {bay.toString().padStart(2, '0')}
                  </div>
                ))}
              </div>
            </div>

            {/* Matrix Body */}
            <div className="flex flex-col gap-2">
              {tiers.map(tier => (
                <div key={`tier-${tier}`} className="flex items-stretch">
                  {/* Left Label (T-X) */}
                  <div className="w-16 shrink-0 text-[10px] font-bold text-[#a3c9b4] flex items-center justify-center sticky left-0 z-20 bg-[#0f1712] pl-5 pr-2 border-r border-[#1e382b] shadow-[4px_0_10px_rgba(0,0,0,0.5)]">
                    T-{tier.toString().padStart(2, '0')}
                  </div>
                  
                  {/* Row Cells */}
                  <div className="flex-1 grid grid-cols-10 gap-2 pl-2">
                    {bays.map(bay => {
                      const code = `${activeRow}-${bay.toString().padStart(2, '0')}-${tier.toString().padStart(2, '0')}`;
                      const slot = slots.find(s => s.slot_code === code);
                      
                      if (!slot) {
                        return <div key={code} className="bg-transparent border border-dashed border-slate-200 dark:border-[#1e382b] rounded-xl opacity-40 flex items-center justify-center" style={{ minHeight: '64px' }}>
                          <span className="text-[9px] text-slate-300 dark:text-[#3f5c4c]">{code}</span>
                        </div>;
                      }

                      return viewMode === 'physical' ? renderPhysicalSlot(slot) : renderHeatmapSlot(slot);
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Selection Floating Action Bar (Gambar 1) */}
      {isSelectionMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-[#142219] border border-[#d6e9df] dark:border-[#1e382b] rounded-2xl shadow-2xl p-4 flex items-center gap-4 sm:gap-6 z-50 animate-in slide-in-from-bottom-4 max-w-[90vw] flex-wrap sm:flex-nowrap justify-between">
          <div className="text-sm flex items-center flex-wrap gap-1.5">
            <span className="font-bold text-[#192e22] dark:text-white">{selectedSlotCodes.size} Slot</span>
            <span className="text-[#759183] dark:text-[#6b8a78]">terpilih</span>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
              = {selectedSlotCodes.size * 10} Baglog
            </span>
            {previewBatchUnassigned > 0 && (
              <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium hidden md:inline ml-1">
                • Sisa belum di rak: <strong>{previewBatchUnassigned} Baglog</strong>
              </span>
            )}
          </div>
          
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleCancelAllocation}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#526a5e] dark:text-[#a3c9b4] hover:bg-slate-100 dark:hover:bg-[#1e382b] transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={() => {
                if (!assignBatchId && activePreviewBatch) {
                  setAssignBatchId(activePreviewBatch.id);
                }
                setIsAssignModalOpen(true);
              }}
              disabled={selectedSlotCodes.size === 0}
              className="px-6 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all cursor-pointer"
            >
              Lanjutkan Alokasi
            </button>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111c15] rounded-3xl shadow-2xl w-full max-w-md border border-[#d6e9df] dark:border-[#1e382b] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[#edf5f0] dark:border-[#1e382b] flex justify-between items-center bg-[#f7faf8] dark:bg-[#142219] shrink-0">
              <div>
                <h3 className="text-lg font-bold text-[#192e22] dark:text-[#e4efe8]">Alokasi Batch ke Rak</h3>
                <p className="text-xs text-[#759183] dark:text-[#a3c9b4] mt-1">Mengisi {selectedSlotCodes.size} slot dengan total {selectedSlotCodes.size * 10} baglog.</p>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white dark:bg-[#111c15] text-slate-400 hover:text-rose-500 border border-[#d6e9df] dark:border-[#1e382b] hover:border-rose-200 dark:hover:border-rose-900 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#486356] dark:text-[#a3c9b4] uppercase tracking-wider">
                  Pilih Batch Aktif
                </label>
                <select
                  value={assignBatchId}
                  onChange={(e) => setAssignBatchId(Number(e.target.value))}
                  className="w-full bg-[#fbfdfc] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] rounded-xl px-3.5 py-2.5 text-sm text-[#192e22] dark:text-[#e4efe8] font-bold outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                >
                  <option value="" disabled>-- Pilih Batch Baglog --</option>
                  {activeBatches.map((b: any) => {
                    const unassigned = b.unassigned_quantity ?? Math.max(0, Number(b.quantity || 0) - Number(b.assigned_quantity || 0));
                    return (
                      <option key={b.id} value={b.id}>
                        {b.batch_code} (Total: {b.quantity} • Belum di Rak: {unassigned} Baglog)
                      </option>
                    );
                  })}
                </select>

                {/* Ringkasan Status Batch Terpilih */}
                {selectedModalBatch && (
                  <div className="p-3 rounded-xl bg-[#f7faf8] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] text-xs space-y-1.5 mt-2">
                    <div className="flex justify-between items-center text-[#526a5e] dark:text-[#a3c9b4]">
                      <span>Total Pembelian Batch:</span>
                      <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">
                        {Number(selectedModalBatch.quantity).toLocaleString('id-ID')} Baglog
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[#526a5e] dark:text-[#a3c9b4]">
                      <span>Sudah Masuk Rak:</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {Number(selectedModalBatch.assigned_quantity || 0).toLocaleString('id-ID')} Baglog ({selectedModalBatch.assigned_slots_count || Math.round(Number(selectedModalBatch.assigned_quantity || 0) / 10)} Slot)
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[#526a5e] dark:text-[#a3c9b4] pt-1.5 border-t border-[#edf5f0] dark:border-[#1e382b]">
                      <span className="font-semibold">Sisa Belum Teralokasi:</span>
                      <span className={`font-bold ${
                        (selectedModalBatch.unassigned_quantity ?? (selectedModalBatch.quantity - (selectedModalBatch.assigned_quantity || 0))) > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {Number(selectedModalBatch.unassigned_quantity ?? (selectedModalBatch.quantity - (selectedModalBatch.assigned_quantity || 0))).toLocaleString('id-ID')} Baglog
                        {' '}(~{Math.ceil((selectedModalBatch.unassigned_quantity ?? (selectedModalBatch.quantity - (selectedModalBatch.assigned_quantity || 0))) / 10)} slot lagi)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#486356] dark:text-[#a3c9b4] uppercase tracking-wider">
                  Tanggal Masuk Rak
                </label>
                <input
                  type="date"
                  value={assignDate}
                  onChange={(e) => setAssignDate(e.target.value)}
                  className="w-full bg-[#fbfdfc] dark:bg-[#0c140e] border border-[#d6e9df] dark:border-[#1e382b] rounded-xl px-3.5 py-2.5 text-sm text-[#192e22] dark:text-[#e4efe8] font-medium outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all cursor-text"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[#486356] dark:text-[#a3c9b4] uppercase tracking-wider flex items-center justify-between">
                  <span>Tingkat Kematangan Miselium</span>
                  <span className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400 lowercase">rekomendasi: level 2</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setAssignMyceliumStage('LEVEL_1')}
                    className={`p-2 rounded-xl text-[10px] font-bold transition-all border cursor-pointer ${
                      assignMyceliumStage === 'LEVEL_1'
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400'
                        : 'bg-white dark:bg-[#142219] border-[#d6e9df] dark:border-[#1e382b] text-[#759183] dark:text-[#6b8a78] hover:border-emerald-300'
                    }`}
                  >
                    Level 1 (&lt;40%)
                  </button>
                  <button
                    onClick={() => setAssignMyceliumStage('LEVEL_2')}
                    className={`p-2 rounded-xl text-[10px] font-bold transition-all border cursor-pointer ${
                      assignMyceliumStage === 'LEVEL_2'
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400'
                        : 'bg-white dark:bg-[#142219] border-[#d6e9df] dark:border-[#1e382b] text-[#759183] dark:text-[#6b8a78] hover:border-emerald-300'
                    }`}
                  >
                    Level 2 (40–80%)
                  </button>
                  <button
                    onClick={() => setAssignMyceliumStage('LEVEL_3')}
                    className={`p-2 rounded-xl text-[10px] font-bold transition-all border cursor-pointer ${
                      assignMyceliumStage === 'LEVEL_3'
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-400'
                        : 'bg-white dark:bg-[#142219] border-[#d6e9df] dark:border-[#1e382b] text-[#759183] dark:text-[#6b8a78] hover:border-emerald-300'
                    }`}
                  >
                    Level 3 (Full &gt;80%)
                  </button>
                </div>
              </div>

            </div>

            <div className="p-4 bg-[#f7faf8] dark:bg-[#142219] border-t border-[#edf5f0] dark:border-[#1e382b] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#526a5e] dark:text-[#a3c9b4] hover:bg-slate-200 dark:hover:bg-[#1e382b] transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => assignMutation.mutate()}
                disabled={assignMutation.isPending || !assignBatchId}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2"
              >
                {assignMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Check className="w-4 h-4 stroke-[3]" />
                )}
                <span>Simpan Alokasi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <SlotDetailModal 
        isOpen={!!detailModalSlot} 
        onClose={() => setDetailModalSlot(null)} 
        slot={detailModalSlot} 
        onRecordCull={(slot) => {
          setCullSlot(slot);
          setIsCullModalOpen(true);
        }}
      />

      {/* Record Cull Modal (In-Context from Slot) */}
      <RecordCullModal
        isOpen={isCullModalOpen}
        onClose={() => {
          setIsCullModalOpen(false);
          setCullSlot(null);
        }}
        batches={activeBatches}
        initialBatchId={cullSlot?.active_batch?.id}
        initialSlotCode={cullSlot?.slot_code}
        maxQuantity={cullSlot?.assignment?.active_capacity}
      />

    </div>
  );
}
