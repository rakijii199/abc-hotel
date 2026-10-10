/**
 * Staff Login Page for ABC Hotel Internal Employees
 * Clean, Minimal, Production-Grade Authentication UI
 */
import React, { useState } from 'react';
import {
  Shield,
  Lock,
  User as UserIcon,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Briefcase,
  ConciergeBell,
  ChefHat,
  Truck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { LUX_IMAGES, hideOnError, luxImage } from '../components/customer/Reveal.tsx';

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

  const demoAccounts = [
    { username: 'admin', label: 'Admin', icon: ShieldCheck },
    { username: 'manager', label: 'Manager', icon: Briefcase },
    { username: 'staff', label: 'Staff', icon: ConciergeBell },
    { username: 'kitchen', label: 'Kitchen', icon: ChefHat },
    { username: 'delivery', label: 'Delivery', icon: Truck }
  ];

  const inputClass =
    'w-full h-12 pl-11 pr-4 bg-white/70 border border-stone-200 rounded-xl text-base sm:text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-200/40 transition-all outline-none';

  return (
    <div className="relative min-h-[calc(100svh-4rem)] flex items-center justify-center px-4 py-10 sm:p-8 lg:p-12 bg-ink overflow-hidden lux-grain">
      {/* Backdrop */}
      <img
        src={luxImage(LUX_IMAGES.interior, 2000)}
        alt=""
        aria-hidden="true"
        onError={hideOnError}
        className="absolute inset-0 w-full h-full object-cover opacity-30 lux-kenburns"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink/80 to-wine/40" />
      <div className="absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full bg-wine/30 blur-[130px] pointer-events-none" />

      <div className="relative w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 rounded-[1.5rem] overflow-hidden border border-white/10 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.9)] animate-[lux-rise_0.8s_var(--ease-lux)]">
        {/* Left Side: Brand Panel (glass) */}
        <div className="lg:col-span-5 relative bg-white/[0.04] backdrop-blur-xl text-ivory p-7 sm:p-10 flex flex-col justify-between gap-10 overflow-hidden">
          <div className="absolute inset-0 opacity-25 pointer-events-none">
            <img src={luxImage(LUX_IMAGES.dishE, 900)} alt="" aria-hidden="true" onError={hideOnError} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/60 to-ink" />
          </div>

          <div className="relative space-y-10">
            <button
              onClick={() => navigate('home')}
              className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-champagne/90 hover:text-ivory transition-colors cursor-pointer min-h-[36px]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Guest Portal</span>
            </button>

            <div>
              <span className="relative w-14 h-14 flex items-center justify-center border border-gold/60 text-champagne">
                <span className="absolute inset-[4px] border border-gold/25" />
                <span className="font-display text-lg font-semibold tracking-[0.06em]">ABC</span>
              </span>
              <p className="lux-eyebrow text-gold mt-8">ABC Hotel Operations Suite</p>
              <h2 className="lux-display text-[clamp(2.4rem,4.5vw,3.5rem)] text-ivory mt-4">
                Internal <em className="font-normal text-champagne">Staff Portal</em>
              </h2>
              <p className="text-sm text-ivory/60 leading-relaxed mt-5 max-w-sm">
                Secure authentication for hotel administration, restaurant managers, floor staff, kitchen display
                systems, and delivery riders.
              </p>
            </div>
          </div>

          <div className="relative flex items-center gap-3 text-[11px] text-ivory/55 border-t border-white/10 pt-5">
            <Shield className="w-4 h-4 text-gold shrink-0" />
            <span>Staff access is monitored and restricted to authorized personnel.</span>
          </div>
        </div>

        {/* Right Side: Staff Form */}
        <div className="lg:col-span-7 bg-[#fffdf9] p-6 sm:p-10 lg:p-12 flex flex-col justify-center gap-7">
          <div>
            <p className="lux-eyebrow text-amber-700">Employee Login</p>
            <h3 className="lux-display text-4xl sm:text-5xl text-stone-900 mt-3">Login as Staff</h3>
            <p className="text-sm text-stone-500 mt-3">
              Enter your assigned employee username or email address and password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="staff-username" className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-600">
                Username or Email
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  id="staff-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter Username or Email"
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="staff-password" className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-600">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  id="staff-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Password"
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="lux-btn lux-btn-wine w-full !min-h-[3.25rem] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span>{submitting ? 'Authenticating...' : 'Login to Staff Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Quick Demo Access Credentials */}
            <div className="pt-2">
              <p className="text-[10px] font-bold text-stone-400 mb-3 uppercase tracking-[0.2em]">
                Demo Quick Access (Click to Fill)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {demoAccounts.map(({ username: demoUser, label, icon: Icon }) => (
                  <button
                    key={demoUser}
                    type="button"
                    onClick={() => { setUsername(demoUser); setPassword('Password@123'); }}
                    className={`group px-3 py-2.5 bg-white border rounded-xl text-left transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-16px_rgba(26,23,21,0.5)] ${
                      username === demoUser ? 'border-amber-500 ring-2 ring-amber-200/60' : 'border-stone-200 hover:border-amber-300'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-semibold text-xs text-stone-800">
                      <Icon className="w-3.5 h-3.5 text-amber-600" />
                      {label}
                    </span>
                    <span className="text-[10px] text-stone-400 font-mono block mt-0.5">{demoUser} / Password@123</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Switch to Customer Login / Register */}
            <div className="pt-4 border-t border-stone-200/70 text-center">
              <button
                type="button"
                onClick={() => navigate('customer-auth')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer transition-colors min-h-[44px] px-3"
              >
                <span>Are you a guest? <strong className="text-wine">Login / Register as Customer →</strong></span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
