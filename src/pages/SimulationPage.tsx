import React from 'react';
import { CheckCircle2, Zap, Activity, Heart, Shield, Bell, XCircle, AlertCircle } from 'lucide-react'; import { HeartScene } from '../components/HeartScene';
import { SimulationProgress } from '../components/SimulationProgress';
import { Line } from 'react-chartjs-2';

interface SimulationPageProps {
  userData: any;
  data: any;
  simulationStarted: boolean;
  isFormComplete: () => boolean;
  handleSubmit: (e: React.FormEvent) => void;
  handleStopSimulation: () => Promise<void>;
  setUserData: (data: any) => void;
  updateDefaultProtocolByAge: (age: string) => void;
  getExerciseRecommendations: (data: any) => any[];
  chartData: any;
  engineConfig: any;
  exerciseStages?: any[];
  thresholds: any;
  handleUpdateThresholds: (thresholds: any) => void;
  alerts: any[];
}

export const SimulationPage: React.FC<SimulationPageProps> = ({
  userData,
  data,
  simulationStarted,
  isFormComplete,
  handleSubmit,
  handleStopSimulation,
  setUserData,
  updateDefaultProtocolByAge,
  getExerciseRecommendations,
  chartData,
  engineConfig,
  exerciseStages = [],
  thresholds,
  handleUpdateThresholds,
  alerts
}) => {
  const [activeTab, setActiveTab] = React.useState<'required' | 'lifestyle' | 'safety'>('required');
  const [simTab, setSimTab] = React.useState<'monitoring' | 'progress' | 'visualizer' | 'alerts' | 'advice'>('monitoring');
  const [isStopping, setIsStopping] = React.useState(false);

  const onStopSimulation = async () => {
    if (window.confirm('Are you sure you want to stop the simulation? Your data will be saved.')) {
      setIsStopping(true);
      try {
        await handleStopSimulation();
      } finally {
        setIsStopping(false);
      }
    }
  };

  return (
    <div className="flex-grow">
      {!simulationStarted ? (
        <div className="relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-[3rem] shadow-2xl p-8 md:p-12 mb-8 border border-white/40">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-[#8F87F1] opacity-5 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-[#C68EFD] opacity-5 rounded-full blur-[100px] pointer-events-none"></div>

          <form
            onSubmit={handleSubmit}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !(e.target as HTMLElement).classList.contains('submit-button')) {
                e.preventDefault();
              }
            }}
            className="relative z-10 max-w-4xl mx-auto space-y-10"
          >
            {/* Premium Header & Tabs */}
            <div>
              <div className="p-8 bg-gradient-to-r from-[#1a1c2c] to-[#4a1942] rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl border border-white/10">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-[#8F87F1] opacity-30 rounded-full blur-[50px] pointer-events-none"></div>

                <div className="flex flex-col md:flex-row md:items-center justify-between relative z-10 gap-6">
                  <div className="flex items-center space-x-5">
                    <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-md border border-white/5">
                      <Activity className="h-8 w-8 text-[#E2DDFE]" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black tracking-tight mb-1">Simulation Setup</h3>
                      <p className="text-white/60 text-sm font-medium">Configure your digital twin parameters</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 bg-black/20 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Engine Status</span>
                    <span className={`text-xs font-black uppercase tracking-wider flex items-center ${isFormComplete() ? 'text-emerald-400' : 'text-orange-400'
                      }`}>
                      {isFormComplete() ? (
                        <><CheckCircle2 className="w-4 h-4 mr-1.5" /> Ready for Launch</>
                      ) : (
                        <><AlertCircle className="w-4 h-4 mr-1.5" /> Pending Config</>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex space-x-3 mt-8 border-b border-gray-100 overflow-x-auto pb-4 hide-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveTab('required')}
                  className={`flex items-center space-x-3 px-6 py-4 rounded-2xl font-bold text-sm tracking-wide transition-all ${activeTab === 'required'
                    ? 'bg-[#8F87F1]/10 text-[#8F87F1] shadow-inner'
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                    }`}
                >
                  <span>Basic Information</span>
                  <span className={`flex items-center justify-center h-6 px-2 rounded-full text-[10px] font-black ${userData.age !== '' && userData.sex !== '' && userData.protocol !== ''
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-orange-100 text-orange-700'
                    }`}>
                    {[userData.age, userData.sex, userData.cp, userData.protocol].filter(x => x !== '').length}/4
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('lifestyle')}
                  className={`flex items-center space-x-3 px-6 py-4 rounded-2xl font-bold text-sm tracking-wide transition-all ${activeTab === 'lifestyle'
                    ? 'bg-[#c68efd]/10 text-[#c68efd] shadow-inner'
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                    }`}
                >
                  <span>Lifestyle & Medical</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('safety')}
                  className={`flex items-center space-x-3 px-6 py-4 rounded-2xl font-bold text-sm tracking-wide transition-all ${activeTab === 'safety'
                    ? 'bg-emerald-500/10 text-emerald-600 shadow-inner'
                    : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                    }`}
                >
                  <Shield className="h-4 w-4" />
                  <span>Safety Settings</span>
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
              {/* REQUIRED TAB */}
              {activeTab === 'required' && (
                <>
                  {/* Age Selection */}
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Age</h2>
                    <p className="text-gray-600 text-sm mb-4">Select your exact age. This will influence exercise intensity, heart rate targets, and recovery rates.</p>
                    <div className="space-y-4">
                      {/* Age Slider */}
                      <div className="flex items-center space-x-4">
                        <input
                          type="range"
                          min="18"
                          max="105"
                          value={userData.age || '50'}
                          onChange={(e) => {
                            setUserData({ ...userData, age: e.target.value });
                            updateDefaultProtocolByAge(e.target.value);
                          }}
                          className="flex-1 h-2 bg-gradient-to-r from-[#8F87F1] to-[#C68EFD] rounded-lg appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, #8F87F1, #C68EFD)`
                          }}
                        />
                        <div className="flex items-center space-x-2 bg-[#8F87F1] bg-opacity-10 px-4 py-2 rounded-lg border border-[#8F87F1]">
                          <span className="text-sm font-medium text-gray-700">Age:</span>
                          <span className="text-2xl font-bold text-[#8F87F1] min-w-[3rem] text-right">{userData.age || '50'}</span>
                        </div>
                      </div>

                      {/* Age Category Info */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-900">
                          {userData.age ? (
                            (() => {
                              const age = parseInt(userData.age);
                              if (age < 30) return "Young Adult (18-29): Higher exercise tolerance, faster recovery expected.";
                              if (age < 40) return "Adult (30-39): Good exercise capacity, moderate recovery.";
                              if (age < 50) return "Middle-aged (40-49): Consider fitness level when selecting protocol.";
                              if (age < 60) return "Senior Adult (50-59): Transition zone - protocol choice is important.";
                              if (age < 70) return "Senior (60-69): Consider gentler protocol or Modified Bruce.";
                              return "Older Senior (70+): Modified Bruce recommended, consult healthcare provider.";
                            })()
                          ) : "Select your age"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Gender Selection */}
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Gender</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { value: '1', label: 'Male' },
                        { value: '0', label: 'Female' }
                      ].map((item) => (
                        <div
                          key={item.value}
                          className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${userData.sex === item.value ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105' : 'border-gray-200 hover:border-[#8F87F1]'
                            }`}
                          onClick={() => setUserData({ ...userData, sex: item.value })}
                        >
                          <div className="font-medium text-gray-700 text-center">{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Chest Pain Type */}
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Chest Pain Type</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {[
                        { value: '0', label: 'Typical Angina' },
                        { value: '1', label: 'Atypical Angina' },
                        { value: '2', label: 'Non-Anginal' },
                        { value: '3', label: 'Asymptomatic' }
                      ].map((item) => (
                        <div
                          key={item.value}
                          className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${userData.cp === item.value ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105' : 'border-gray-200 hover:border-[#8F87F1]'
                            }`}
                          onClick={() => setUserData({ ...userData, cp: item.value })}
                        >
                          <div className="font-medium text-gray-700 text-center text-sm">{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Protocol Selection */}
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">Exercise Protocol</h2>
                    <p className="text-gray-600 text-sm mb-4">Choose the protocol that best suits your fitness level</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        {
                          value: 'Standard Bruce',
                          label: 'Standard Bruce',
                          description: 'Higher intensity, 3 min stages. Suitable for younger/fit patients.',
                          backend: 'standard'
                        },
                        {
                          value: 'Modified Bruce',
                          label: 'Modified Bruce',
                          description: 'Lower intensity, 5 min stages. Suitable for older/unfit patients.',
                          backend: 'modified_bruce'
                        }
                      ].map((item) => (
                        <div
                          key={item.value}
                          className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${userData.protocol === item.value ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105' : 'border-gray-200 hover:border-[#8F87F1]'
                            }`}
                          onClick={() => setUserData({ ...userData, protocol: item.value })}
                        >
                          <div className="font-medium text-gray-700 mb-1">{item.label}</div>
                          <div className="text-xs text-gray-600">{item.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                </>
              )}

              {/* LIFESTYLE TAB */}
              {activeTab === 'lifestyle' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="mb-8">
                    <h2 className="text-3xl font-black text-gray-800 tracking-tight">Lifestyle & Medical History</h2>
                    <p className="text-gray-500 mt-2 font-medium">These biomarkers establish your digital twin's baseline resilience.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {/* Smoking Status */}
                    <div className="space-y-3">
                      <label className="flex items-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <Zap className="h-3 w-3 mr-2 text-[#8F87F1]" /> Smoking Status
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: 'non_smoker', label: 'Non-Smoker' },
                          { value: 'ex_smoker', label: 'Ex-Smoker' },
                          { value: 'smoker', label: 'Smoker' }
                        ].map((option) => (
                          <div
                            key={option.value}
                            className={`group relative overflow-hidden p-3 rounded-xl border-2 cursor-pointer transition-all duration-300 flex items-center justify-center text-center ${userData.smoking_status === option.value
                              ? 'border-[#8F87F1] bg-gradient-to-br from-[#8F87F1]/5 to-[#C68EFD]/5 shadow-sm scale-[1.02]'
                              : 'border-gray-100 hover:border-[#8F87F1]/30 hover:bg-gray-50/50'
                              }`}
                            onClick={() => setUserData({ ...userData, smoking_status: option.value })}
                          >
                            <div className={`text-xs font-bold transition-colors ${userData.smoking_status === option.value ? 'text-[#8F87F1]' : 'text-gray-600 group-hover:text-gray-900'}`}>{option.label}</div>
                            {userData.smoking_status === option.value && (
                              <div className="absolute top-1 right-1">
                                <CheckCircle2 className="h-3 w-3 text-[#8F87F1]" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Diabetes History */}
                    <div className="space-y-3">
                      <label className="flex items-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <Activity className="h-3 w-3 mr-2 text-[#C68EFD]" /> Diabetes History
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: 'none', label: 'None' },
                          { value: 'type_1', label: 'Type 1' },
                          { value: 'type_2', label: 'Type 2' }
                        ].map((option) => (
                          <div
                            key={option.value}
                            className={`group relative overflow-hidden p-3 rounded-xl border-2 cursor-pointer transition-all duration-300 flex items-center justify-center text-center ${userData.diabetes_history === option.value
                              ? 'border-[#C68EFD] bg-gradient-to-br from-[#8F87F1]/5 to-[#C68EFD]/5 shadow-sm scale-[1.02]'
                              : 'border-gray-100 hover:border-[#C68EFD]/30 hover:bg-gray-50/50'
                              }`}
                            onClick={() => setUserData({ ...userData, diabetes_history: option.value })}
                          >
                            <div className={`text-xs font-bold transition-colors ${userData.diabetes_history === option.value ? 'text-[#C68EFD]' : 'text-gray-600 group-hover:text-gray-900'}`}>{option.label}</div>
                            {userData.diabetes_history === option.value && (
                              <div className="absolute top-1 right-1">
                                <CheckCircle2 className="h-3 w-3 text-[#C68EFD]" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Alcohol Consumption */}
                    <div className="space-y-3">
                      <label className="flex items-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                        Alcohol Consumption
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: 'none', label: 'None' },
                          { value: 'moderate', label: 'Moderate' },
                          { value: 'heavy', label: 'Heavy' }
                        ].map((option) => (
                          <div
                            key={option.value}
                            className={`group relative overflow-hidden p-3 rounded-xl border-2 cursor-pointer transition-all duration-300 flex items-center justify-center text-center ${userData.alcohol_consumption === option.value
                              ? 'border-[#8F87F1] bg-gradient-to-br from-[#8F87F1]/5 to-[#C68EFD]/5 shadow-sm scale-[1.02]'
                              : 'border-gray-100 hover:border-[#8F87F1]/30 hover:bg-gray-50/50'
                              }`}
                            onClick={() => setUserData({ ...userData, alcohol_consumption: option.value })}
                          >
                            <div className={`text-xs font-bold transition-colors ${userData.alcohol_consumption === option.value ? 'text-[#8F87F1]' : 'text-gray-600 group-hover:text-gray-900'}`}>{option.label}</div>
                            {userData.alcohol_consumption === option.value && (
                              <div className="absolute top-1 right-1">
                                <CheckCircle2 className="h-3 w-3 text-[#8F87F1]" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Activity Level */}
                    <div className="space-y-3">
                      <label className="flex items-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <Heart className="h-3 w-3 mr-2 text-[#8F87F1]" /> Activity Level
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { value: 'sedentary', label: 'Sedentary' },
                          { value: 'active', label: 'Active' },
                          { value: 'athlete', label: 'Athlete' }
                        ].map((option) => (
                          <div
                            key={option.value}
                            className={`group relative overflow-hidden p-3 rounded-xl border-2 cursor-pointer transition-all duration-300 flex items-center justify-center text-center ${userData.activity_level === option.value
                              ? 'border-[#C68EFD] bg-gradient-to-br from-[#8F87F1]/5 to-[#C68EFD]/5 shadow-sm scale-[1.02]'
                              : 'border-gray-100 hover:border-[#C68EFD]/30 hover:bg-gray-50/50'
                              }`}
                            onClick={() => setUserData({ ...userData, activity_level: option.value })}
                          >
                            <div className={`text-xs font-bold transition-colors ${userData.activity_level === option.value ? 'text-[#C68EFD]' : 'text-gray-600 group-hover:text-gray-900'}`}>{option.label}</div>
                            {userData.activity_level === option.value && (
                              <div className="absolute top-1 right-1">
                                <CheckCircle2 className="h-3 w-3 text-[#C68EFD]" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* PAD Status */}
                    <div className="space-y-3">
                      <label className="flex items-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                        <Activity className="h-3 w-3 mr-2 text-[#8F87F1]" /> Peripheral Artery Disease
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'no_pad', label: 'No PAD' },
                          { value: 'pad', label: 'PAD Diagnosed' }
                        ].map((option) => (
                          <div
                            key={option.value}
                            className={`group relative overflow-hidden p-3 rounded-xl border-2 cursor-pointer transition-all duration-300 flex items-center justify-center text-center ${userData.pad_history === option.value
                              ? 'border-[#8F87F1] bg-gradient-to-br from-[#8F87F1]/5 to-[#C68EFD]/5 shadow-sm scale-[1.02]'
                              : 'border-gray-100 hover:border-[#8F87F1]/30 hover:bg-gray-50/50'
                              }`}
                            onClick={() => setUserData({ ...userData, pad_history: option.value })}
                          >
                            <div className={`text-xs font-bold transition-colors ${userData.pad_history === option.value ? 'text-[#8F87F1]' : 'text-gray-600 group-hover:text-gray-900'}`}>{option.label}</div>
                            {userData.pad_history === option.value && (
                              <div className="absolute top-1 right-1">
                                <CheckCircle2 className="h-3 w-3 text-[#8F87F1]" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-12">
                    <button
                      type="submit"
                      disabled={!isFormComplete()}
                      className={`submit-button w-full relative overflow-hidden py-5 px-8 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-300 shadow-2xl ${isFormComplete()
                        ? 'bg-gradient-to-r from-[#8F87F1] to-[#C68EFD] text-white hover:scale-[1.02] hover:shadow-[#8F87F1]/40'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                    >
                      {isFormComplete() ? (
                        <div className="flex items-center justify-center space-x-3">
                          <Activity className="h-5 w-5 animate-pulse" />
                          <span>Initialize Cardiac Simulation</span>
                        </div>
                      ) : (
                        <span>Configuration Incomplete</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* SAFETY TAB */}
              {activeTab === 'safety' && thresholds && (
                <div className="space-y-6">
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                    <h3 className="text-blue-800 font-semibold mb-1 flex items-center">
                      <Shield className="h-4 w-4 mr-2" />
                      Safety Watchdog Active
                    </h3>
                    <p className="text-blue-700 text-sm">
                      The simulation will automatically trigger alerts if your vitals cross these limits.
                      Standard medical thresholds are pre-filled below.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {/* Heart Rate Threshold */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <div className="flex justify-between items-center mb-4">
                        <label className="font-semibold text-gray-800">Max Heart Rate Limit</label>
                        <span className="text-[#8F87F1] font-bold text-lg">{thresholds.heart_rate_high} BPM</span>
                      </div>
                      <input
                        type="range" min="100" max="220"
                        value={thresholds.heart_rate_high}
                        onChange={(e) => handleUpdateThresholds({ ...thresholds, heart_rate_high: parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#8F87F1]"
                      />
                      <p className="text-xs text-gray-500 mt-2 italic">* Safety Note: Automatic cap at "220 - Age" is always active.</p>
                    </div>

                    {/* Blood Pressure Threshold */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <div className="flex justify-between items-center mb-4">
                        <label className="font-semibold text-gray-800">Max Blood Pressure (SBP)</label>
                        <span className="text-[#C68EFD] font-bold text-lg">{thresholds.blood_pressure_high} mmHg</span>
                      </div>
                      <input
                        type="range" min="140" max="250"
                        value={thresholds.blood_pressure_high}
                        onChange={(e) => handleUpdateThresholds({ ...thresholds, blood_pressure_high: parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#C68EFD]"
                      />
                    </div>

                    {/* ST Depression */}
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <div className="flex justify-between items-center mb-4">
                        <label className="font-semibold text-gray-800">Ischemic Sensitivity (ST-Depression)</label>
                        <span className="text-[#E9A5F1] font-bold text-lg">{thresholds.st_depression_high} mm</span>
                      </div>
                      <input
                        type="range" min="0.5" max="5.0" step="0.1"
                        value={thresholds.st_depression_high}
                        onChange={(e) => handleUpdateThresholds({ ...thresholds, st_depression_high: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#E9A5F1]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

          </form>
        </div>
      ) : (
        <div className="flex flex-col h-full space-y-4">
          {/* PERSISTENT HUD: Critical Vitals & Stop */}
          <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-6">
              {/* HR HUD */}
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Dynamics</span>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                  <span className="text-2xl font-black text-gray-800 tabular-nums tracking-tighter">{data.thalach}</span>
                  <span className="text-xs font-bold text-gray-400">BPM</span>
                </div>
              </div>

              <div className="h-8 w-px bg-gray-100 hidden sm:block" />

              {/* BP HUD */}
              <div className="flex flex-col hidden sm:flex">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Pressure</span>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-black text-gray-800 tabular-nums tracking-tighter">{data.trestbps}</span>
                  <span className="text-xs font-bold text-gray-400">mmHg</span>
                </div>
              </div>

              <div className="h-8 w-px bg-gray-100 hidden md:block" />

              {/* Risk HUD */}
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5 text-center">Bio-Risk</span>
                <div className={`px-3 py-1 rounded-full font-black text-sm tracking-widest ${(data.prediction?.probability ?? 0) > 70 ? 'bg-rose-50 text-rose-500' :
                  (data.prediction?.probability ?? 0) > 40 ? 'bg-orange-50 text-orange-500' :
                    'bg-emerald-50 text-emerald-500'
                  }`}>
                  {data.prediction?.probability ?? 0}%
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Stop Button */}
              <button
                onClick={onStopSimulation}
                disabled={isStopping}
                className="bg-gray-900 text-white px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-600 transition-all duration-300 shadow-xl flex items-center"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Stop HUD
              </button>
            </div>
          </div>

          {/* TAB NAVIGATION: Heads-up Display Tabs */}
          <div className="flex overflow-x-auto no-scrollbar space-x-2 p-1 bg-gray-100/50 rounded-2xl self-center">
            {[
              { id: 'monitoring', label: 'Monitor', icon: <Activity className="h-4 w-4" /> },
              { id: 'progress', label: 'Progress', icon: <Zap className="h-4 w-4" /> },
              { id: 'visualizer', label: 'Biometrics', icon: <Heart className="h-4 w-4" /> },
              { id: 'alerts', label: 'Security', icon: <Bell className="h-4 w-4" />, count: alerts.length },
              { id: 'advice', label: 'Snapshot', icon: <Activity className="h-4 w-4" /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSimTab(tab.id as any)}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-200 ${simTab === tab.id
                  ? 'bg-white text-[#8F87F1] shadow-md scale-105'
                  : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="bg-rose-500 text-white px-1.5 py-0.5 rounded-full text-[8px]">{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* ACTIVE TAB CONTENT AREA */}
          <div className="flex-grow pb-8">
            {simTab === 'monitoring' && (
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-[400px]">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#8F87F1]">Real-time Waveform Monitoring</h3>
                </div>
                <div className="h-[300px]">
                  <Line data={chartData} options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: { grid: { color: '#f3f4f6' }, border: { display: false } },
                      x: { grid: { display: false }, border: { display: false } }
                    }
                  }} />
                </div>
              </div>
            )}

            {simTab === 'progress' && (
              <SimulationProgress
                phase={data.phase}
                stage={data.stage}
                stageTime={data.stage_time}
                protocol={data.protocol}
                restDuration={engineConfig.rest_duration_s}
                exerciseDuration={engineConfig.exercise_duration_s}
                recoveryDuration={engineConfig.recovery_duration_s}
                workloadLevel={data.workload_level}
                exerciseStages={exerciseStages}
                totalTime={data.total_time}
                onStop={handleStopSimulation}
              />
            )}

            {simTab === 'visualizer' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-3xl border border-gray-50 flex flex-col items-center">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-8">Structural Assessment</h3>
                  <div className="h-[250px] w-full">
                    <HeartScene heartRate={data.thalach} />
                  </div>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-gray-50">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-8">Bio-Dynamics</h3>
                  <div className="space-y-6">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-tighter text-gray-400 mb-2">ST-Segment Displacement</p>
                      <p className="text-4xl font-black text-gray-800">{data.oldpeak} <span className="text-xs text-gray-400 uppercase">mm</span></p>
                    </div>
                    <div className={`p-4 rounded-2xl ${data.trend === "Worsening" ? "bg-rose-50 text-rose-500" :
                      data.trend === "Improving" ? "bg-emerald-50 text-emerald-500" :
                        "bg-gray-50 text-gray-500"
                      }`}>
                      <p className="text-[8px] font-black uppercase mb-1">Functional Trend</p>
                      <p className="text-sm font-black">{data.trend.toUpperCase()} {data.trend === "Worsening" ? "📈" : data.trend === "Improving" ? "📉" : "➡️"}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {simTab === 'alerts' && (
              <div className="bg-white rounded-3xl border border-gray-100 h-[400px] overflow-hidden flex flex-col shadow-sm">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-rose-500">Security Watchdog Logs</h3>
                  <span className="text-[9px] font-black bg-gray-900 text-white px-2 py-0.5 rounded-full">LIVE</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {alerts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-30">
                      <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-2" />
                      <p className="text-xs font-black uppercase tracking-tight">System Integrity Confirmed</p>
                    </div>
                  ) : (
                    alerts.slice(0, 20).map((alert, idx) => (
                      <div key={idx} className={`p-4 rounded-2xl border transition-all ${alert.severity === 'critical' ? 'bg-rose-50/50 border-rose-100 text-rose-800' : 'bg-orange-50/50 border-orange-100 text-orange-800'
                        }`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-black uppercase tracking-tighter text-[10px]">{alert.alert_type.replace('_', ' ')}</span>
                          <span className="text-[9px] opacity-60 font-bold">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="font-bold text-sm tracking-tight">{alert.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {simTab === 'advice' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {getExerciseRecommendations(data).map((exercise, index) => (
                  <div
                    key={index}
                    className={`p-6 rounded-3xl border transition-all hover:translate-y-[-4px] ${exercise.status === 'recommended' ? 'border-emerald-100 bg-emerald-50/30' :
                      exercise.status === 'caution' ? 'border-orange-100 bg-orange-50/30' :
                        'border-rose-100 bg-rose-50/30'
                      }`}
                  >
                    <h4 className="text-lg font-black text-gray-800 mb-2">{exercise.type}</h4>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-4">
                      {exercise.intensity} • {exercise.duration}
                    </p>
                    <div className="space-y-2">
                      {exercise.benefits.map((benefit: string, i: number) => (
                        <div key={i} className="flex items-start space-x-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5" />
                          <p className="text-xs text-gray-600 font-bold">{benefit}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
