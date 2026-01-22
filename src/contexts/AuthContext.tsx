import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tokens from localStorage on mount
  useEffect(() => {
    const storedAccessToken = localStorage.getItem('access_token');
    const storedRefreshToken = localStorage.getItem('refresh_token');
    const storedUser = localStorage.getItem('user');

    if (storedAccessToken && storedRefreshToken && storedUser) {
      setAccessToken(storedAccessToken);
      setRefreshToken(storedRefreshToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post('http://localhost:8000/api/auth/login', {
        username,
        password,
      });

      const { access_token, refresh_token, user: userData } = response.data;

      setAccessToken(access_token);
      setRefreshToken(refresh_token);
      setUser(userData);

      // Store in localStorage
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (err: any) {
      // Check if server is unreachable (no response from server)
      if (!err.response) {
        const errorMsg = 'Server is unreachable. Please make sure the backend is running.';
        setError(errorMsg);
      } else {
        const errorMsg = err.response?.data?.detail || 'Login failed';
        setError(errorMsg);
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post('http://localhost:8000/api/auth/register', {
        username,
        email,
        password,
      });

      const { access_token, refresh_token, user: userData } = response.data;

      setAccessToken(access_token);
      setRefreshToken(refresh_token);
      setUser(userData);

      // Store in localStorage
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (err: any) {
      // Check if server is unreachable (no response from server)
      if (!err.response) {
        const errorMsg = 'Server is unreachable. Please make sure the backend is running.';
        setError(errorMsg);
      } else {
        const errorMsg = err.response?.data?.detail || 'Registration failed';
        setError(errorMsg);
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    setError(null);

    // Clear localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  };

  const refreshAccessToken = async () => {
    if (!refreshToken) return false;

    try {
      const response = await axios.post(
        'http://localhost:8000/api/auth/refresh',
        { refresh_token: refreshToken }
      );

      const { access_token, refresh_token: newRefreshToken, user: userData } = response.data;

      setAccessToken(access_token);
      setRefreshToken(newRefreshToken);
      setUser(userData);

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', newRefreshToken);

      return true;
    } catch (err) {
      logout();
      return false;
    }
  };

  // Setup axios interceptor for auto token refresh
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && refreshToken) {
          const success = await refreshAccessToken();
          if (success) {
            // Retry original request with new token
            return axios(error.config);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [refreshToken]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user && !!accessToken,
    accessToken,
    refreshToken,
    login,
    register,
    logout,
    isLoading,
    error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
