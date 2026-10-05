/**
 * Customer Profile Management Page
 * Clean, Responsive, Production-Grade UI
 */
import React, { useState, useEffect } from 'react';
import { User, Shield, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { Spinner } from '../components/common/Footer.tsx';

export const ProfilePage: React.FC<{ navigate: (route: string) => void }> = ({ navigate }) => {
  const { user, updateProfile, isAuthenticated, isLoading } = useAuth();
  const { error, success } = useToast();

  // Profile fields
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setPhone(user.phone || '');
      setEmail(user.email || '');
    }
  }, [user]);

  if (isLoading) {
    return <Spinner text="Loading profile..." />;
  }

  if (!isAuthenticated || !user) {
    navigate('login');
    return null;
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    try {
      await updateProfile({ firstName, lastName, phone, email });
      success('Profile details updated successfully.');
    } catch (err: any) {
      error(err.message || 'Failed to update profile.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="border-b border-stone-200 pb-4">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-800">
          Customer Account Settings
        </span>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
          Profile Management
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Clean Account Overview Card */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs text-center space-y-3">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-700 to-amber-500 text-white flex items-center justify-center text-2xl font-bold font-serif mx-auto shadow-md">
              {(user.firstName && user.firstName.length > 0 ? user.firstName[0] : 'U').toUpperCase()}
            </div>

            <div>
              <h3 className="font-serif font-bold text-lg text-stone-900">
                {user.firstName} {user.lastName}
              </h3>
              <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold px-3 py-0.5 rounded-full bg-amber-100 text-amber-800">
                <Shield className="w-3 h-3 text-amber-700" />
                <span>Customer Profile</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Edit Profile Form */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-xs space-y-4">
            <h3 className="font-serif font-bold text-base text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-amber-700" /> Personal Details
            </h3>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">First Name</label>
                  <input
                    type="text"
                    placeholder="Enter First Name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-base sm:text-xs text-stone-900 focus:border-amber-600 focus:bg-white transition-all outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-700">Last Name</label>
                  <input
                    type="text"
                    placeholder="Enter Last Name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-base sm:text-xs text-stone-900 focus:border-amber-600 focus:bg-white transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="Enter Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:border-amber-600 focus:bg-white transition-all outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Phone Number</label>
                <input
                  type="tel"
                  placeholder="Enter Phone Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 font-mono focus:border-amber-600 focus:bg-white transition-all outline-none"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={updatingProfile}
                  className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{updatingProfile ? 'Saving...' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
