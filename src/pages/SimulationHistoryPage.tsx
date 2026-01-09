import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import API from '../utils/axios';
import { Trash2, Calendar, Activity } from 'lucide-react';

interface SimulationSession {
  id: number;
  created_at: string;
  protocol: string;
  duration: number;
  risk_score?: number;
}

interface HistoryResponse {
  sessions: SimulationSession[];
  total: number;
  limit: number;
  offset: number;
}

export const SimulationHistoryPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [simulations, setSimulations] = useState<SimulationSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchSimulations();
  }, []);

  const fetchSimulations = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await API.get<HistoryResponse>('/api/simulations?limit=20&offset=0');
      setSimulations(response.data.sessions);
    } catch (err: any) {
      // If 401, logout and redirect to login
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
    if (!confirm('Are you sure you want to delete this simulation?')) {
      return;
    }

    setDeletingId(id);
    try {
      await API.delete(`/api/simulations/${id}`);
      setSimulations(simulations.filter((s) => s.id !== id));
    } catch (err: any) {
      // If 401, logout and redirect to login
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex-grow">
      <div className="bg-white rounded-xl shadow-xl p-8 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800 gradient-text">Simulation History</h1>
          <p className="text-gray-600">User: {user?.username}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#8F87F1]"></div>
            <p className="text-gray-600 mt-4">Loading simulation history...</p>
          </div>
        ) : simulations.length === 0 ? (
          <div className="text-center py-12">
            <Activity size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 text-lg">No simulations yet</p>
            <p className="text-gray-500">Start a new simulation to see it appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-4 bg-gray-50 p-4 rounded-lg font-semibold text-gray-700 text-sm">
              <div className="col-span-3">Date & Time</div>
              <div className="col-span-2">Protocol</div>
              <div className="col-span-2">Duration</div>
              <div className="col-span-3">Risk Score</div>
              <div className="col-span-2">Actions</div>
            </div>

            {simulations.map((sim) => (
              <div
                key={sim.id}
                className="grid grid-cols-12 gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition items-center"
              >
                <div className="col-span-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-gray-400" />
                    <span className="text-sm">{formatDate(sim.created_at)}</span>
                  </div>
                </div>

                <div className="col-span-2">
                  <span className="px-3 py-1 bg-[#8F87F1] bg-opacity-10 text-[#8F87F1] rounded-full text-sm font-medium">
                    {sim.protocol}
                  </span>
                </div>

                <div className="col-span-2">
                  <span className="text-sm">
                    {sim.duration ? `${Math.round(sim.duration / 60)} min` : 'N/A'}
                  </span>
                </div>

                <div className="col-span-3">
                  {sim.risk_score !== undefined ? (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm"
                        style={{
                          backgroundColor:
                            sim.risk_score > 70
                              ? '#EF4444'
                              : sim.risk_score > 40
                              ? '#FBBF24'
                              : '#10B981',
                        }}
                      >
                        {sim.risk_score.toFixed(0)}
                      </div>
                      <span className="text-sm">
                        {sim.risk_score > 70
                          ? 'High'
                          : sim.risk_score > 40
                          ? 'Medium'
                          : 'Low'}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">Not recorded</span>
                  )}
                </div>

                <div className="col-span-2">
                  <button
                    onClick={() => deleteSimulation(sim.id)}
                    disabled={deletingId === sim.id}
                    className="inline-flex items-center gap-2 px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                    <span className="text-sm">{deletingId === sim.id ? 'Deleting...' : 'Delete'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
