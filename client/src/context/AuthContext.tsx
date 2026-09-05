import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (identifier: string, pass: string) => Promise<{ requires2FA?: boolean; challengeToken?: string }>;
  verify2FA: (challengeToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (identifier: string, pass: string) => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ identifier, password: pass }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to login');
    }

    if (data.requires2FA) {
      return { requires2FA: true, challengeToken: data.challengeToken };
    }

    setUser(data.user);
    return { requires2FA: false };
  };

  const verify2FA = async (challengeToken: string, code: string) => {
    const res = await fetch('/api/v1/auth/login/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ challengeToken, code }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Invalid 2FA code');
    }

    setUser(data.user);
  };

  const logout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      setUser(null);
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, verify2FA, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
