import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
  id: number;
  username: string;
  email: string;
  profile_name?: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
  rememberMe: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  // Load tokens from localStorage on mount
  useEffect(() => {
    const storedAccessToken = localStorage.getItem('access_token');
    const storedRefreshToken = localStorage.getItem('refresh_token');
    const storedUser = localStorage.getItem('user');
    const storedRememberMe = localStorage.getItem('rememberMe') === 'true';
    const tokenVersion = localStorage.getItem('tokenVersion');

    // Check if tokens need to be cleared (version mismatch indicates SECRET_KEY change)
    const CURRENT_TOKEN_VERSION = '2'; // Increment this when SECRET_KEY changes

    if (tokenVersion !== CURRENT_TOKEN_VERSION) {
      console.warn('⚠️ Token version mismatch - clearing old tokens');
      localStorage.clear();
      localStorage.setItem('tokenVersion', CURRENT_TOKEN_VERSION);
      return;
    }

    if (storedAccessToken && storedRefreshToken && storedUser) {
      try {
        setAccessToken(storedAccessToken);
        setRefreshToken(storedRefreshToken);
        setUser(JSON.parse(storedUser));
        setRememberMe(storedRememberMe);
      } catch (err) {
        console.error('Error parsing stored user:', err);
        localStorage.clear();
      }
    }

    localStorage.setItem('tokenVersion', CURRENT_TOKEN_VERSION);
  }, []);

  const login = async (username: string, password: string, rememberMeFlag: boolean = false) => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate inputs
      if (!username || !password) {
        throw new Error('Username/email and password are required');
      }

      const response = await axios.post('http://localhost:8000/api/auth/login', {
        username,
        password,
      });

      const { access_token, refresh_token, user: userData } = response.data;

      setAccessToken(access_token);
      setRefreshToken(refresh_token);
      setUser(userData);
      setRememberMe(rememberMeFlag);

      // Store in localStorage
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('rememberMe', rememberMeFlag.toString());
      localStorage.setItem('tokenVersion', '2');
    } catch (err: any) {
      let errorMsg = 'Login failed';

      // Check if server is unreachable (no response from server)
      if (!err.response) {
        errorMsg = 'Server is unreachable. Please make sure the backend is running.';
      } else if (err.response?.status === 401) {
        // Invalid credentials
        errorMsg = 'Invalid username/email or password. Please check your credentials.';
      } else if (err.response?.status === 422) {
        // Validation error
        errorMsg = 'Invalid input. Please check your username and password.';
      } else if (err.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      } else if (err.message) {
        errorMsg = err.message;
      }

      setError(errorMsg);
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
      localStorage.setItem('rememberMe', 'false');
      localStorage.setItem('tokenVersion', '2');
    } catch (err: any) {
      let errorMsg = 'Registration failed';

      // Check if server is unreachable (no response from server)
      if (!err.response) {
        errorMsg = 'Server is unreachable. Please make sure the backend is running.';
      } else if (err.response?.status === 409) {
        // Conflict - user already exists
        errorMsg = 'Username or email already registered. Please use different credentials.';
      } else if (err.response?.status === 422) {
        // Validation error
        errorMsg = 'Invalid input. Please check all fields meet requirements.';
      } else if (err.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      } else if (err.message) {
        errorMsg = err.message;
      }

      setError(errorMsg);
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
    setRememberMe(false);

    // Clear localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberMe');
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
      localStorage.setItem('tokenVersion', '2');

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
        const originalRequest = error.config;

        // Prevent infinite loop - only retry once
        if (error.response?.status === 401 && refreshToken && !originalRequest._retry) {
          originalRequest._retry = true;
          const success = await refreshAccessToken();
          if (success) {
            // Retry original request with new token
            return axios(originalRequest);
          } else {
            // Token refresh failed, logout user
            logout();
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
    rememberMe,
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
