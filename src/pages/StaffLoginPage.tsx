/**
 * Staff Login Page for ABC Hotel Internal Employees
 * Clean, Minimal, Production-Grade Authentication UI
 */
import React, { useState } from 'react';
import { Shield, Lock, User as UserIcon, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

export const StaffLoginPage: React.FC<{ navigate: (route: string) => void }> = ({ navigate }) => {
  const { login } = useAuth();
  const { error, success } = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      error('Please fill in both username/email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const loggedUser = await login({ username: username.trim(), password });
      success(`Welcome back, ${loggedUser.firstName}!`);

      // Role-based navigation
      if (loggedUser.role === 'DELIVERY') {
        navigate('delivery');
      } else if (loggedUser.role === 'KITCHEN') {
        navigate('kitchen');
      } else if (loggedUser.role === 'ADMIN' || loggedUser.role === 'MANAGER' || loggedUser.role === 'STAFF') {
        navigate('admin');
      } else {
        navigate('home');
      }
    } catch (err: any) {
      error(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-stone-100">
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-stone-200 grid grid-cols-1 lg:grid-cols-12">
        {/* Left Side: Brand Banner */}
        <div className="lg:col-span-5 bg-gradient-to-br from-stone-900 via-stone-900 to-purple-950 text-white p-6 sm:p-8 lg:p-10 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 opacity-15">
            <img
              src="https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80"
              alt="Hotel Operations"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="relative z-10 space-y-4">
            <button
              onClick={() => navigate('home')}
              className="inline-flex items-center gap-2 text-xs font-semibold text-amber-300 hover:text-white transition-colors cursor-pointer bg-white/10 px-3 py-1.5 rounded-full border border-white/15 min-h-[36px]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Guest Portal</span>
            </button>

            <div className="pt-2 sm:pt-4 space-y-1.5 sm:space-y-2">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-600 flex items-center justify-center font-serif font-bold text-lg sm:text-xl text-white shadow-lg">
                ABC
              </div>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-white">Internal Staff Portal</h2>
              <p className="text-[11px] sm:text-xs text-stone-300 tracking-wider uppercase font-semibold">
                ABC Hotel Operations Suite
              </p>
            </div>
          </div>

          <div className="relative z-10 space-y-2 sm:space-y-3 py-4 sm:py-6 border-y border-white/10 my-4 sm:my-6">
            <p className="text-xs text-stone-300 leading-relaxed font-light">
              Secure authentication for hotel administration, restaurant managers, floor staff, kitchen display systems, and delivery riders.
            </p>
          </div>

          <div className="relative z-10 p-3 sm:p-3.5 rounded-xl bg-white/10 border border-white/15 text-[11px] text-stone-300 flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Staff access is monitored and restricted to authorized personnel.</span>
          </div>
        </div>

        {/* Right Side: Staff Form */}
        <div className="lg:col-span-7 p-5 sm:p-8 lg:p-10 flex flex-col justify-center space-y-6">
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold uppercase tracking-wider mb-2">
              Employee Login
            </span>
            <h3 className="font-serif font-bold text-xl sm:text-2xl text-stone-900">Login as Staff</h3>
            <p className="text-xs text-stone-500 mt-1">
              Enter your assigned employee username or email address and password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-700">Username or Email</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter Username or Email"
                  className="w-full pl-10 pr-3.5 py-3 bg-stone-50 border border-stone-200 rounded-xl text-base sm:text-xs text-stone-900 focus:border-amber-600 focus:bg-white transition-all outline-none"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-700">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Password"
                  className="w-full pl-10 pr-3.5 py-3 bg-stone-50 border border-stone-200 rounded-xl text-base sm:text-xs text-stone-900 focus:border-amber-600 focus:bg-white transition-all outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-stone-900 hover:bg-stone-800 active:bg-black text-amber-300 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2 min-h-[44px]"
            >
              <span>{submitting ? 'Authenticating...' : 'Login to Staff Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Quick Demo Access Credentials */}
            <div className="pt-2">
              <p className="text-[11px] font-semibold text-stone-500 mb-2 uppercase tracking-wider">
                Demo Quick Access (Click to Fill):
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => { setUsername('admin'); setPassword('Password@123'); }}
                  className="px-2.5 py-1.5 bg-stone-50 hover:bg-amber-50 hover:border-amber-300 border border-stone-200 rounded-lg text-left transition-colors cursor-pointer"
                >
                  <span className="font-bold block text-stone-800">👑 Admin</span>
                  <span className="text-[10px] text-stone-500 font-mono">admin / Password@123</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setUsername('manager'); setPassword('Password@123'); }}
                  className="px-2.5 py-1.5 bg-stone-50 hover:bg-amber-50 hover:border-amber-300 border border-stone-200 rounded-lg text-left transition-colors cursor-pointer"
                >
                  <span className="font-bold block text-stone-800">👔 Manager</span>
                  <span className="text-[10px] text-stone-500 font-mono">manager / Password@123</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setUsername('staff'); setPassword('Password@123'); }}
                  className="px-2.5 py-1.5 bg-stone-50 hover:bg-amber-50 hover:border-amber-300 border border-stone-200 rounded-lg text-left transition-colors cursor-pointer"
                >
                  <span className="font-bold block text-stone-800">🛎️ Staff</span>
                  <span className="text-[10px] text-stone-500 font-mono">staff / Password@123</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setUsername('kitchen'); setPassword('Password@123'); }}
                  className="px-2.5 py-1.5 bg-stone-50 hover:bg-amber-50 hover:border-amber-300 border border-stone-200 rounded-lg text-left transition-colors cursor-pointer"
                >
                  <span className="font-bold block text-stone-800">🍳 Kitchen</span>
                  <span className="text-[10px] text-stone-500 font-mono">kitchen / Password@123</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setUsername('delivery'); setPassword('Password@123'); }}
                  className="px-2.5 py-1.5 bg-stone-50 hover:bg-amber-50 hover:border-amber-300 border border-stone-200 rounded-lg text-left transition-colors cursor-pointer col-span-2 sm:col-span-1"
                >
                  <span className="font-bold block text-stone-800">🚴 Delivery</span>
                  <span className="text-[10px] text-stone-500 font-mono">delivery / Password@123</span>
                </button>
              </div>
            </div>

            {/* Switch to Customer Login / Register */}
            <div className="pt-4 border-t border-stone-100 text-center">
              <button
                type="button"
                onClick={() => navigate('customer-auth')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer transition-colors min-h-[44px] px-3"
              >
                <span>Are you a guest? <strong>Login / Register as Customer →</strong></span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
