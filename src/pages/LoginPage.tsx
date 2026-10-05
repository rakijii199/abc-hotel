/**
 * Authentication Pages: Login and Register
 * Automatic Role-Based Routing for Customer vs. Admin
 */
import React, { useState } from 'react';
import { Mail, Lock, User, Phone, ArrowRight, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';

export const LoginPage: React.FC<{ navigate: (route: string) => void }> = ({ navigate }) => {
  const { login } = useAuth();
  const { error, success } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const trimmed = email.trim();
      const isEmail = trimmed.includes('@');
      const loggedInUser = await login({
        email: isEmail ? trimmed : undefined,
        username: !isEmail ? trimmed : undefined,
        password
      });
      const roleNames: Record<string, string> = {
        MANAGER: 'Manager',
        STAFF: 'Staff',
        ADMIN: 'Staff',
        KITCHEN: 'Kitchen',
        DELIVERY: 'Delivery',
        CUSTOMER: 'Customer'
      };
      const displayRole = roleNames[loggedInUser?.role || ''] || loggedInUser?.role;
      success(`Welcome ${loggedInUser?.firstName || 'back'}! Logged in as ${displayRole}.`);
      if (loggedInUser?.role === 'ADMIN' || loggedInUser?.role === 'MANAGER' || loggedInUser?.role === 'STAFF') {
        navigate('admin');
      } else if (loggedInUser?.role === 'KITCHEN') {
        navigate('kitchen');
      } else if (loggedInUser?.role === 'DELIVERY') {
        navigate('delivery');
      } else {
        navigate('home');
      }
    } catch (err: any) {
      error(err.message || 'Invalid username/email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] flex items-center justify-center px-4 py-12">
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl border border-stone-200/80 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Left Side: Brand Experience */}
        <div className="bg-stone-900 text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <img
              src="https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80"
              alt="Dining Ambiance"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="relative z-10 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-600 flex items-center justify-center font-serif font-bold text-xl text-white shadow-md">
              ABC
            </div>
            <h2 className="font-serif font-bold text-2xl text-white">ABC HOTEL</h2>
            <p className="text-xs text-stone-300 tracking-widest uppercase font-semibold">
              Privilege Dining & Operations Portal
            </p>
          </div>

          <div className="relative z-10 space-y-4 py-8">
            <p className="text-sm text-stone-300 leading-relaxed font-light">
              "Indulge in an elevated culinary voyage where every reservation is guaranteed and every dish tells a story."
            </p>
            <span className="text-xs text-amber-400 font-serif italic block">
              — Executive Chef & General Manager
            </span>
          </div>

          <div className="relative z-10 p-4 rounded-2xl bg-white/10 border border-white/15 text-xs text-amber-300 space-y-1">
            <span className="font-bold flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-amber-400" /> Secure Authentication Portal
            </span>
            <p className="text-[11px] text-stone-300 leading-relaxed">
              Log in with your registered credentials to access your personalized dining, order management, or administrative dashboard.
            </p>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="p-8 sm:p-12 flex flex-col justify-center space-y-6">
          <div className="space-y-1">
            <h3 className="font-serif font-bold text-2xl text-stone-900">Login to Your Account</h3>
            <p className="text-xs text-stone-500">
              Access your reservations, food order history, and privilege management suite.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Email Address or Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter Email Address or Username"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-amber-600 focus:bg-white transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Password"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-amber-600"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? 'Authenticating...' : 'Login'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="text-center text-xs text-stone-500 pt-2 border-t border-stone-100">
            Don't have an account yet?{' '}
            <button
              onClick={() => navigate('register')}
              className="font-bold text-amber-800 hover:underline cursor-pointer"
            >
              Register
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const RegisterPage: React.FC<{ navigate: (route: string) => void }> = ({ navigate }) => {
  const { register } = useAuth();
  const { error, success } = useToast();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      error('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        firstName,
        lastName,
        email,
        phone,
        password,
        confirmPassword
      });
      success('Account created successfully! Welcome to ABC Hotel.');
      navigate('dashboard');
    } catch (err: any) {
      error(err.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] flex items-center justify-center px-4 py-12">
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl border border-stone-200/80 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Left Side: Brand Promo */}
        <div className="bg-stone-900 text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <img
              src="https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800&auto=format&fit=crop&q=80"
              alt="Dining Room"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="relative z-10 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-600 flex items-center justify-center font-serif font-bold text-xl text-white shadow-md">
              ABC
            </div>
            <h2 className="font-serif font-bold text-2xl text-white">ABC HOTEL</h2>
            <p className="text-xs text-stone-300 tracking-widest uppercase font-semibold">
              Member Registration
            </p>
          </div>

          <div className="relative z-10 space-y-4 py-8">
            <p className="text-sm text-stone-300 leading-relaxed font-light">
              Join the ABC Hotel Dining Circle to unlock instant table reservations, order tracking, and exclusive seasonal invitations.
            </p>
          </div>

          <div className="relative z-10 p-4 rounded-2xl bg-white/10 border border-white/15 text-xs text-amber-300 space-y-1">
            <span className="font-bold flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> Data Protection Guarantee
            </span>
            <p className="text-[11px] text-stone-300">
              Passwords securely hashed with bcrypt. No plain-text storage.
            </p>
          </div>
        </div>

        {/* Right Side: Register Form */}
        <div className="p-8 sm:p-12 flex flex-col justify-center space-y-6">
          <div className="space-y-1">
            <h3 className="font-serif font-bold text-2xl text-stone-900">Create Guest Account</h3>
            <p className="text-xs text-stone-500">Register to enjoy priority dining and food ordering.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-amber-600"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-amber-600"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-amber-600"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-700">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-900 focus:border-amber-600"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars, 1 uppercase, 1 digit"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-amber-600"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-amber-600"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? 'Creating Account...' : 'Complete Registration'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="text-center text-xs text-stone-500 pt-2 border-t border-stone-100">
            Already registered?{' '}
            <button
              onClick={() => navigate('login')}
              className="font-bold text-amber-800 hover:underline cursor-pointer"
            >
              Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
