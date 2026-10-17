
/**
 * Auth Context & State Provider
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from 'react';
import { SafeUser } from '../types/index.ts';
import { AuthApi } from '../api/index.ts';
import { SESSION_EXPIRED_EVENT } from '../api/client.ts';
import { SectionId, effectivePrivilege, hasAccess, resolveAllAccess } from '../../shared/accessControl.ts';

interface AuthContextType {
  user: SafeUser | null;
  token: string | null;
  isAuthenticated: boolean;

  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
  isKitchen: boolean;
  isDelivery: boolean;

  /** Super Admin privilege (as resolved by the server). */
  isSuperAdmin: boolean;
  /** Section access as enforced by the server: can(section, 'VIEW' | 'FULL'). */
  can: (section: SectionId, need?: 'VIEW' | 'FULL') => boolean;

  isLoading: boolean;

  login: (credentials: any) => Promise<SafeUser>;

  loginCustomerPhone: (payload: {
    idToken: string;
    phone?: string;
    firebaseUid?: string;
  }) => Promise<SafeUser>;

  registerCustomerPhone: (payload: {
    idToken: string;
    fullName: string;
    phone?: string;
    email?: string;
    firebaseUid?: string;
    countryCode?: string;
  }) => Promise<SafeUser>;

  register: (data: any) => Promise<void>;

  logout: () => void | Promise<void>;

  updateProfile: (data: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [rawUser, setUser] = useState<SafeUser | null>(null);
  // The server sends resolved access with the user. If it is missing (e.g. a
  // server that has not been restarted onto this version), fall back to the
  // role defaults so staff are never locked out of the UI; the API still
  // enforces the real permissions on every request.
  const user = useMemo<SafeUser | null>(() => {
    if (!rawUser || rawUser.access) return rawUser;
    return { ...rawUser, access: resolveAllAccess(rawUser), effectivePrivilege: effectivePrivilege(rawUser) };
  }, [rawUser]);

  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('abc_auth_token')
  );

  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * Check current user session when the application starts.
   */
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

  useEffect(() => {
    const onSessionExpired = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  }, []);

  /**
   * Customer phone login using Firebase OTP.
   */
  const loginCustomerPhone = async (payload: {
    idToken: string;
    phone?: string;
    firebaseUid?: string;
  }): Promise<SafeUser> => {
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

  /**
   * Customer registration using Firebase OTP.
   */
  const registerCustomerPhone = async (payload: {
    idToken: string;
    fullName: string;
    phone?: string;
    email?: string;
    firebaseUid?: string;
    countryCode?: string;
  }): Promise<SafeUser> => {
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

  /**
   * Staff/internal user login.
   *
   * Supported roles:
   * ADMIN   - legacy role
   * MANAGER
   * STAFF
   * KITCHEN
   * DELIVERY
   */
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

  /**
   * Generic registration.
   */
  const register = async (data: any): Promise<void> => {
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

  /**
   * Logout current user.
   */
  const logout = async (): Promise<void> => {
    localStorage.removeItem('abc_auth_token');

    setToken(null);
    setUser(null);

    try {
      await AuthApi.logout();
    } catch {
      // Ignore network errors during logout.
    }
  };

  /**
   * Update current user profile.
   */
  const updateProfile = async (data: any): Promise<void> => {
    const updated = await AuthApi.updateProfile(data);
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,

        isAdmin: user?.role === 'ADMIN',
        isManager: user?.role === 'MANAGER',
        isStaff: user?.role === 'STAFF',
        isKitchen: user?.role === 'KITCHEN',
        isDelivery: user?.role === 'DELIVERY',

        isSuperAdmin: user?.effectivePrivilege === 'SUPER_ADMIN',
        can: (section: SectionId, need: 'VIEW' | 'FULL' = 'VIEW') => hasAccess(user?.access?.[section], need),

        isLoading,

        login,
        loginCustomerPhone,
        registerCustomerPhone,
        register,
        logout,
        updateProfile,
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

