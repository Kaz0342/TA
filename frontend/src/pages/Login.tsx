import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import { Card, Button } from '../components/ui';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/login', { email, password });
      if (response.data.success) {
        const { user, token } = response.data.data;
        setAuth(user, token);
        navigate('/'); // Redirect to dashboard
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login gagal. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2 tracking-tight">Smart Shroom</h1>
          <p className="text-slate-500 dark:text-slate-400">Supply Chain Management System</p>
        </div>

        <Card className="shadow-xl border-t-4 border-t-primary">
          <h2 className="text-2xl font-semibold text-slate-800 dark:text-white mb-6">Login</h2>
          
          {error && (
            <div className="bg-danger/10 text-danger border border-danger/20 p-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                className="input-field"
                placeholder="admin@smartshroom.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <div className="pt-2">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Authenticating...' : 'Sign In'}
              </Button>
            </div>
          </form>

          {/* Quick Demo Accounts for TA Defense */}
          <div className="mt-6 pt-5 border-t-2 border-dashed border-gray-300">
            <p className="text-xs font-black uppercase tracking-wider text-gray-500 mb-3 text-center">
              Pilih Akun Demo (Tugas Akhir):
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@smartshroom.com');
                  setPassword('password123');
                }}
                className="p-2 border-2 border-black bg-[#28e085] hover:bg-green-400 font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex flex-col items-center justify-center text-black"
              >
                <span className="font-black text-xs">Admin (Full Akses)</span>
                <span className="text-[10px] text-gray-700">admin@smartshroom.com</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('worker@smartshroom.com');
                  setPassword('password123');
                }}
                className="p-2 border-2 border-black bg-yellow-300 hover:bg-yellow-400 font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex flex-col items-center justify-center text-black"
              >
                <span className="font-black text-xs">Worker (Operasional)</span>
                <span className="text-[10px] text-gray-700">worker@smartshroom.com</span>
              </button>
            </div>
          </div>
        </Card>
        
        <p className="text-center text-sm text-slate-400 mt-8">
          &copy; {new Date().getFullYear()} Smart Shroom SCM. All rights reserved.
        </p>
      </div>
    </div>
  );
}
