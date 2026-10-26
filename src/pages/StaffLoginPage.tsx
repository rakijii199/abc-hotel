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
  Truck,
  ShoppingBag,
  Receipt
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { BrandIcon, BrandName } from '../components/common/BrandMark.tsx';


const SHOW_DEMO_LOGINS = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_LOGINS === 'true';
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
    'w-full h-12 pl-11 pr-4 bg-[var(--brand-soft)]/60 border border-stone-200 rounded-xl text-base sm:text-sm text-stone-900 placeholder:text-stone-400 hover:border-stone-300 focus:border-amber-700 focus:bg-white focus:ring-4 focus:ring-[var(--brand-ring-soft)] transition-all outline-none';

  // Decorative feature list (presentational only)
  const features = [
    { icon: ShoppingBag, line1: 'Orders', line2: '& POS' },
    { icon: ChefHat, line1: 'Kitchen', line2: '& Delivery' },
    { icon: Receipt, line1: 'Billing', line2: '& Reports' }
  ];

  return (
    <div className="theme-staff ambient-staff min-h-[calc(100svh-4rem)] flex items-center justify-center px-4 py-10 sm:px-8 lg:px-12 overflow-hidden">
      {/* Decorative blurred blobs */}
      <div className="absolute -top-28 -left-24 w-[420px] h-[420px] rounded-full bg-brand-200/35 blur-[110px] pointer-events-none -z-10" aria-hidden="true" />
      <div className="absolute top-1/3 -right-32 w-[360px] h-[360px] rounded-full bg-brand-100/50 blur-[120px] pointer-events-none -z-10" aria-hidden="true" />

      <div className="relative w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center animate-[lux-rise_0.8s_var(--ease-lux)]">
        {/* Left column: brand story (below the form on mobile) */}
        <div className="order-2 lg:order-1 space-y-8">
          <button
            onClick={() => navigate('home')}
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800 hover:text-stone-900 transition-colors cursor-pointer min-h-[36px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Guest Portal</span>
          </button>

          <div className="flex items-center gap-3">
            <BrandIcon size="lg" />
            <BrandName size="md" />
          </div>

          <div>
            <p className="lux-eyebrow text-amber-700">ABC Hotel Operations Suite</p>
            <h2 className="lux-display !font-lux !font-extrabold text-[clamp(2.1rem,4vw,3.25rem)] !leading-[1.08] tracking-[-0.02em] text-stone-900 mt-4">
              Run every shift,
              <span className="block text-amber-800">serve every guest.</span>
            </h2>
            <p className="text-sm sm:text-[15px] text-stone-600 leading-relaxed mt-5 max-w-md">
              Secure authentication for hotel administration, restaurant managers, floor staff, kitchen display
              systems, and delivery riders.
            </p>
          </div>

          <ul className="grid grid-cols-3 gap-3 max-w-md">
            {features.map(({ icon: Icon, line1, line2 }) => (
              <li key={line1} className="flex items-center gap-2.5">
                <span className="w-10 h-10 shrink-0 rounded-full bg-white border border-[var(--brand-border)] shadow-[var(--shadow-card)] flex items-center justify-center text-amber-800">
                  <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                </span>
                <span className="text-xs font-semibold text-stone-800 leading-tight">
                  {line1}
                  <span className="block text-stone-500 font-medium">{line2}</span>
                </span>
              </li>
            ))}
          </ul>

          {/* Decorative mini dashboard (purely visual) */}
          <div className="hidden lg:block max-w-md" aria-hidden="true">
            <div className="bg-white/80 border border-white rounded-2xl shadow-[var(--shadow-raised)] p-4 space-y-3 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="h-2.5 w-24 rounded-full bg-stone-200" />
                <span className="h-2.5 w-10 rounded-full bg-[var(--brand-soft)] border border-[var(--brand-border)]" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rounded-xl border border-stone-100 bg-[var(--surface-muted)] p-2.5 space-y-1.5">
                    <span className="block h-1.5 w-8 rounded-full bg-stone-200" />
                    <span className={`block h-3 rounded-full ${i === 0 ? 'w-12 bg-amber-700/80' : 'w-10 bg-stone-300'}`} />
                  </div>
                ))}
              </div>
              <div className="flex items-end gap-1.5 h-12">
                {[40, 65, 50, 80, 60, 92, 72].map((h, i) => (
                  <span key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-amber-700/70 to-amber-400/50" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-stone-600">
            <Shield className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Staff access is monitored and restricted to authorized personnel.</span>
          </div>
        </div>

        {/* Right column: sign-in card */}
        <div className="order-1 lg:order-2 w-full max-w-lg mx-auto lg:mx-0 lg:justify-self-end">
          <div className="relative bg-white rounded-3xl border border-white shadow-[var(--shadow-float)] p-6 sm:p-10 flex flex-col gap-7">
            {/* Card header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <BrandIcon size="sm" />
                <BrandName size="sm" />
              </div>
              <span className="relative inline-block -rotate-6 mt-1 mr-1 font-display italic text-2xl text-amber-800 select-none whitespace-nowrap" aria-hidden="true">
                Welcome back!
                <svg className="absolute left-2 -bottom-2 w-[85%] h-2.5 text-amber-600/70" viewBox="0 0 120 10" fill="none" preserveAspectRatio="none">
                  <path d="M2 7 C 30 1, 70 1, 118 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
            </div>

            <div>
              <p className="lux-eyebrow text-amber-700">Employee Login</p>
              <h3 className="lux-display !font-lux !font-extrabold text-3xl sm:text-[2.1rem] tracking-[-0.02em] text-stone-900 mt-2">
                Sign in <span className="sr-only">as Staff</span>
              </h3>
              <p className="text-sm text-stone-500 mt-2">
                Enter your assigned employee username or email address and password.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="staff-username" className="text-xs font-semibold text-stone-700">
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
                <label htmlFor="staff-password" className="text-xs font-semibold text-stone-700">
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
                className="btn btn-primary w-full !min-h-[3.25rem] !rounded-xl !text-sm !font-bold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span>{submitting ? 'Authenticating...' : 'Login to Staff Portal'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Quick Demo Access Credentials — never shipped in production builds
                  unless a demo deployment explicitly opts in. */}
              {SHOW_DEMO_LOGINS && (
              <div className="pt-2">
                <p className="text-[10px] font-bold text-stone-500 mb-3 uppercase tracking-[0.2em]">
                  Demo Quick Access (Click to Fill)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {demoAccounts.map(({ username: demoUser, label, icon: Icon }) => (
                    <button
                      key={demoUser}
                      type="button"
                      onClick={() => { setUsername(demoUser); setPassword('Password@123'); }}
                      className={`group px-3 py-2.5 bg-white border rounded-xl text-left transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised)] ${
                        username === demoUser ? 'border-amber-700 ring-2 ring-[var(--brand-ring-soft)] bg-[var(--brand-soft)]' : 'border-stone-200 hover:border-[var(--brand-border)]'
                      }`}
                    >
                      <span className="flex items-center gap-2 font-semibold text-xs text-stone-800">
                        <Icon className="w-3.5 h-3.5 text-amber-700" />
                        {label}
                      </span>
                      <span className="text-[10px] text-stone-500 font-mono block mt-0.5">{demoUser} / Password@123</span>
                    </button>
                  ))}
                </div>
              </div>
              )}

              {/* Switch to Customer Login / Register */}
              <div className="pt-4 border-t border-stone-200/70 text-center">
                <button
                  type="button"
                  onClick={() => navigate('customer-auth')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer transition-colors min-h-[44px] px-3"
                >
                  <span>Are you a guest? <strong className="text-amber-800">Login / Register as Customer →</strong></span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
