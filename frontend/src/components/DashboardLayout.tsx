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
  Moon
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
    { name: 'Hasil Panen', path: '/harvests', icon: Scale },
    // Penjualan & Keuangan hanya untuk role admin
    ...(user?.role === 'admin' ? [{ name: 'Penjualan & Cuan', path: '/sales', icon: Banknote }] : []),
    { name: 'Pengaturan', path: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#edf5f0] dark:bg-[#0c140e] flex text-[#192e22] dark:text-[#e4efe8] antialiased transition-colors duration-200">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar — Soft Sage / Forest Dark */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 bg-[#e4f3eb] dark:bg-[#111c15] border-r border-[#d2e8dc]/70 dark:border-[#1e382b] flex flex-col justify-between transition-all duration-300 ease-in-out lg:translate-x-0 lg:static w-60 shrink-0",
        isSidebarOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"
      )}>
        <div>
          {/* Brand Header */}
          <div className="h-20 flex items-center px-6 gap-3 pt-2">
            <MushroomLogo className="w-8 h-8 text-[#244b37] dark:text-[#86efac]" />
            <h1 className="text-xl font-bold text-[#192e22] dark:text-[#e4efe8] tracking-tight">
              Smart Shroom
            </h1>
            <button 
              className="ml-auto lg:hidden text-[#37473f] dark:text-[#a3c9b4] hover:text-[#192e22] dark:hover:text-[#e4efe8] p-1.5 rounded-lg"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="px-3.5 space-y-1.5 mt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              
              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-150",
                    isActive 
                      ? "bg-[#bde5d1] dark:bg-[#1f3a2b] text-[#1c382b] dark:text-[#86efac] font-bold shadow-2xs" 
                      : "text-[#37473f] dark:text-[#a3c9b4] hover:bg-[#d8ece1]/60 dark:hover:bg-[#182c20] hover:text-[#192e22] dark:hover:text-[#e4efe8]"
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0 stroke-[2.2]" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Quick Controls: Theme Toggle & Logout */}
        <div className="p-4 border-t border-[#d2e8dc]/70 dark:border-[#1e382b] space-y-2">
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
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Header Toggle */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-[#e4f3eb] dark:bg-[#111c15] border-b border-[#d2e8dc] dark:border-[#1e382b]">
          <div className="flex items-center gap-2">
            <MushroomLogo className="w-7 h-7 text-[#244b37] dark:text-[#86efac]" />
            <span className="font-bold text-[#192e22] dark:text-[#e4efe8]">Smart Shroom</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-white/80 dark:bg-[#182c20] text-[#192e22] dark:text-[#86efac] shadow-2xs transition-all cursor-pointer"
              title="Toggle Dark Mode"
            >
              {theme === 'dark' ? <Moon className="w-5 h-5 text-emerald-400" /> : <Sun className="w-5 h-5 text-amber-600" />}
            </button>
            <button 
              className="p-2 rounded-xl bg-white/80 dark:bg-[#182c20] text-[#192e22] dark:text-[#e4efe8] shadow-2xs cursor-pointer"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Main Viewport */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8 bg-[#edf5f0] dark:bg-[#0c140e] transition-colors duration-200">
          <div className="max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

