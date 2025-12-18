import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, Activity, Droplets, Zap, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';

interface HeartAgeData {
  heart_age: number;
  actual_age: number;
  age_difference: number;
  interpretation: string;
  status: string;
  recommendations: string[];
}

interface HeartAgeCalculatorPageProps {
  userData: any;
  data: any;
}

export const HeartAgeCalculatorPage: React.FC<HeartAgeCalculatorPageProps> = ({ userData, data }) => {
  const [heartAge, setHeartAge] = useState<HeartAgeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHeartAge = async () => {
    if (!data || !userData) {
      setError('Please run a simulation first to calculate heart age');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get('http://localhost:5000/biological_age');
      setHeartAge(response.data);
    } catch (err) {
      setError('Failed to fetch heart age data. Please ensure the simulation has been run.');
      console.error('Error fetching heart age:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (data && userData) {
      fetchHeartAge();
    }
  }, [data, userData]);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'excellent':
        return 'bg-green-50 border-green-200';
      case 'good':
        return 'bg-blue-50 border-blue-200';
      case 'fair':
        return 'bg-yellow-50 border-yellow-200';
      case 'poor':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusTextColor = (status: string): string => {
    switch (status) {
      case 'excellent':
        return 'text-green-700';
      case 'good':
        return 'text-blue-700';
      case 'fair':
        return 'text-yellow-700';
      case 'poor':
        return 'text-red-700';
      default:
        return 'text-gray-700';
    }
  };

  if (!data || !userData || !userData.age) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200 max-w-md">
          <Heart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-2xl font-semibold text-gray-800 mb-2">No Simulation Data</h3>
          <p className="text-gray-600 mb-6">Please run a simulation on the <strong>Simulation</strong> tab first to calculate your biological heart age.</p>
          <p className="text-sm text-gray-500">Once you complete a simulation, your heart age analysis will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-6 border border-red-200">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Heart Age Calculator</h2>
            <p className="text-gray-600">Your biological heart age based on current simulation results and lifestyle factors</p>
          </div>
          <Heart className="h-12 w-12 text-red-500 flex-shrink-0" />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-xl shadow-lg p-8 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin mb-4">
              <Heart className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-gray-600">Calculating heart age...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-800">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Heart Age Display */}
      {heartAge && !loading && (
        <>
          {/* Main Heart Age Card */}
          <div className={`bg-white rounded-xl shadow-lg p-8 border-l-4 ${getStatusColor(heartAge.status)}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left side - Heart Age */}
              <div className="flex flex-col justify-center items-center">
                <div className="relative w-40 h-40 mb-4">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="3"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="3"
                      strokeDasharray={`${(heartAge.heart_age / 120) * 282.7} 282.7`}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl font-bold text-red-600">{Math.round(heartAge.heart_age)}</span>
                    <span className="text-sm text-gray-600">years</span>
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 text-center">Biological Heart Age</h3>
                <p className={`text-lg font-bold mt-2 ${getStatusTextColor(heartAge.status)}`}>
                  {heartAge.status.toUpperCase()}
                </p>
              </div>

              {/* Right side - Actual Age & Status */}
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Actual Age</p>
                  <p className="text-3xl font-bold text-gray-800">{Math.round(heartAge.actual_age)}</p>
                </div>

                <div className="bg-purple-50 rounded-lg p-4 border border-purple-300">
                  <p className="text-sm text-gray-600 mb-1">Age Difference</p>
                  <div className="flex items-baseline space-x-2">
                    <span className={`text-3xl font-bold ${heartAge.age_difference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {heartAge.age_difference > 0 ? '+' : ''}{heartAge.age_difference.toFixed(1)}
                    </span>
                    <span className="text-sm text-gray-600">years</span>
                  </div>
                </div>

                <div className={`rounded-lg p-4 ${getStatusColor(heartAge.status)} border`}>
                  <p className="text-sm text-gray-600 mb-2">Heart Health Status</p>
                  <div className="flex items-center space-x-2">
                    <span className={`text-lg font-bold ${getStatusTextColor(heartAge.status)}`}>
                      {heartAge.status.charAt(0).toUpperCase() + heartAge.status.slice(1)}
                    </span>
                    {heartAge.status === 'excellent' && (
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    )}
                    {heartAge.status === 'good' && (
                      <CheckCircle2 className="h-6 w-6 text-blue-600" />
                    )}
                    {(heartAge.status === 'fair' || heartAge.status === 'poor') && (
                      <AlertCircle className="h-6 w-6 text-yellow-600" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interpretation */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center space-x-2">
              <TrendingUp className="h-6 w-6 text-blue-600" />
              <span>Health Assessment</span>
            </h3>

            <div className={`rounded-lg p-6 ${getStatusColor(heartAge.status)} border`}>
              <p className="text-lg text-gray-800 leading-relaxed">{heartAge.interpretation}</p>
            </div>
          </div>

          {/* Recommendations */}
          {heartAge.recommendations && heartAge.recommendations.filter(rec => rec !== null).length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center space-x-2">
                <Activity className="h-6 w-6 text-green-600" />
                <span>Health Recommendations</span>
              </h3>

              <div className="space-y-3">
                {heartAge.recommendations
                  .filter(rec => rec !== null)
                  .map((rec, idx) => (
                    <div
                      key={idx}
                      className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg border border-green-200"
                    >
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <p className="text-gray-700">{rec}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">How Heart Age is Calculated</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Blood Pressure:</strong> Systolic and diastolic readings during simulation</li>
              <li>• <strong>Heart Rate:</strong> Baseline and peak rates achieved during exercise</li>
              <li>• <strong>ST Depression:</strong> Electrical changes in your heart during stress</li>
              <li>• <strong>Smoking Status:</strong> Current or historical smoking behavior</li>
              <li>• <strong>Diabetes Status:</strong> Presence of Type 1 or Type 2 diabetes</li>
              <li>• <strong>Activity Level:</strong> Regular physical activity patterns</li>
            </ul>
          </div>

          {/* Refresh Button */}
          <div className="flex justify-center">
            <button
              onClick={fetchHeartAge}
              disabled={loading}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              Recalculate Heart Age
            </button>
          </div>
        </>
      )}
    </div>
  );
};
