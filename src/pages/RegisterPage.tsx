import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Heart, AlertCircle } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const navigate = useNavigate();
  const { register, isLoading, error } = useAuth();

  const validateForm = (): boolean => {
    setLocalError('');

    if (!username || !email || !password || !confirmPassword) {
      setLocalError('Please fill in all fields');
      return false;
    }

    if (username.length < 3) {
      setLocalError('Username must be at least 3 characters long');
      return false;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters long');
      return false;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setLocalError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await register(username, email, password);
      navigate('/login');
    } catch (err: any) {
      // Check if server is unreachable
      if (!err.response) {
        setLocalError('Server is unreachable. Please make sure the backend is running.');
      } else {
        setLocalError(err.response?.data?.detail || 'Registration failed. Please try again.');
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

        <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Create Account</h2>
        <p className="text-gray-600 text-center mb-6">Join us to track your cardiac health</p>

        {/* Error Message */}
        {(localError || error) && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm flex items-start gap-2">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <div>{localError || error}</div>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username (3+ characters)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8F87F1] focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
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
              placeholder="Create a password (8+ characters)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8F87F1] focus:border-transparent"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
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
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Already have an account?</span>
          </div>
        </div>

        {/* Login Link */}
        <Link
          to="/login"
          className="w-full block text-center py-2 px-4 rounded-lg border-2 border-[#8F87F1] text-[#8F87F1] font-medium hover:bg-[#8F87F1] hover:text-white transition duration-200"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
};
