import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Heart } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!username || !password) {
      setLocalError('Please fill in all fields');
      return;
    }

    try {
      await login(username, password);
      navigate('/simulation');
    } catch (err: any) {
      // Check if server is unreachable
      if (!err.response) {
        setLocalError('Server is unreachable. Please make sure the backend is running.');
      } else {
        setLocalError(err.response?.data?.detail || 'Login failed. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#8F87F1] to-[#C68EFD] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <Heart className="text-[#8F87F1] mr-3" size={32} />
          <h1 className="text-3xl font-bold text-[#8F87F1]">KardiaTwin</h1>
        </div>

        <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Welcome Back</h2>
        <p className="text-gray-600 text-center mb-6">Sign in to your account</p>

        {/* Error Message */}
        {localError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {localError}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username or Email
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username or email"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8F87F1] focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8F87F1] focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2 px-4 rounded-lg font-medium transition duration-200 ${
              isLoading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#8F87F1] to-[#C68EFD] text-white hover:opacity-90'
            }`}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Don't have an account?</span>
          </div>
        </div>

        {/* Register Link */}
        <Link
          to="/register"
          className="w-full block text-center py-2 px-4 rounded-lg border-2 border-[#8F87F1] text-[#8F87F1] font-medium hover:bg-[#8F87F1] hover:text-white transition duration-200"
        >
          Create Account
        </Link>

        {/* Guest Mode */}
        <p className="text-center text-gray-600 text-sm mt-6">
          Or{' '}
          <Link
            to="/simulation"
            className="text-[#8F87F1] hover:underline font-medium"
          >
            continue as guest
          </Link>
        </p>
      </div>
    </div>
  );
};
