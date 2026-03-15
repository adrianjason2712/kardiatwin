import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Activity,
  ChevronLeft,
  Heart,
  ShieldCheck,
  Zap,
  TrendingDown,
  TrendingUp,
  User,
  Info
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
  
  patient_age?: number;
  patient_gender?: string;
  smoking_status?: string;
  diabetes_history?: string;
  alcohol_consumption?: string;
  activity_level?: string;
  pad_history?: string;

  peak_hr?: number;
  peak_sbp?: number;
  rest_duration?: number;
  exercise_duration?: number;
  recovery_duration?: number;
}

const SimulationAnalyticsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SimulationSession | null>(null);
  const [dataPoints, setDataPoints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchSessionDetails(id);
    }
  }, [id]);

  const fetchSessionDetails = async (sessionId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch summary and telemetry in parallel
      const [summaryRes, dataRes] = await Promise.all([
        API.get(`/api/simulations/${sessionId}`),
        API.get(`/api/simulations/${sessionId}/data`)
      ]);
      
      setSession(summaryRes.data);
      setDataPoints(dataRes.data.data_points || []);
    } catch (err: any) {
      console.error('Failed to fetch session details', err);
      setError(err.response?.data?.detail || 'Failed to retrieve simulation analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const safeDateString = dateString.endsWith('Z') || dateString.includes('+') ? dateString : `${dateString}Z`;
    const date = new Date(safeDateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-full border-4 border-[#8F87F1]/20"></div>
          <div className="absolute inset-0 rounded-full border-4 border-[#8F87F1] border-t-transparent animate-spin"></div>
        </div>
        <p className="text-gray-400 font-bold tracking-widest uppercase text-xs">Reconstructing Diagnostic Report...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-4xl mx-auto mt-20 p-10 bg-white rounded-[3rem] shadow-2xl text-center border border-rose-100">
        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-500">
          <Zap size={40} className="animate-pulse" />
        </div>
        <h2 className="text-3xl font-black text-gray-800 mb-4 tracking-tight">Access Denied or Session Not Found</h2>
        <p className="text-gray-500 mb-10 leading-relaxed max-w-md mx-auto">{error || "The simulation session you are looking for does not exist or you do not have permission to view it."}</p>
        <button 
          onClick={() => navigate('/history')}
          className="flex items-center justify-center space-x-2 px-10 py-5 bg-gray-900 text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all mx-auto"
        >
          <ChevronLeft size={16} />
          <span>Return to History</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-700">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1a1c2c] to-[#4a1942] p-10 text-white shadow-2xl border border-white/5">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-[#8F87F1] opacity-10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-[#C68EFD] opacity-10 rounded-full blur-[100px]"></div>

        <div className="relative z-10">
          <button 
            onClick={() => navigate('/history')}
            className="flex items-center space-x-2 text-white/60 hover:text-white mb-8 transition-colors group"
          >
            <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-bold text-sm tracking-wide uppercase">Back to Vault</span>
          </button>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10">
                  <Activity className="h-6 w-6 text-[#8F87F1]" />
                </div>
                <span className="text-white/40 text-sm font-black uppercase tracking-widest">Diagnostic ID: #{session.id.toString().padStart(6, '0')}</span>
              </div>
              <h1 className="text-5xl font-black tracking-tight mb-3">Diagnostic Analysis</h1>
              <p className="text-white/50 text-lg font-medium">{formatDate(session.created_at)}</p>
            </div>

            <div className="flex items-center space-x-4">
              <div className="px-6 py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
                <p className="text-xs text-white/40 font-bold uppercase tracking-widest mb-1">Risk Score</p>
                <div className="flex items-center space-x-3">
                  <span className={`text-2xl font-black ${session.risk_score && session.risk_score > 70 ? 'text-rose-400' : session.risk_score && session.risk_score > 30 ? 'text-orange-400' : 'text-emerald-400'}`}>
                    {session.risk_score?.toFixed(1)}%
                  </span>
                  <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${session.risk_score && session.risk_score > 70 ? 'bg-rose-500' : session.risk_score && session.risk_score > 30 ? 'bg-orange-400' : 'bg-emerald-400'}`}
                      style={{ width: `${session.risk_score}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Core Metrics */}
        <div className="lg:col-span-2 space-y-8">
          {/* Vitals Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-xl shadow-gray-200/50">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                  <Activity size={24} />
                </div>
                <TrendingDown size={20} className="text-emerald-400" />
              </div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Rest Duration</p>
              <h3 className="text-2xl font-black text-gray-800">{session.rest_duration ? `${Math.floor(session.rest_duration / 60)}m ${session.rest_duration % 60}s` : '--'}</h3>
            </div>

            <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-xl shadow-gray-200/50">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-orange-50 rounded-2xl text-orange-600">
                  <Zap size={24} />
                </div>
                <TrendingUp size={20} className="text-orange-400" />
              </div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Exercise Duration</p>
              <h3 className="text-2xl font-black text-gray-800">{session.exercise_duration ? `${Math.floor(session.exercise_duration / 60)}m ${session.exercise_duration % 60}s` : '--'}</h3>
            </div>

            <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-xl shadow-gray-200/50">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                  <Heart size={24} />
                </div>
                <TrendingDown size={20} className="text-indigo-400" />
              </div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">Recovery Duration</p>
              <h3 className="text-2xl font-black text-gray-800">{session.recovery_duration ? `${Math.floor(session.recovery_duration / 60)}m ${session.recovery_duration % 60}s` : '--'}</h3>
            </div>
          </div>

          {/* Telemetry Chart */}
          <div className="bg-white rounded-[3rem] p-10 border border-gray-100 shadow-2xl shadow-gray-200/40">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="text-2xl font-black text-gray-800 tracking-tight">Physiological Timeline</h4>
                <p className="text-gray-400 font-medium text-sm">High-resolution heart rate and systolic pressure mapping</p>
              </div>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Heart Rate</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-400"></div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Systolic BP</span>
                </div>
              </div>
            </div>

            <div className="h-[400px]">
              {dataPoints.length > 0 ? (
                <Line
                  data={{
                    labels: dataPoints.map(d => `${d.timestamp}s`),
                    datasets: [
                      {
                        label: 'Heart Rate (BPM)',
                        data: dataPoints.map(d => d.heart_rate),
                        borderColor: 'rgb(244, 63, 94)',
                        backgroundColor: 'rgba(244, 63, 94, 0.05)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: 'rgb(244, 63, 94)',
                        pointHoverBorderColor: 'white',
                        pointHoverBorderWidth: 2,
                      },
                      {
                        label: 'Systolic BP (mmHg)',
                        data: dataPoints.map(d => d.blood_pressure_systolic),
                        borderColor: 'rgb(129, 140, 248)',
                        backgroundColor: 'transparent',
                        tension: 0.4,
                        borderWidth: 3,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: 'rgb(129, 140, 248)',
                        pointHoverBorderColor: 'white',
                        pointHoverBorderWidth: 2,
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
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12,
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 13 },
                        cornerRadius: 12,
                        displayColors: true
                      }
                    },
                    scales: {
                      y: { 
                        grid: { color: 'rgba(0,0,0,0.03)' },
                        ticks: { font: { weight: 'bold', size: 11 }, color: '#94a3b8' }
                      },
                      x: { 
                        grid: { display: false },
                        ticks: { font: { weight: 'bold', size: 11 }, color: '#94a3b8', maxTicksLimit: 12 }
                      }
                    }
                  }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  <Activity size={48} className="text-gray-200 mb-4" />
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No Telemetry Recorded</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Context & Commentary */}
        <div className="space-y-8">
          {/* Biological Assessment */}
          <div className="bg-white rounded-[3rem] p-8 border border-gray-100 shadow-2xl shadow-gray-200/40">
            <h4 className="text-xl font-black text-gray-800 mb-6 flex items-center space-x-2">
              <ShieldCheck className="text-[#8F87F1]" />
              <span>Cardiac Age</span>
            </h4>
            
            <div className="flex flex-col items-center text-center py-6">
              <div className="relative mb-6">
                <div className="w-32 h-32 rounded-full border-8 border-rose-50 flex items-center justify-center">
                  <span className="text-4xl font-black text-rose-500">{Math.round(session.heart_age || session.patient_age || 0)}</span>
                </div>
                <div className="absolute -bottom-2 right-0 bg-gray-900 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  Years
                </div>
              </div>
              <p className="font-bold text-gray-800 text-lg mb-2">Biological Assessment</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Based on stress tolerance and recovery profiles, your estimated cardiac biological age is {Math.round(session.heart_age || session.patient_age || 0)} years.
              </p>
            </div>

            <div className="space-y-4 pt-6 border-t border-gray-50">
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl shrink-0">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Peak HR</span>
                <span className="font-black text-gray-800">{Math.round(session.peak_hr || 0)} BPM</span>
              </div>
              <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl shrink-0">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Peak SBP</span>
                <span className="font-black text-gray-800">{Math.round(session.peak_sbp || 0)} mmHg</span>
              </div>
            </div>
          </div>

          {/* Clinical Context Snapshot */}
          <div className="bg-white rounded-[3rem] p-8 border border-gray-100 shadow-2xl shadow-gray-200/40">
            <h4 className="text-xl font-black text-gray-800 mb-6 flex items-center space-x-2">
              <User className="text-[#C68EFD]" />
              <span>Clinical Profile</span>
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-[10px] font-black uppercase text-gray-400">Baseline Age</span>
                <span className="text-sm font-bold text-gray-700">{session.patient_age || '--'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-[10px] font-black uppercase text-gray-400">Smoking Status</span>
                <span className="text-sm font-bold text-gray-700 capitalize">{(session.smoking_status || 'non-smoker').replace('_', ' ')}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-[10px] font-black uppercase text-gray-400">Diabetes History</span>
                <span className="text-sm font-bold text-gray-700 capitalize">{(session.diabetes_history || 'none').replace('_', ' ')}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-[10px] font-black uppercase text-gray-400">Alcohol Consumption</span>
                <span className="text-sm font-bold text-gray-700 capitalize">{(session.alcohol_consumption || 'none').replace('_', ' ')}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-[10px] font-black uppercase text-gray-400">PAD History</span>
                <span className={`text-sm font-bold ${session.pad_history === 'pad' ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {session.pad_history === 'pad' ? 'Positive' : 'No PAD'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-[10px] font-black uppercase text-gray-400">Activity Level</span>
                <span className="text-sm font-bold text-gray-700 capitalize">{session.activity_level || 'Active'}</span>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-[2.5rem] p-8">
            <div className="flex items-start space-x-3">
              <div className="bg-indigo-500 text-white p-1.5 rounded-lg shrink-0">
                <Info size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-900 uppercase tracking-widest mb-2">Clinical Note</p>
                <p className="text-indigo-800/70 text-xs leading-relaxed font-medium">
                  This report is generated by the KardiaTwin physiological simulation engine for educational purposes. It establishes a cardiovascular baseline based on your specific biomarkers and treadmill performance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulationAnalyticsPage;
