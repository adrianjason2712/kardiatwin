import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingDown, Activity, Heart, Zap, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

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
      const response = await axios.post('http://localhost:8000/what_if_analysis', whatIfChanges);
      setWhatIfResults(response.data);
    } catch (err) {
      setError('Failed to fetch What If analysis');
      console.error('Error fetching What If analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  const getImprovementColor = (value: number): string => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getModifierColor = (value: number): string => {
    if (value > 1) return 'text-red-600';
    if (value < 1) return 'text-green-600';
    return 'text-gray-600';
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
    <div className="flex-grow space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">What If Calculator</h2>
            <p className="text-gray-600">Explore how lifestyle changes could improve your heart health</p>
          </div>
          <TrendingDown className="h-12 w-12 text-purple-600 flex-shrink-0" />
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center space-x-2">
          <Activity className="h-6 w-6 text-blue-600" />
          <span>Select Hypothetical Lifestyle Changes</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Smoking Status */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Smoking Status</label>
            <select
              value={whatIfChanges.smoking_status}
              onChange={(e) => setWhatIfChanges({ ...whatIfChanges, smoking_status: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select smoking status</option>
              <option value="non_smoker">Non-Smoker</option>
              <option value="smoker">Smoker</option>
              <option value="ex_smoker">Ex-Smoker</option>
            </select>
          </div>

          {/* Diabetes History */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Diabetes History</label>
            <select
              value={whatIfChanges.diabetes_history}
              onChange={(e) => setWhatIfChanges({ ...whatIfChanges, diabetes_history: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select diabetes status</option>
              <option value="none">None</option>
              <option value="type_1">Type 1 Diabetes</option>
              <option value="type_2">Type 2 Diabetes</option>
            </select>
          </div>

          {/* Alcohol Consumption */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Alcohol Consumption</label>
            <select
              value={whatIfChanges.alcohol_consumption}
              onChange={(e) => setWhatIfChanges({ ...whatIfChanges, alcohol_consumption: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select alcohol consumption</option>
              <option value="none">None</option>
              <option value="moderate">Moderate</option>
              <option value="heavy">Heavy</option>
            </select>
          </div>

          {/* Activity Level */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Activity Level</label>
            <select
              value={whatIfChanges.activity_level}
              onChange={(e) => setWhatIfChanges({ ...whatIfChanges, activity_level: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select activity level</option>
              <option value="sedentary">Sedentary</option>
              <option value="active">Active</option>
              <option value="athlete">Athlete</option>
            </select>
          </div>
        </div>

        {/* Analyze Button */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={fetchWhatIfAnalysis}
            disabled={loading}
            className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin">
                  <Zap className="h-5 w-5" />
                </div>
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-5 w-5" />
                <span>Analyze Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

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

      {/* Results Section */}
      {whatIfResults && !loading && (
        <>
          {/* Personalized Message */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-200">
            <p className="text-gray-800 text-lg leading-relaxed">{whatIfResults.message}</p>
          </div>

          {/* Predicted Improvements */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center space-x-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <span>Predicted Improvements</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* SBP Reduction */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                <p className="text-sm text-gray-600 mb-2">SBP Reduction</p>
                <div className="flex items-baseline space-x-2">
                  <span className={`text-3xl font-bold ${getImprovementColor(whatIfResults.predicted_improvements.sbp_reduction)}`}>
                    {Math.abs(whatIfResults.predicted_improvements.sbp_reduction).toFixed(1)}%
                  </span>
                  {whatIfResults.predicted_improvements.sbp_reduction > 0 && (
                    <span className="text-green-600 text-sm font-medium">↓ Better</span>
                  )}
                  {whatIfResults.predicted_improvements.sbp_reduction < 0 && (
                    <span className="text-red-600 text-sm font-medium">↑ Worse</span>
                  )}
                </div>
              </div>

              {/* HR Improvement */}
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-gray-600 mb-2">HR Improvement</p>
                <div className="flex items-baseline space-x-2">
                  <span className={`text-3xl font-bold ${getImprovementColor(whatIfResults.predicted_improvements.hr_improvement)}`}>
                    {Math.abs(whatIfResults.predicted_improvements.hr_improvement).toFixed(1)}%
                  </span>
                  {whatIfResults.predicted_improvements.hr_improvement > 0 && (
                    <span className="text-green-600 text-sm font-medium">↓ Better</span>
                  )}
                  {whatIfResults.predicted_improvements.hr_improvement < 0 && (
                    <span className="text-red-600 text-sm font-medium">↑ Worse</span>
                  )}
                </div>
              </div>

              {/* Recovery Improvement */}
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-4 border border-orange-200">
                <p className="text-sm text-gray-600 mb-2">Recovery Improvement</p>
                <div className="flex items-baseline space-x-2">
                  <span className={`text-3xl font-bold ${getImprovementColor(whatIfResults.predicted_improvements.recovery_improvement)}`}>
                    {Math.abs(whatIfResults.predicted_improvements.recovery_improvement).toFixed(1)}%
                  </span>
                  {whatIfResults.predicted_improvements.recovery_improvement > 0 && (
                    <span className="text-green-600 text-sm font-medium">↑ Better</span>
                  )}
                  {whatIfResults.predicted_improvements.recovery_improvement < 0 && (
                    <span className="text-red-600 text-sm font-medium">↓ Worse</span>
                  )}
                </div>
              </div>

              {/* Baseline HR Reduction */}
              <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-lg p-4 border border-pink-200">
                <p className="text-sm text-gray-600 mb-2">Baseline HR Reduction</p>
                <div className="flex items-baseline space-x-2">
                  <span className={`text-3xl font-bold ${getImprovementColor(whatIfResults.predicted_improvements.baseline_hr_reduction)}`}>
                    {Math.abs(whatIfResults.predicted_improvements.baseline_hr_reduction).toFixed(1)} BPM
                  </span>
                  {whatIfResults.predicted_improvements.baseline_hr_reduction > 0 && (
                    <span className="text-green-600 text-sm font-medium">↓ Better</span>
                  )}
                  {whatIfResults.predicted_improvements.baseline_hr_reduction < 0 && (
                    <span className="text-red-600 text-sm font-medium">↑ Worse</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center space-x-2">
              <Heart className="h-6 w-6 text-red-600" />
              <span>Physiological Modifier Comparison</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Metric</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Current</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Hypothetical</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Change</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-700 font-medium">SBP Modifier</td>
                    <td className="text-center py-3 px-4">
                      <span className={`font-semibold ${getModifierColor(whatIfResults.current.sbp_modifier)}`}>
                        {whatIfResults.current.sbp_modifier.toFixed(3)}x
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className={`font-semibold ${getModifierColor(whatIfResults.hypothetical.sbp_modifier)}`}>
                        {whatIfResults.hypothetical.sbp_modifier.toFixed(3)}x
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className={`font-semibold ${
                        whatIfResults.hypothetical.sbp_modifier < whatIfResults.current.sbp_modifier
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {(whatIfResults.hypothetical.sbp_modifier - whatIfResults.current.sbp_modifier).toFixed(3)}x
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-700 font-medium">HR Modifier</td>
                    <td className="text-center py-3 px-4">
                      <span className={`font-semibold ${getModifierColor(whatIfResults.current.hr_modifier)}`}>
                        {whatIfResults.current.hr_modifier.toFixed(3)}x
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className={`font-semibold ${getModifierColor(whatIfResults.hypothetical.hr_modifier)}`}>
                        {whatIfResults.hypothetical.hr_modifier.toFixed(3)}x
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className={`font-semibold ${
                        whatIfResults.hypothetical.hr_modifier < whatIfResults.current.hr_modifier
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {(whatIfResults.hypothetical.hr_modifier - whatIfResults.current.hr_modifier).toFixed(3)}x
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-700 font-medium">Recovery Modifier</td>
                    <td className="text-center py-3 px-4">
                      <span className={`font-semibold ${getModifierColor(whatIfResults.current.recovery_modifier)}`}>
                        {whatIfResults.current.recovery_modifier.toFixed(3)}x
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className={`font-semibold ${getModifierColor(whatIfResults.hypothetical.recovery_modifier)}`}>
                        {whatIfResults.hypothetical.recovery_modifier.toFixed(3)}x
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className={`font-semibold ${
                        whatIfResults.hypothetical.recovery_modifier > whatIfResults.current.recovery_modifier
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {(whatIfResults.hypothetical.recovery_modifier - whatIfResults.current.recovery_modifier).toFixed(3)}x
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-700 font-medium">Baseline HR</td>
                    <td className="text-center py-3 px-4">
                      <span className="font-semibold text-gray-700">
                        {whatIfResults.current.baseline_hr.toFixed(1)} BPM
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="font-semibold text-gray-700">
                        {whatIfResults.hypothetical.baseline_hr.toFixed(1)} BPM
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className={`font-semibold ${
                        whatIfResults.hypothetical.baseline_hr < whatIfResults.current.baseline_hr
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {(whatIfResults.hypothetical.baseline_hr - whatIfResults.current.baseline_hr).toFixed(1)} BPM
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
            <h4 className="font-semibold text-purple-900 mb-2">Understanding the Results</h4>
            <ul className="text-sm text-purple-800 space-y-1">
              <li>• <strong>Modifiers &lt; 1.0:</strong> Physiological improvement (better health)</li>
              <li>• <strong>Modifiers &gt; 1.0:</strong> Physiological burden (worse health)</li>
              <li>• <strong>Modifiers multiply:</strong> Multiple positive changes compound for greater benefits</li>
              <li>• <strong>Baseline HR:</strong> Your heart rate at rest (lower is generally better)</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
};
