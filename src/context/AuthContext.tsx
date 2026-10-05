/**
 * Auth Context & State Provider
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { SafeUser } from '../types/index.ts';
import { AuthApi } from '../api/index.ts';

interface AuthContextType {
  user: SafeUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isKitchen: boolean;
  isManager: boolean;
  isDelivery: boolean;
  isLoading: boolean;
  login: (credentials: any) => Promise<SafeUser>;
  loginCustomerPhone: (payload: { idToken: string; phone?: string; firebaseUid?: string }) => Promise<SafeUser>;
  registerCustomerPhone: (payload: { idToken: string; fullName: string; phone?: string; email?: string; firebaseUid?: string; countryCode?: string }) => Promise<SafeUser>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  updateProfile: (data: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('abc_auth_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check current user session on mount or bootstrap default admin user
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      const storedToken = localStorage.getItem('abc_auth_token');

      if (storedToken) {
        try {
          const currentUser = await AuthApi.me();
          if (isMounted && currentUser) {
            setUser(currentUser);
            setToken(storedToken);
            setIsLoading(false);
            return;
          }
        } catch {
          localStorage.removeItem('abc_auth_token');
        }
      }

      // If no valid stored token, remain as unauthenticated guest
      if (isMounted) {
        setUser(null);
        setToken(null);
        setIsLoading(false);
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const loginCustomerPhone = async (payload: { idToken: string; phone?: string; firebaseUid?: string }): Promise<SafeUser> => {
    setIsLoading(true);
    try {
      const res = await AuthApi.loginCustomerPhone(payload);
      localStorage.setItem('abc_auth_token', res.token);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const registerCustomerPhone = async (payload: { idToken: string; fullName: string; phone?: string; email?: string; firebaseUid?: string; countryCode?: string }): Promise<SafeUser> => {
    setIsLoading(true);
    try {
      const res = await AuthApi.registerCustomerPhone(payload);
      localStorage.setItem('abc_auth_token', res.token);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: any): Promise<SafeUser> => {
    setIsLoading(true);
    try {
      const res = await AuthApi.login(credentials);
      localStorage.setItem('abc_auth_token', res.token);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: any) => {
    setIsLoading(true);
    try {
      const res = await AuthApi.register(data);
      localStorage.setItem('abc_auth_token', res.token);
      setToken(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    localStorage.removeItem('abc_auth_token');
    setToken(null);
    setUser(null);
    try {
      await AuthApi.logout();
    } catch {
      // ignore network errors on logout
    }
  };

  const updateProfile = async (data: any) => {
    const updated = await AuthApi.updateProfile(data);
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'ADMIN' || user?.role === 'STAFF',
        isKitchen: user?.role === 'KITCHEN',
        isManager: user?.role === 'MANAGER',
        isDelivery: user?.role === 'DELIVERY',
        isLoading,
        login,
        loginCustomerPhone,
        registerCustomerPhone,
        register,
        logout,
        updateProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
