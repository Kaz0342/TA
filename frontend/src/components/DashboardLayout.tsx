import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Sprout, 
  Banknote, 
  Settings, 
  LogOut, 
  Menu,
  X,
  Clock,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { Button } from './ui';
import { cn } from '../utils/cn';

export default function DashboardLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Baglog Management', path: '/baglogs', icon: Package },
    { name: 'Harvests', path: '/harvests', icon: Sprout },
    { name: 'Sales', path: '/sales', icon: Banknote, adminOnly: true },
    { name: 'Settings', path: '/settings', icon: Settings, adminOnly: true },
  ];

  return (
    <div className="min-h-screen bg-[#f4f4f0] flex text-black transition-colors duration-200">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 bg-white border-r-4 border-black flex flex-col transition-all duration-300 ease-in-out lg:translate-x-0 lg:static shadow-[4px_0_0_0_rgba(0,0,0,1)] lg:shadow-none lg:z-10",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        isCollapsed ? "lg:w-20 w-64" : "w-64"
      )}>
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-4 border-b-4 border-black bg-[#28e085] gap-2">
          <Sprout className="w-6 h-6 stroke-[3] shrink-0" />
          <h1 className={cn(
            "text-xl font-black text-black tracking-tight transition-all duration-300 overflow-hidden whitespace-nowrap",
            isCollapsed ? "lg:w-0 lg:opacity-0" : "w-auto opacity-100"
          )}>
            Smart Shroom
          </h1>
          <button 
            className="ml-auto lg:hidden text-black hover:scale-110 active:scale-95 transition-all"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-6 h-6 stroke-[3]" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-2 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            if (item.adminOnly && user?.role !== 'admin') return null;
            const Icon = item.icon;
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={isCollapsed ? item.name : undefined}
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-4 py-3 border-4 border-transparent text-sm font-black transition-all",
                  isActive 
                    ? "bg-[#28e085] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-y-1" 
                    : "hover:bg-gray-100 border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1",
                  isCollapsed && "lg:justify-center lg:px-2"
                )}
              >
                <Icon className="w-5 h-5 stroke-[3] shrink-0" />
                <span className={cn(
                  "transition-all duration-300 overflow-hidden whitespace-nowrap",
                  isCollapsed ? "lg:w-0 lg:opacity-0" : "w-auto opacity-100"
                )}>
                  {item.name}
                </span>
              </NavLink>
            );
          })}
        </nav>

        {/* Collapse Toggle (desktop only) */}
        <div className="hidden lg:flex justify-center p-2 border-t-4 border-black">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 border-4 border-black bg-gray-100 hover:bg-yellow-400 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            title={isCollapsed ? 'Buka Sidebar' : 'Tutup Sidebar'}
          >
            {isCollapsed 
              ? <ChevronsRight className="w-5 h-5 stroke-[3]" /> 
              : <ChevronsLeft className="w-5 h-5 stroke-[3]" />
            }
          </button>
        </div>

        {/* User Info & Logout */}
        <div className="p-3 border-t-4 border-black bg-white">
          <div className={cn(
            "flex items-center gap-3 px-2 py-2 mb-3",
            isCollapsed && "lg:justify-center"
          )}>
            <div className="w-10 h-10 rounded-none border-4 border-black bg-[#28e085] flex items-center justify-center text-black font-black text-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div className={cn(
              "flex-1 min-w-0 transition-all duration-300 overflow-hidden",
              isCollapsed ? "lg:w-0 lg:opacity-0" : "w-auto opacity-100"
            )}>
              <p className="text-sm font-black truncate">{user?.name}</p>
              <p className="text-xs font-bold text-gray-600 capitalize">{user?.role}</p>
            </div>
          </div>
          <Button 
            variant="danger" 
            onClick={handleLogout} 
            className={cn(
              "w-full justify-start gap-3 border-4 border-black",
              isCollapsed && "lg:justify-center lg:px-2"
            )}
            title={isCollapsed ? 'Logout' : undefined}
          >
            <LogOut className="w-5 h-5 stroke-[3] shrink-0" />
            <span className={cn(
              "transition-all duration-300 overflow-hidden whitespace-nowrap",
              isCollapsed ? "lg:w-0 lg:opacity-0" : "w-auto opacity-100"
            )}>
              Logout
            </span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 border-b-4 border-black bg-white shrink-0">
          <button 
            className="lg:hidden text-black hover:scale-110 active:scale-95 transition-all p-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="w-6 h-6 stroke-[3]" />
          </button>

          <div className="flex-1" />

          <div className="text-sm font-black border-2 border-black px-4 py-2 bg-yellow-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
            <Clock className="w-4 h-4 stroke-[3]" />
            {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} - {time.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
