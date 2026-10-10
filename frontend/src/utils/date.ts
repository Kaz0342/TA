/**
 * Utilitas format tanggal konsisten untuk waktu lokal Indonesia Barat (WIB / Asia/Jakarta).
 * Mencegah bug toISOString().split('T')[0] yang memotong string jam UTC (AUD-05)
 * dan menyajikan format umum Indonesia: Tanggal-Bulan-Tahun (DD/MM/YYYY atau DD MMMM YYYY).
 */

/**
 * Mengembalikan tanggal hari ini dalam format YYYY-MM-DD berbasis timezone Asia/Jakarta (WIB).
 * Digunakan untuk nilai value form <input type="date"> HTML5.
 */
export function getTodayWIBString(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date()); // Menghasilkan "YYYY-MM-DD"
  } catch {
    return toLocalDateString(new Date());
  }
}

/**
 * Mengubah objek Date ke string YYYY-MM-DD berdasarkan waktu lokal browser.
 */
export function toLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type IndoDateFormatMode = 'short' | 'long' | 'numeric' | 'full';

/**
 * Format string tanggal (YYYY-MM-DD) atau objek Date ke tampilan standar Indonesia (Tanggal - Bulan - Tahun).
 *
 * Contoh hasil:
 * - 'short'   : "10 Okt 2026"
 * - 'long'    : "10 Oktober 2026"
 * - 'numeric' : "10/10/2026"
 * - 'full'    : "Sabtu, 10 Oktober 2026"
 */
export function formatWIBDate(
  dateInput: string | Date | null | undefined,
  modeOrOptions: IndoDateFormatMode | Intl.DateTimeFormatOptions = 'short'
): string {
  if (!dateInput) return '-';

  let dateObj: Date;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    dateObj = new Date(year, month - 1, day);
  } else if (typeof dateInput === 'string') {
    dateObj = new Date(dateInput);
  } else {
    dateObj = dateInput;
  }

  if (isNaN(dateObj.getTime())) return String(dateInput);

  if (typeof modeOrOptions === 'string') {
    switch (modeOrOptions) {
      case 'numeric':
        return `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
      case 'long':
        return dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      case 'full':
        return dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      case 'short':
      default:
        return dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  }

  return dateObj.toLocaleDateString('id-ID', modeOrOptions);
}

/**
 * Helper singkat format numerik Indonesia: DD/MM/YYYY
 */
export function formatIndoNumeric(dateInput: string | Date | null | undefined): string {
  return formatWIBDate(dateInput, 'numeric');
}
