import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Sprout,
  Scale,
  Banknote,
  Settings,
  Menu,
  X,
  LogOut,
  Sun,
  Moon,
  Grid as GridIcon,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { cn } from '../utils/cn';

// Cute Mushroom Icon matching the reference mockup
const MushroomLogo = ({ className = "w-7 h-7 text-[#244b37]" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="currentColor">
    <path d="M16 4C9.5 4 4.5 9 4.5 15.5c0 1.2.9 2 2.1 2h18.8c1.2 0 2.1-.8 2.1-2C27.5 9 22.5 4 16 4z" />
    <path d="M13 18.5c-.8 0-1.5.7-1.5 1.5v6c0 1.1.9 2 2 2h5c1.1 0 2-.9 2-2v-6c0-.8-.7-1.5-1.5-1.5h-6z" opacity="0.95" />
    <circle cx="10" cy="11" r="1.4" fill="#e4f3eb" />
    <circle cx="17" cy="8.5" r="1.6" fill="#e4f3eb" />
    <circle cx="22" cy="13" r="1.2" fill="#e4f3eb" />
  </svg>
);

export default function DashboardLayout() {
  const { logout, user } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // 5 Modul Utama Tugas Akhir Smart Shroom SCM
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Manajemen Baglog', path: '/baglogs', icon: Sprout },
    { name: 'Rak Kumbung', path: '/kumbung', icon: GridIcon },
    { name: 'Hasil Panen', path: '/harvests', icon: Scale },
    // Penjualan & Keuangan hanya untuk role admin
    ...(user?.role === 'admin' ? [{ name: 'Penjualan & Cuan', path: '/sales', icon: Banknote }] : []),
    { name: 'Pengaturan', path: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen h-[100dvh] bg-[#edf5f0] dark:bg-[#0c140e] flex text-[#192e22] dark:text-[#e4efe8] antialiased transition-colors duration-200 overflow-hidden">
      {/* Mobile Sidebar Overlay Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[60] lg:hidden transition-opacity animate-in fade-in duration-200"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar — Soft Sage / Forest Dark (Drawer di Mobile, Kolom Statis di Desktop) */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-[70] bg-[#e4f3eb] dark:bg-[#111c15] border-r border-[#d2e8dc]/80 dark:border-[#1e382b] flex flex-col justify-between transition-all duration-300 ease-in-out lg:translate-x-0 lg:static w-72 lg:w-60 shrink-0",
        isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      )}>
        <div className="flex-1 overflow-y-auto">
          {/* Brand Header */}
          <div className="h-20 flex items-center justify-between px-6 border-b border-[#d2e8dc]/60 dark:border-[#1e382b]/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white dark:bg-[#182c20] border border-[#d2e8dc] dark:border-[#1e382b] flex items-center justify-center shadow-2xs">
                <MushroomLogo className="w-6 h-6 text-[#244b37] dark:text-[#86efac]" />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-[#192e22] dark:text-[#e4efe8] tracking-tight">
                  Smart Shroom
                </h1>
                <p className="text-[10px] font-semibold text-[#526a5e] dark:text-[#86efac]">
                  SCM &amp; IoT Kumbung
                </p>
              </div>
            </div>
            <button
              className="lg:hidden text-[#526a5e] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-[#e4efe8] p-2 rounded-xl bg-white/60 dark:bg-[#182c20] cursor-pointer"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Tutup menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Profile Card (Informatif di mobile saat drawer dibuka) */}
          <div className="p-4 mx-3.5 mt-3.5 rounded-2xl bg-white/70 dark:bg-[#142219]/90 border border-[#d2e8dc] dark:border-[#1e382b] shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#244b37] text-white dark:bg-[#2e7d52] dark:text-[#e4efe8] flex items-center justify-center font-bold text-sm shadow-2xs">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#192e22] dark:text-[#e4efe8] truncate">
                  {user?.name || 'Administrator'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60 uppercase">
                    <ShieldCheck className="w-3 h-3" />
                    {user?.role || 'admin'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-3.5 space-y-1.5 mt-4">
            <p className="px-3 text-[10px] font-bold text-[#759183] dark:text-[#6b8a78] uppercase tracking-wider mb-2">
              Menu Navigasi
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-150 group",
                    isActive
                      ? "bg-[#bde5d1] dark:bg-[#1f3a2b] text-[#1c382b] dark:text-[#86efac] font-bold shadow-2xs"
                      : "text-[#37473f] dark:text-[#a3c9b4] hover:bg-[#d8ece1]/60 dark:hover:bg-[#182c20] hover:text-[#192e22] dark:hover:text-[#e4efe8]"
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0 stroke-[2.2] group-hover:scale-105 transition-transform" />
                  <span className="flex-1">{item.name}</span>
                  <ChevronRight className="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Quick Controls: Theme Toggle & Logout */}
        <div className="p-4 border-t border-[#d2e8dc]/70 dark:border-[#1e382b] space-y-2 bg-[#e4f3eb] dark:bg-[#111c15]">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold text-[#244b37] dark:text-[#a3c9b4] bg-[#d7ebe0]/70 dark:bg-[#182c20] hover:bg-[#d7ebe0] dark:hover:bg-[#1f3a2b] transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
            title={theme === 'dark' ? 'Ganti ke Tema Terang' : 'Ganti ke Tema Gelap'}
          >
            <div className="flex items-center gap-2.5">
              {theme === 'dark' ? (
                <Moon className="w-4 h-4 text-emerald-400 stroke-[2.2]" />
              ) : (
                <Sun className="w-4 h-4 text-amber-600 stroke-[2.2]" />
              )}
              <span>{theme === 'dark' ? 'Mode Gelap' : 'Mode Terang'}</span>
            </div>
            <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-white dark:bg-[#142219] text-[#192e22] dark:text-[#e4efe8] shadow-2xs">
              {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
          </button>

          {/* Logout Button */}
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-2xl text-xs font-bold text-[#b91c1c] dark:text-[#f87171] bg-[#fff0f0] dark:bg-[#2a1717] hover:bg-[#ffe5e5] dark:hover:bg-[#3b1c1c] border border-[#fecaca] dark:border-[#4a2020] shadow-2xs hover:shadow-xs active:scale-[0.98] transition-all cursor-pointer group"
            title="Keluar dari akun Smart Shroom"
          >
            <LogOut className="w-4 h-4 text-[#dc2626] dark:text-[#ef4444] stroke-[2.2] group-hover:-translate-x-0.5 transition-transform" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden relative">
        {/* Mobile Top App Bar (Satu-satunya Header Navigasi di Mobile) */}
        <header className="lg:hidden shrink-0 flex items-center justify-between px-4 py-3 bg-[#e4f3eb] dark:bg-[#111c15] border-b border-[#d2e8dc] dark:border-[#1e382b] z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white dark:bg-[#182c20] border border-[#d2e8dc] dark:border-[#1e382b] flex items-center justify-center shadow-2xs">
              <MushroomLogo className="w-5 h-5 text-[#244b37] dark:text-[#86efac]" />
            </div>
            <div>
              <span className="font-extrabold text-sm text-[#192e22] dark:text-[#e4efe8] block leading-tight">
                Smart Shroom
              </span>
              <span className="text-[10px] text-[#526a5e] dark:text-[#a3c9b4] font-medium">
                Sistem Kumbung IoT
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-white dark:bg-[#182c20] text-[#192e22] dark:text-[#86efac] border border-[#d2e8dc] dark:border-[#1e382b] shadow-2xs active:scale-90 transition-transform cursor-pointer"
              title="Toggle Dark Mode"
              aria-label="Ganti mode gelap/terang"
            >
              {theme === 'dark' ? <Moon className="w-4 h-4 text-emerald-400" /> : <Sun className="w-4 h-4 text-amber-600" />}
            </button>

            {/* Hamburger Drawer Toggle */}
            <button
              type="button"
              className="px-3 py-2 rounded-xl bg-white dark:bg-[#182c20] text-[#192e22] dark:text-[#e4efe8] border border-[#d2e8dc] dark:border-[#1e382b] shadow-2xs active:scale-90 transition-transform cursor-pointer flex items-center gap-1.5 touch-manipulation select-none"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Buka menu lengkap"
            >
              <Menu className="w-4 h-4" />
              <span className="text-xs font-bold">Menu</span>
            </button>
          </div>
        </header>

        {/* Scrollable Main Viewport */}
        <div className="flex-1 overflow-y-auto px-3.5 sm:px-8 py-4 sm:py-8 pb-6 sm:pb-8 bg-[#edf5f0] dark:bg-[#0c140e] transition-colors duration-200">
          <div className="max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
