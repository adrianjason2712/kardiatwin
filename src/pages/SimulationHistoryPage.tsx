import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import API from '../utils/axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  Trash2,
  Calendar,
  Activity,
  RotateCcw,
  Plus,
  ChevronRight,
  Heart,
  History,
  ShieldCheck,
  Clock,
  Zap,
  XCircle
} from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface SimulationSession {
  id: number;
  created_at: string;
  protocol: string;
  duration?: number | null;
  risk_score?: number | null;
  heart_age?: number | null;
}

interface HistoryResponse {
  sessions: SimulationSession[];
  total: number;
  limit: number;
  offset: number;
}

export const SimulationHistoryPage: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [simulations, setSimulations] = useState<SimulationSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [creatingTest, setCreatingTest] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [selectedSim, setSelectedSim] = useState<SimulationSession | null>(null);
  const [simDataPoints, setSimDataPoints] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  useEffect(() => {
    fetchSimulations();
  }, [refreshKey]);

  useEffect(() => {
    if (selectedSim) {
      fetchSimDataPoints(selectedSim.id);
    } else {
      setSimDataPoints([]);
    }
  }, [selectedSim]);

  const fetchSimDataPoints = async (id: number) => {
    setIsLoadingData(true);
    try {
      const response = await API.get(`/api/simulations/${id}/data`);
      setSimDataPoints(response.data.data_points || []);
    } catch (err) {
      console.error('Failed to fetch data points', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const createTestSimulation = async () => {
    setCreatingTest(true);
    setError(null);
    try {
      await API.post('/api/test-simulation', {});
      setRefreshKey(prev => prev + 1);
    } catch (err: any) {
      console.error('Failed to create test simulation:', err);
      setError(err.response?.data?.detail || 'Failed to create test simulation');
    } finally {
      setCreatingTest(false);
    }
  };

  const fetchSimulations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await API.get<HistoryResponse>('/api/simulations?limit=20&offset=0');
      setSimulations(response.data.sessions);
    } catch (err: any) {
      if (err.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }
      setError(err.response?.data?.detail || 'Failed to load simulation history');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSimulation = async (id: number) => {
    if (!confirm('Are you sure you want to delete this historical record?')) {
      return;
    }

    setDeletingId(id);
    try {
      await API.delete(`/api/simulations/${id}`);
      setSimulations(simulations.filter((s) => s.id !== id));
    } catch (err: any) {
      if (err.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }
      setError(err.response?.data?.detail || 'Failed to delete simulation');
    } finally {
      setDeletingId(null);
    }
  };

  const deleteAllSimulations = async () => {
    if (!confirm('WARNING: This will permanently purge your entire simulation vault. This action cannot be undone. Are you sure?')) {
      return;
    }

    setIsClearingAll(true);
    setError(null);
    try {
      await API.delete('/api/simulations');
      setSimulations([]);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to clear history');
    } finally {
      setIsClearingAll(false);
    }
  };

  const formatDate = (dateString: string) => {
    // Ensure the UTC timezone 'Z' is appended so the browser correctly converts to local time
    const safeDateString = dateString.endsWith('Z') || dateString.includes('+') ? dateString : `${dateString}Z`;
    const date = new Date(safeDateString);
    return {
      full: date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      relative: 'Simulation Data'
    };
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1a1c2c] to-[#4a1942] p-10 text-white shadow-2xl border border-white/5">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-[#8F87F1] opacity-10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-[#C68EFD] opacity-10 rounded-full blur-[100px]"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10">
                <History className="h-6 w-6 text-[#8F87F1]" />
              </div>
              <span className="text-white/40 text-sm font-bold uppercase tracking-widest tracking-widest">Medical Record Archival</span>
            </div>
            <h1 className="text-5xl font-black tracking-tight mb-3">Simulation History</h1>
            <p className="text-white/50 max-w-xl text-lg leading-relaxed">View your chronological cardiac assessments. Each record contains high-fidelity physiological snapshots and predictive biomarkers.</p>
          </div>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={createTestSimulation}
              disabled={creatingTest}
              className="flex items-center space-x-2 px-6 py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
            >
              <div className={`p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform ${creatingTest ? 'animate-pulse' : ''}`}>
                <Plus size={18} />
              </div>
              <span className="font-bold text-sm tracking-wide">{creatingTest ? 'Analyzing...' : 'New Test Session'}</span>
            </button>

            <button
              onClick={deleteAllSimulations}
              disabled={isClearingAll || simulations.length === 0}
              className="flex items-center space-x-2 px-6 py-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl hover:bg-rose-500 hover:text-white transition-all disabled:opacity-30 disabled:hover:bg-rose-500/10 disabled:hover:text-rose-500"
            >
              <Trash2 size={18} className={isClearingAll ? 'animate-bounce' : ''} />
              <span className="font-bold text-sm tracking-wide">{isClearingAll ? 'Purging...' : 'Clear Vault'}</span>
            </button>

            <button
              onClick={() => setRefreshKey(prev => prev + 1)}
              disabled={isLoading}
              className="flex items-center space-x-2 px-6 py-4 bg-[#8F87F1] text-white rounded-2xl shadow-xl shadow-[#8F87F1]/20 hover:scale-105 active:scale-95 transition-all"
            >
              <RotateCcw size={18} className={isLoading ? 'animate-spin' : ''} />
              <span className="font-bold text-sm tracking-wide">Sync Vault</span>
            </button>
          </div>
        </div>

        {/* Mini Stats Bar */}
        {!isLoading && simulations.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 pt-8 border-t border-white/5">
            <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/5">
              <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-1">Total Assessed</p>
              <p className="text-2xl font-black">{simulations.length}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/5">
              <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-1">Latest Risk</p>
              <p className="text-2xl font-black text-emerald-400">
                {simulations[0]?.risk_score ? `${simulations[0].risk_score.toFixed(0)}%` : 'N/A'}
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/5">
              <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-1">Avg. Heart Age</p>
              <p className="text-2xl font-black text-indigo-400">
                {simulations.filter(s => s.heart_age).length > 0
                  ? (simulations.reduce((acc, s) => acc + (s.heart_age || 0), 0) / simulations.filter(s => s.heart_age).length).toFixed(0)
                  : 'N/A'
                }
              </p>
            </div>
            <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/5">
              <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-1">Security Status</p>
              <div className="flex items-center space-x-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <span className="font-bold text-sm">HIPAA Compliant</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto">
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-6 py-4 rounded-2xl mb-8 flex items-center space-x-3 shadow-sm">
            <Zap className="h-5 w-5 animate-pulse" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-[#8F87F1]/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-[#8F87F1] border-t-transparent animate-spin"></div>
            </div>
            <p className="text-gray-400 font-bold tracking-widest uppercase text-xs">Retrieving Health Vault</p>
          </div>
        ) : simulations.length === 0 ? (
          <div className="bg-white/40 backdrop-blur-2xl rounded-[3rem] p-20 border border-white border-opacity-40 shadow-2xl text-center max-w-4xl mx-auto">
            <div className="bg-gray-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
              <Activity size={48} className="text-gray-300" />
            </div>
            <h3 className="text-3xl font-black text-gray-800 mb-4 tracking-tight">Your medical history is clear</h3>
            <p className="text-gray-500 text-lg mb-10 max-w-md mx-auto leading-relaxed">No diagnostic simulations have been recorded yet. Launch your first stress test to begin tracking your cardiac health journey.</p>
            <button className="bg-gradient-to-r from-[#8F87F1] to-[#C68EFD] text-white px-10 py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all">
              Initialize First Session
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {simulations.map((sim) => {
              const dateInfo = formatDate(sim.created_at);
              return (
                <div
                  key={sim.id}
                  className="group relative bg-white rounded-[2rem] p-6 shadow-md hover:shadow-2xl transition-all duration-500 border border-gray-100 hover:border-[#8F87F1]/20 overflow-hidden flex flex-col md:flex-row items-center gap-8"
                >
                  {/* Subtle Background Icon */}
                  <Activity className="absolute -bottom-10 -right-10 h-40 w-40 text-gray-50 opacity-50 group-hover:scale-110 transition-transform duration-700" />

                  {/* Date/Time Indicator */}
                  <div className="flex-shrink-0 w-full md:w-56 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start space-x-2 text-gray-400 mb-1">
                      <Calendar size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{dateInfo.time}</span>
                    </div>
                    <p className="text-lg font-black text-gray-800 tracking-tight leading-tight">{dateInfo.full}</p>
                    <div className="mt-3 flex items-center justify-center md:justify-start space-x-2">
                      <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-[10px] font-black uppercase tracking-widest">
                        #{sim.id.toString().padStart(4, '0')}
                      </span>
                    </div>
                  </div>

                  {/* Vitals Summary */}
                  <div className="flex-grow grid grid-cols-2 lg:grid-cols-4 gap-8 relative z-10 w-full">
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Protocol Engine</p>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="font-black text-gray-800 text-sm capitalize">{sim.protocol.replace('_', ' ')}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Session Tempo</p>
                      <div className="flex items-center space-x-2 text-gray-800">
                        <Clock size={16} className="text-indigo-400" />
                        <span className="font-black text-sm">{sim.duration ? `${Math.floor(sim.duration / 60)}m ${sim.duration % 60}s` : '00m 00s'}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Predictive Risk</p>
                      <div className="flex items-center space-x-3">
                        <div className="flex-grow max-w-[80px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${sim.risk_score && sim.risk_score > 70 ? 'bg-rose-500' : sim.risk_score && sim.risk_score > 30 ? 'bg-orange-400' : 'bg-emerald-400'}`}
                            style={{ width: `${sim.risk_score || 0}%` }}
                          ></div>
                        </div>
                        <span className="font-black text-sm">{sim.risk_score ? `${sim.risk_score.toFixed(0)}%` : '--'}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Biological Core</p>
                      <div className="flex items-center space-x-2 text-rose-500">
                        <Heart size={16} fill="currentColor" className="opacity-20" />
                        <span className="font-black text-sm">{sim.heart_age ? `${Math.round(sim.heart_age)}y` : '--'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="flex-shrink-0 flex space-x-3 w-full md:w-auto mt-4 md:mt-0 relative z-10 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-8">
                    <button
                      onClick={() => deleteSimulation(sim.id)}
                      disabled={deletingId === sim.id}
                      className="p-4 rounded-2xl bg-gray-50 text-gray-400 hover:bg-rose-50 hover:text-rose-500 transition-all group"
                      title="Purge Record"
                    >
                      <Trash2 size={20} className={deletingId === sim.id ? 'animate-bounce' : ''} />
                    </button>

                    <button
                      onClick={() => setSelectedSim(sim)}
                      className="flex-grow md:flex-grow-0 flex items-center justify-center space-x-2 px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold text-sm tracking-wide shadow-xl shadow-gray-200 hover:translate-y-[-2px] active:translate-y-[0] transition-all"
                    >
                      <span>Analytics</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Analytics Modal */}
      {selectedSim && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setSelectedSim(null)}></div>
          <div className="relative bg-white w-full max-w-4xl rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="bg-gradient-to-br from-[#1a1c2c] to-[#4a1942] p-10 text-white flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">Simulated Diagnostic Report</p>
                <h2 className="text-4xl font-black mb-2">Session Summary</h2>
                <p className="text-white/60 font-medium">Session ID: {selectedSim.id.toString().padStart(6, '0')}</p>
              </div>
              <button onClick={() => setSelectedSim(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <XCircle size={32} className="text-white/20 hover:text-white" />
              </button>
            </div>

            <div className="p-10 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                  <p className="text-[10px] font-black uppercase text-emerald-600/60 mb-1">Cardiac Stress Profile</p>
                  <p className="text-2xl font-black text-emerald-900 capitalize">{selectedSim.protocol.replace('_', ' ')}</p>
                </div>
                <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
                  <p className="text-[10px] font-black uppercase text-indigo-600/60 mb-1">Session Duration</p>
                  <p className="text-2xl font-black text-indigo-900">{selectedSim.duration ? `${Math.floor(selectedSim.duration / 60)}m ${selectedSim.duration % 60}s` : '0m 0s'}</p>
                </div>
                <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100">
                  <p className="text-[10px] font-black uppercase text-rose-600/60 mb-1">Final Risk Score</p>
                  <p className="text-2xl font-black text-rose-900">{selectedSim.risk_score?.toFixed(1) || 'N/A'}%</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Diagnostic Commentary</h4>
                <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
                  <p className="text-gray-700 leading-relaxed font-medium">
                    This simulation highlights a biological heart age of <span className="text-rose-500 font-bold">{Math.round(selectedSim.heart_age || 0)} years</span>.
                    Based on the treadmill metrics recorded, the digital twin suggests that cardiovascular resilience is
                    <span className="text-emerald-600 font-bold"> {((selectedSim.risk_score || 0) < 30) ? 'High' : ((selectedSim.risk_score || 0) < 70) ? 'Moderate' : 'Strained'}</span>.
                    Recommended follow-up includes maintaining consistent metabolic activity and monitoring systolic variations under load.
                  </p>
                </div>
              </div>

              {/* Chart Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Telemetry Analysis</h4>
                </div>
                <div className="bg-white rounded-3xl p-6 border border-gray-100 h-64 shadow-inner">
                  {isLoadingData ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8F87F1]"></div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Reconstructing Timeline...</p>
                    </div>
                  ) : simDataPoints.length > 0 ? (
                    <Line
                      data={{
                        labels: simDataPoints.map(d => `${d.timestamp}s`),
                        datasets: [
                          {
                            label: 'Heart Rate (BPM)',
                            data: simDataPoints.map(d => d.heart_rate),
                            borderColor: 'rgb(244, 63, 94)',
                            backgroundColor: 'rgba(244, 63, 94, 0.1)',
                            fill: true,
                            tension: 0.4
                          },
                          {
                            label: 'Systolic BP (mmHg)',
                            data: simDataPoints.map(d => d.blood_pressure),
                            borderColor: 'rgb(167, 139, 250)',
                            backgroundColor: 'transparent',
                            tension: 0.4
                          }
                        ]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                          mode: 'index',
                          intersect: false,
                        },
                        scales: {
                          y: { beginAtZero: false },
                          x: { ticks: { maxTicksLimit: 10 } }
                        },
                        elements: {
                          point: { radius: 0 }
                        }
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                      <Activity className="h-8 w-8 text-gray-300 mb-2" />
                      <div className="text-gray-400 font-medium text-sm">No fine-grained telemetry data available for this legacy session.</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setSelectedSim(null)}
                  className="px-10 py-5 bg-gray-900 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-black transition-all"
                >
                  Dismiss Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
