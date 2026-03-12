import React, { useState } from 'react';
import API from '../utils/axios';
import { TrendingDown, Activity, Heart, Zap, Droplets } from 'lucide-react';

interface WhatIfResults {
  current: {
    sbp_modifier: number;
    hr_modifier: number;
    recovery_modifier: number;
    baseline_hr: number;
  };
  hypothetical: {
    sbp_modifier: number;
    hr_modifier: number;
    recovery_modifier: number;
    baseline_hr: number;
  };
  predicted_improvements: {
    sbp_reduction: number;
    hr_improvement: number;
    recovery_improvement: number;
    baseline_hr_reduction: number;
  };
  message: string;
}

interface WhatIfCalculatorPageProps {
  userData: any;
  data: any;
  originalWhatIfChanges?: any;
}

export const WhatIfCalculatorPage: React.FC<WhatIfCalculatorPageProps> = ({
  userData,
  data,
  originalWhatIfChanges
}) => {
  const [whatIfChanges, setWhatIfChanges] = useState(originalWhatIfChanges || {
    smoking_status: userData?.smoking_status || '',
    diabetes_history: userData?.diabetes_history || '',
    alcohol_consumption: userData?.alcohol_consumption || '',
    activity_level: userData?.activity_level || ''
  });

  const [whatIfResults, setWhatIfResults] = useState<WhatIfResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWhatIfAnalysis = async () => {
    if (!data || !userData) {
      setError('Please run a simulation first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await API.post('/what_if_analysis', whatIfChanges);
      setWhatIfResults(response.data);
    } catch (err) {
      setError('Failed to fetch What If analysis');
      console.error('Error fetching What If analysis:', err);
    } finally {
      setLoading(false);
    }
  };


  if (!data || !userData || !userData.age) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200 max-w-md">
          <TrendingDown className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-2xl font-semibold text-gray-800 mb-2">No Simulation Data</h3>
          <p className="text-gray-600 mb-6">Please run a simulation on the <strong>Simulation</strong> tab first to use What If analysis.</p>
          <p className="text-sm text-gray-500">Once you complete a simulation, you can explore lifestyle changes and their impact on your heart health.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-120px)] flex flex-col space-y-8 animate-in fade-in duration-700">
      {/* Premium Header HUD */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#1a1c2c] to-[#4a1942] p-10 text-white shadow-2xl border border-white/5">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-[#8F87F1] opacity-10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-[#C68EFD] opacity-10 rounded-full blur-[100px]"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/10">
                <TrendingDown className="h-6 w-6 text-[#8F87F1]" />
              </div>
              <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">Predictive Lifestyle Modeling</span>
            </div>
            <h1 className="text-5xl font-black tracking-tight mb-3">What-If Analysis</h1>
            <p className="text-white/50 max-w-xl text-lg leading-relaxed font-medium">
              Simulate lifestyle interventions on your digital twin. Observe real-time physiological improvements across your cardiovascular diagnostic parameters.
            </p>
          </div>


        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Configuration Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-xl overflow-hidden relative">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-8 flex items-center space-x-2">
              <Activity size={14} className="text-[#8F87F1]" />
              <span>Lifestyle Modifiers</span>
            </h3>

            <div className="space-y-8">
              {/* Smoking Selection */}
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Smoking Proclivity</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'non_smoker', label: 'Non-Smoker', impact: 'Optimal' },
                    { id: 'ex_smoker', label: 'Ex-Smoker', impact: 'Improving' },
                    { id: 'smoker', label: 'Smoker', impact: 'At Risk' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setWhatIfChanges({ ...whatIfChanges, smoking_status: opt.id })}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${whatIfChanges.smoking_status === opt.id
                        ? 'border-[#8F87F1] bg-[#8F87F1]/5 shadow-sm scale-[1.02]'
                        : 'border-gray-50 bg-gray-50/50 hover:bg-gray-100/50 hover:border-gray-200'
                        }`}
                    >
                      <span className={`font-black text-sm ${whatIfChanges.smoking_status === opt.id ? 'text-[#8F87F1]' : 'text-gray-700'}`}>{opt.label}</span>
                      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full ${opt.id === 'non_smoker' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-500'}`}>{opt.impact}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Activity Selection */}
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Metabolic Activity</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'sedentary', icon: '🧘', label: 'Low' },
                    { id: 'active', icon: '⚡', label: 'Mid' },
                    { id: 'athlete', icon: '🏆', label: 'Peak' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setWhatIfChanges({ ...whatIfChanges, activity_level: opt.id })}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 ${whatIfChanges.activity_level === opt.id
                        ? 'border-[#8F87F1] bg-[#8F87F1]/5 shadow-sm scale-105'
                        : 'border-gray-50 bg-gray-50/50 hover:bg-gray-100/50'
                        }`}
                    >
                      <span className="text-xl mb-1">{opt.icon}</span>
                      <span className={`text-[9px] font-black uppercase ${whatIfChanges.activity_level === opt.id ? 'text-[#8F87F1]' : 'text-gray-500'}`}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Diabetes Selection */}
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Diabetes Profile</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'none', label: 'None', impact: 'Optimal' },
                    { id: 'type_2', label: 'Type 2', impact: 'Metabolic' },
                    { id: 'type_1', label: 'Type 1', impact: 'Chronic' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setWhatIfChanges({ ...whatIfChanges, diabetes_history: opt.id })}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${whatIfChanges.diabetes_history === opt.id
                        ? 'border-[#8F87F1] bg-[#8F87F1]/5 shadow-sm scale-[1.02]'
                        : 'border-gray-50 bg-gray-50/50 hover:bg-gray-100/50 hover:border-gray-200'
                        }`}
                    >
                      <span className={`font-black text-sm ${whatIfChanges.diabetes_history === opt.id ? 'text-[#8F87F1]' : 'text-gray-700'}`}>{opt.label}</span>
                      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full ${opt.id === 'none' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-500'}`}>{opt.impact}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Alcohol Selection */}
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Alcohol Intake</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'none', icon: '💧', label: 'None' },
                    { id: 'moderate', icon: '🍷', label: 'Mod' },
                    { id: 'heavy', icon: '🥃', label: 'High' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setWhatIfChanges({ ...whatIfChanges, alcohol_consumption: opt.id })}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 ${whatIfChanges.alcohol_consumption === opt.id
                        ? 'border-[#8F87F1] bg-[#8F87F1]/5 shadow-sm scale-105'
                        : 'border-gray-50 bg-gray-50/50 hover:bg-gray-100/50'
                        }`}
                    >
                      <span className="text-xl mb-1">{opt.icon}</span>
                      <span className={`text-[9px] font-black uppercase ${whatIfChanges.alcohol_consumption === opt.id ? 'text-[#8F87F1]' : 'text-gray-500'}`}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Analyze CTA */}
              <button
                onClick={fetchWhatIfAnalysis}
                disabled={loading}
                className="w-full py-5 bg-gray-900 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-black active:scale-95 transition-all overflow-hidden flex items-center justify-center space-x-3 outline-none"
              >
                {loading ? <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <TrendingDown size={16} />}
                <span>{loading ? 'Processing Twin...' : 'Analyze Interventions'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Results Display */}
        <div className="lg:col-span-8 space-y-8">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-6 py-4 rounded-2xl flex items-center space-x-3 shadow-sm animate-shake">
              <Zap className="h-5 w-5 animate-pulse" />
              <span className="font-bold text-sm uppercase tracking-tighter">{error}</span>
            </div>
          )}

          {!whatIfResults && !loading && !error && (
            <div className="bg-white rounded-[2.5rem] p-20 border border-dashed border-gray-200 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mb-6 shadow-inner">
                <TrendingDown className="text-gray-300" size={32} />
              </div>
              <h3 className="text-2xl font-black text-gray-800 tracking-tight mb-2">Simulation Engine Idle</h3>
              <p className="text-gray-400 max-w-sm font-medium leading-relaxed">Configure your lifestyle modifiers and click Analyze to generate projection data.</p>
            </div>
          )}

          {whatIfResults && !loading && (
            <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-700 fill-mode-forwards">
              {/* Insight Card */}
              <div className="bg-gradient-to-br from-[#8F87F1]/5 to-[#C68EFD]/5 rounded-[2.5rem] p-8 border border-[#8F87F1]/10">
                <div className="flex items-start space-x-4">
                  <div className="p-3 rounded-2xl bg-white shadow-sm">
                    <Zap className="h-6 w-6 text-[#8F87F1]" />
                  </div>
                  <p className="text-gray-800 text-lg font-semibold leading-relaxed">
                    {whatIfResults.message}
                  </p>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: 'Blood Pressure', value: whatIfResults.predicted_improvements.sbp_reduction, unit: '% Improvement', color: 'emerald', icon: <Droplets /> },
                  { label: 'Heart Efficiency', value: whatIfResults.predicted_improvements.hr_improvement, unit: '% Efficiency', color: 'blue', icon: <Activity /> },
                  { label: 'Recovery Velocity', value: whatIfResults.predicted_improvements.recovery_improvement, unit: '% Velocity', color: 'indigo', icon: <Zap /> },
                  { label: 'Baseline Delta', value: Math.abs(whatIfResults.predicted_improvements.baseline_hr_reduction), unit: 'BPM Reduction', color: 'rose', icon: <Heart /> }
                ].map((metric) => (
                  <div key={metric.label} className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-md hover:shadow-xl transition-all group overflow-hidden relative">
                    <div className="relative z-10">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">{metric.label}</p>
                      <div className="flex items-baseline space-x-2">
                        <span className={`text-4xl font-black text-${metric.color}-500`}>
                          {metric.value.toFixed(1)}
                        </span>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{metric.unit}</span>
                      </div>
                    </div>
                    <div className={`absolute -right-4 -bottom-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-700 text-${metric.color}-900`}>
                      {React.cloneElement(metric.icon as React.ReactElement, { size: 100 })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Forensic Details Table */}
              <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-xl">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-8">Physiological Factor forensic Analysis</h3>
                <div className="overflow-hidden rounded-3xl border border-gray-50">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="text-left py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Diagnostic Metric</th>
                        <th className="text-center py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Current Twin</th>
                        <th className="text-center py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Hypothetical Twin</th>
                        <th className="text-center py-4 px-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Projection Delta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[
                        { label: 'SBP Multiplier', curr: whatIfResults.current.sbp_modifier, hypo: whatIfResults.hypothetical.sbp_modifier, diff: whatIfResults.hypothetical.sbp_modifier - whatIfResults.current.sbp_modifier, inv: false },
                        { label: 'HR Multiplier', curr: whatIfResults.current.hr_modifier, hypo: whatIfResults.hypothetical.hr_modifier, diff: whatIfResults.hypothetical.hr_modifier - whatIfResults.current.hr_modifier, inv: false },
                        { label: 'Recovery Factor', curr: whatIfResults.current.recovery_modifier, hypo: whatIfResults.hypothetical.recovery_modifier, diff: whatIfResults.hypothetical.recovery_modifier - whatIfResults.current.recovery_modifier, inv: true },
                        { label: 'Resting Baseline', curr: whatIfResults.current.baseline_hr, hypo: whatIfResults.hypothetical.baseline_hr, diff: whatIfResults.hypothetical.baseline_hr - whatIfResults.current.baseline_hr, inv: false, unit: ' BPM' }
                      ].map((row) => (
                        <tr key={row.label} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-5 px-6 font-bold text-gray-800 text-sm">{row.label}</td>
                          <td className="text-center py-5 px-6 font-black text-gray-400 text-sm">{row.curr.toFixed(3)}{row.unit || 'x'}</td>
                          <td className="text-center py-5 px-6 font-black text-gray-800 text-sm bg-gray-50/30">{row.hypo.toFixed(3)}{row.unit || 'x'}</td>
                          <td className={`text-center py-5 px-6 font-black text-sm ${((row.diff < 0 && !row.inv) || (row.diff > 0 && row.inv)) ? 'text-emerald-500' : 'text-gray-400'}`}>
                            {row.diff > 0 ? '+' : ''}{row.diff.toFixed(row.unit ? 1 : 3)}{row.unit || 'x'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
