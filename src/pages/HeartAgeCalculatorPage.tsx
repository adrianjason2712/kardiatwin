import React, { useState, useEffect } from 'react';
import API from '../utils/axios';
import { Heart, Activity, Droplets, Zap, TrendingUp, Shield, Calendar, Info, RefreshCw, AlertTriangle } from 'lucide-react';

interface HeartAgeData {
  heart_age: number;
  actual_age: number;
  age_difference: number;
  interpretation: string;
  status: string;
  impacts: {
    smoking: number;
    diabetes: number;
    activity: number;
    bp: number;
    alcohol: number;
  };
}

interface HeartAgeCalculatorPageProps {
  userData: any;
  data: any;
}

export const HeartAgeCalculatorPage: React.FC<HeartAgeCalculatorPageProps> = ({ userData, data }) => {
  const [heartAge, setHeartAge] = useState<HeartAgeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPhase, setLastPhase] = useState<string | null>(null);

  const fetchHeartAge = async () => {
    if (!data || !userData) {
      setError('Please run a simulation first to calculate heart age');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await API.get('/biological_age');
      setHeartAge(response.data);
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Failed to fetch heart age data. Please ensure the simulation has been run.';
      setError(detail);
      console.error('Error fetching heart age:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch if phase changes OR if we have data but no heartAge yet
    if (data && userData && data.phase) {
      if (data.phase !== lastPhase || !heartAge) {
        setLastPhase(data.phase);
        fetchHeartAge();
      }
    }
  }, [data?.phase, userData, heartAge === null]);

  const getStatusGradient = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'excellent':
        return 'from-emerald-400 to-cyan-500';
      case 'good':
        return 'from-blue-400 to-indigo-500';
      case 'fair':
        return 'from-orange-400 to-pink-500';
      case 'poor':
        return 'from-rose-500 to-red-700';
      default:
        return 'from-gray-400 to-gray-600';
    }
  };

  if (!data || !userData || !userData.age) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <div className="text-center p-12 bg-white/40 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl max-w-lg">
          <div className="bg-red-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Heart className="h-12 w-12 text-red-400 animate-pulse" />
          </div>
          <h3 className="text-3xl font-bold text-gray-800 mb-4">Awaiting Vital Data</h3>
          <p className="text-gray-600 mb-8 leading-relaxed">Your Heart Age is a biological deep-dive. Start a <strong>Cardiac Stress Test</strong> to feed real-time vitals into the calculator.</p>
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <Shield className="h-4 w-4" />
            <span>Encrypted Medical Calculation</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow space-y-8 pb-12">
      {/* Header - Glassmorphism */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 to-gray-800 p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-64 h-64 bg-red-500 opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-64 h-64 bg-blue-500 opacity-10 rounded-full blur-3xl"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="bg-red-500/20 text-red-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-red-500/30">Premium Analysis</span>
              <span className="text-gray-400 text-xs">•</span>
              <span className="text-gray-400 text-xs flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                Captured {new Date().toLocaleDateString()}
              </span>
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight mb-2">Biological Heart Age</h2>
          </div>
          <div className="flex bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-pink-500/20 flex items-center justify-center border border-white/10">
              <Activity className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Engine Status</p>
              <p className="text-sm font-semibold text-emerald-400">Live Simulation Active</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 rounded-[2rem] p-8 shadow-lg flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-rose-100 p-4 rounded-2xl mb-4">
            <AlertTriangle className="h-8 w-8 text-rose-500" />
          </div>
          <h3 className="text-xl font-black text-rose-900 mb-2">Calculation Stalled</h3>
          <p className="text-rose-700/70 max-w-md mb-6">{error}</p>
          <button
            onClick={fetchHeartAge}
            className="flex items-center space-x-2 bg-rose-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-rose-600 transition-all shadow-lg shadow-rose-200"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Re-initialize Model</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center bg-white/40 backdrop-blur-xl rounded-3xl border border-white/20 shadow-xl">
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-red-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-red-500 border-t-transparent animate-spin"></div>
            <Heart className="absolute inset-0 m-auto h-8 w-8 text-red-500 animate-pulse" />
          </div>
          <p className="text-gray-800 font-bold text-xl tracking-tight">Recalculating Biological Matrix</p>
          <p className="text-gray-500 text-sm mt-2">Processing vitals from current simulation phase...</p>
        </div>
      ) : heartAge ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-700">

          {/* Main Visualizer - Left 2 Columns */}
          <div className="lg:col-span-2 space-y-8">
            {/* The Big Number Card */}
            <div className="bg-white rounded-[2rem] p-10 shadow-xl border border-gray-100 flex flex-col md:flex-row items-center gap-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-bl-[5rem] -z-0 opacity-50"></div>

              <div className="relative w-64 h-64 flex-shrink-0">
                {/* SVG Ring with Gradient */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#F3F4F6" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="45" fill="none"
                    stroke={`url(#grad-${heartAge.status})`}
                    strokeWidth="8"
                    strokeDasharray={`${(heartAge.heart_age / 100) * 282.7} 282.7`}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id={`grad-${heartAge.status}`} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" className="text-red-500" stopColor="currentColor" />
                      <stop offset="100%" className="text-rose-600" stopColor="currentColor" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-7xl font-black text-gray-900 tracking-tighter">{Math.round(heartAge.heart_age)}</span>
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Years Old</span>
                </div>
                {/* Pulse Glow Effect */}
                <div className="absolute -inset-4 bg-red-500/5 rounded-full animate-ping -z-10"></div>
              </div>

              <div className="flex-grow space-y-6 z-10">
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Assessment Result</h3>
                  <p className={`text-4xl font-black tracking-tight bg-gradient-to-r ${getStatusGradient(heartAge.status)} bg-clip-text text-transparent capitalize`}>
                    {heartAge.status} Health
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Chronological</p>
                    <p className="text-2xl font-black text-gray-800">{heartAge.actual_age}y</p>
                  </div>
                  <div className={`p-4 rounded-2xl border ${heartAge.age_difference > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Delta</p>
                    <p className={`text-2xl font-black ${heartAge.age_difference > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {heartAge.age_difference > 0 ? '+' : ''}{heartAge.age_difference.toFixed(1)}y
                    </p>
                  </div>
                </div>

                <div className="bg-gray-900 rounded-2xl p-5 text-gray-300 text-sm leading-relaxed border border-white/5">
                  <div className="flex items-start space-x-3">
                    <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <p>{heartAge.interpretation}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Impact Breakdown - The "Luxury Grid" */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100">
                <h4 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-3 text-red-500" />
                  Impact Factors
                </h4>
                <div className="space-y-6">
                  {Object.entries(heartAge.impacts).map(([key, val]) => (
                    <div key={key} className="group">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-gray-500 uppercase tracking-wide capitalize">{key.replace('_', ' ')}</span>
                        <span className={`text-sm font-black ${val > 0 ? 'text-red-500' : val < 0 ? 'text-emerald-500' : 'text-gray-400'}`}>
                          {val > 0 ? '+' : ''}{val}y
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${val > 0 ? 'bg-red-400' : val < 0 ? 'bg-emerald-400' : 'bg-gray-300'}`}
                          style={{ width: `${Math.min(Math.abs(val) * 15, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actionable Insights */}
              <div className="bg-gradient-to-br from-[#8F87F1] to-[#C68EFD] rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                <Shield className="absolute -bottom-10 -right-10 h-48 w-48 opacity-10" />
                <h4 className="text-xl font-bold mb-6 flex items-center">
                  <Zap className="h-6 w-6 mr-3 text-yellow-300" />
                  Health Optimization
                </h4>
                <div className="space-y-4 relative z-10">
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 transition-all hover:bg-white/20">
                    <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-1">Top Priority</p>
                    <p className="font-semibold">{heartAge.age_difference > 3 ? "Immediate Cardiovascular Intervention" : "Maintain Current Exercise Load"}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 transition-all hover:bg-white/20">
                    <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-1">Protocol Tip</p>
                    <p className="font-semibold">Increase anaerobic threshold to drop Heart Age by ~2.4 years.</p>
                  </div>
                </div>
                <button className="mt-8 w-full bg-white text-[#8F87F1] font-bold py-3 rounded-xl shadow-lg hover:scale-105 transition-all">
                  Generate Full Bio-Report
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar Info - Right Column */}
          <div className="space-y-8">
            {/* Calculation Insights */}
            <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100 h-full">
              <h4 className="text-lg font-black text-gray-800 mb-6 border-b pb-4">Engine Metrics</h4>
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <Droplets className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Metabolic Sync</p>
                    <p className="text-sm font-semibold text-gray-800">High Resolution</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">ST-Vector Analysis</p>
                    <p className="text-sm font-semibold text-gray-800">Compensated</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Privacy Protocol</p>
                    <p className="text-sm font-semibold text-gray-800">HIPAA Standard</p>
                  </div>
                </div>
              </div>

              <div className="mt-12 p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                <p className="text-xs text-gray-500 leading-relaxed italic">
                  * Clinical Note: Heart Age is a predictive biomarker calculated relative to standard mortality tables. It is not an active diagnosis.
                </p>
              </div>

              <button
                onClick={fetchHeartAge}
                className="mt-8 w-full flex items-center justify-center space-x-2 py-4 border-2 border-gray-100 rounded-2xl font-bold text-gray-600 hover:bg-gray-50 transition-all"
              >
                <TrendingUp className="h-4 w-4" />
                <span>Sync Latest Vitals</span>
              </button>
            </div>
          </div>
        </div>
      ) : !loading && !error && (
        <div className="bg-white/40 backdrop-blur-xl rounded-[3rem] p-20 border border-white/20 shadow-2xl text-center">
          <div className="bg-gray-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
            <Heart size={48} className="text-gray-300" />
          </div>
          <h3 className="text-3xl font-black text-gray-800 mb-4 tracking-tight">System Idle</h3>
          <p className="text-gray-500 text-lg mb-10 max-w-md mx-auto leading-relaxed">The biological engine is ready. Please ensure your simulation is actively transmitting data.</p>
          <button
            onClick={fetchHeartAge}
            className="bg-gray-900 text-white px-12 py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:scale-105 transition-all"
          >
            Manual Override Sync
          </button>
        </div>
      )}
    </div>
  );
};
