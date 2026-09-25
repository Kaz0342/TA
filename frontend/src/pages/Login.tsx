import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldCheck, 
  Sprout, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

// Mushroom Logo matching the Sage Green brand
const MushroomLogo = ({ className = "w-9 h-9 text-[#244b37] dark:text-[#86efac]" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 32 32" fill="currentColor">
    <path d="M16 4C9.5 4 4.5 9 4.5 15.5c0 1.2.9 2 2.1 2h18.8c1.2 0 2.1-.8 2.1-2C27.5 9 22.5 4 16 4z" />
    <path d="M13 18.5c-.8 0-1.5.7-1.5 1.5v6c0 1.1.9 2 2 2h5c1.1 0 2-.9 2-2v-6c0-.8-.7-1.5-1.5-1.5h-6z" opacity="0.95" />
    <circle cx="10" cy="11" r="1.4" fill="currentColor" opacity="0.3" />
    <circle cx="17" cy="8.5" r="1.6" fill="currentColor" opacity="0.3" />
    <circle cx="22" cy="13" r="1.2" fill="currentColor" opacity="0.3" />
  </svg>
);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/login', { email: email.trim(), password });
      if (response.data.success) {
        const { user, token } = response.data.data;
        setAuth(user, token);
        navigate('/'); // Redirect to dashboard
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login gagal. Silakan periksa kembali email & password lo.');
    } finally {
      setLoading(false);
    }
  };

  const setDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    setError('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#edf5f0] dark:bg-[#0c140e] p-4 sm:p-6 text-[#192e22] dark:text-[#e4efe8] antialiased transition-colors duration-300">
      
      {/* Background Decorative Ambient Blurs */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-200/40 dark:bg-emerald-950/20 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-10 right-10 w-72 h-72 bg-emerald-100/50 dark:bg-emerald-900/10 rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-white dark:bg-[#142219] border border-[#d6e9df] dark:border-[#1e382b] shadow-sm mb-1">
            <MushroomLogo className="w-9 h-9 text-[#244b37] dark:text-[#86efac]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#192e22] dark:text-[#e4efe8]">
            Smart Shroom SCM
          </h1>
          <p className="text-xs sm:text-sm font-medium text-[#486356] dark:text-[#a3c9b4]">
            Sistem Pemantauan IoT &amp; Rantai Pasok Budidaya Jamur Kuping
          </p>
        </div>

        {/* Login Card Container */}
        <div className="bg-white dark:bg-[#142219] rounded-3xl border border-[#d6e9df] dark:border-[#1e382b] p-7 sm:p-9 shadow-[0_12px_36px_rgba(25,46,34,0.06)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.4)] space-y-5">
          
          <div className="border-b border-[#eef5f1] dark:border-[#1e382b] pb-3">
            <h2 className="text-lg font-bold text-[#192e22] dark:text-[#e4efe8]">Masuk ke Sistem</h2>
            <p className="text-xs text-[#759183] dark:text-[#6b8a78] mt-0.5">
              Gunakan kredensial akun lo untuk mengakses dashboard
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            
            {/* Email Input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="admin@smartshroom.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] text-sm font-semibold text-[#192e22] dark:text-[#e4efe8] focus:outline-none focus:ring-1 focus:ring-[#244b37] dark:focus:ring-[#4ade80] placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#192e22] dark:text-[#e4efe8] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-2.5 rounded-2xl bg-[#f7faf8] dark:bg-[#111c15] border border-[#d6e9df] dark:border-[#1e382b] text-sm font-semibold text-[#192e22] dark:text-[#e4efe8] focus:outline-none focus:ring-1 focus:ring-[#244b37] dark:focus:ring-[#4ade80] placeholder-slate-400 dark:placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-[#192e22] dark:hover:text-[#e4efe8] transition-colors p-0.5 cursor-pointer"
                  title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#244b37] hover:bg-[#1b3a2b] dark:bg-[#2e7d52] dark:hover:bg-[#246341] active:scale-[0.98] text-white py-3 px-4 rounded-2xl font-bold text-sm shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mengautentikasi...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Dashboard</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                  </>
                )}
              </button>
            </div>

          </form>

          {/* Quick Demo Accounts for TA Defense */}
          <div className="pt-4 border-t border-[#eef5f1] dark:border-[#1e382b] space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#759183] dark:text-[#6b8a78] text-center">
              Pilih Akun Demo (Sidang Tugas Akhir):
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              {/* Demo Admin */}
              <button
                type="button"
                onClick={() => setDemoAccount('admin@smartshroom.com')}
                className="p-3 rounded-2xl bg-[#f7faf8] dark:bg-[#111c15] hover:bg-[#edf5f0] dark:hover:bg-[#18291d] border border-[#d6e9df] dark:border-[#1e382b] text-left transition-all active:scale-[0.98] cursor-pointer group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-xl bg-[#e8f4ed] dark:bg-[#1b3324] text-[#244b37] dark:text-[#86efac] flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-[#192e22] dark:text-[#e4efe8]">Administrator</span>
                </div>
                <p className="text-[11px] text-[#759183] dark:text-[#6b8a78] truncate group-hover:text-[#192e22] dark:group-hover:text-[#e4efe8]">
                  admin@smartshroom.com
                </p>
                <span className="inline-block text-[10px] font-bold text-[#244b37] dark:text-[#86efac] mt-1">
                  Full Akses (Semua Modul)
                </span>
              </button>

              {/* Demo Worker */}
              <button
                type="button"
                onClick={() => setDemoAccount('worker@smartshroom.com')}
                className="p-3 rounded-2xl bg-[#f7faf8] dark:bg-[#111c15] hover:bg-[#edf5f0] dark:hover:bg-[#18291d] border border-[#d6e9df] dark:border-[#1e382b] text-left transition-all active:scale-[0.98] cursor-pointer group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-xl bg-[#e8f4fd] dark:bg-[#0f283d] text-[#0284c7] dark:text-[#38bdf8] flex items-center justify-center shrink-0">
                    <Sprout className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-[#192e22] dark:text-[#e4efe8]">Pekerja Kebun</span>
                </div>
                <p className="text-[11px] text-[#759183] dark:text-[#6b8a78] truncate group-hover:text-[#192e22] dark:group-hover:text-[#e4efe8]">
                  worker@smartshroom.com
                </p>
                <span className="inline-block text-[10px] font-bold text-[#0284c7] dark:text-[#38bdf8] mt-1">
                  Operasional &amp; Timbangan
                </span>
              </button>

            </div>
          </div>

        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#759183] dark:text-[#6b8a78] font-medium">
          &copy; {new Date().getFullYear()} Smart Shroom SCM • Budidaya Jamur Kuping Hitam
        </p>

      </div>
    </div>
  );
}
