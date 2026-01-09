import React from 'react';
import { CheckCircle2, AlertCircle, Zap, Activity, Heart, Droplets, Gauge } from 'lucide-react';
import { HeartScene } from '../components/HeartScene';
import { SimulationProgress } from '../components/SimulationProgress';
import { Line } from 'react-chartjs-2';

interface SimulationPageProps {
  userData: any;
  data: any;
  history: any[];
  simulationStarted: boolean;
  isFormComplete: () => boolean;
  handleSubmit: (e: React.FormEvent) => void;
  setUserData: (data: any) => void;
  updateDefaultProtocolByAge: (age: string) => void;
  getExerciseRecommendations: (data: any) => any[];
  chartData: any;
  engineConfig: any;
  exerciseStages?: any[];
}

export const SimulationPage: React.FC<SimulationPageProps> = ({
  userData,
  data,
  history,
  simulationStarted,
  isFormComplete,
  handleSubmit,
  setUserData,
  updateDefaultProtocolByAge,
  getExerciseRecommendations,
  chartData,
  engineConfig,
  exerciseStages = []
}) => {
  const [activeTab, setActiveTab] = React.useState<'required' | 'lifestyle'>('required');

  return (
    <div className="flex-grow">
      {!simulationStarted ? (
        <div className="bg-white rounded-xl shadow-xl p-6 mb-8">
          <form
            onSubmit={handleSubmit}
            onKeyPress={(e) => {
              // Prevent form submission on Enter key unless it's the submit button
              if (e.key === 'Enter' && !(e.target as HTMLElement).classList.contains('submit-button')) {
                e.preventDefault();
              }
            }}
            className="max-w-2xl mx-auto space-y-6"
          >
            {/* Form Completion Status & Tab Navigation */}
            <div className="mb-6">
              {/* Completion Status */}
              <div className="p-4 bg-gradient-to-r from-[#8F87F1] to-[#C68EFD] rounded-lg mb-4 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Simulation Setup</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm opacity-90">Status:</span>
                    <span className={`text-sm font-medium ${
                      isFormComplete() ? 'bg-green-500' : 'bg-orange-500'
                    } px-2 py-1 rounded-full`}>
                      {isFormComplete() ? '✓ Complete' : '⚠ Incomplete'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex space-x-2 border-b-2 border-gray-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('required')}
                  className={`px-4 py-3 font-medium transition-all ${
                    activeTab === 'required'
                      ? 'border-b-2 border-[#8F87F1] text-[#8F87F1]'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span>Basic Information</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      userData.age !== '' && userData.sex !== '' && userData.cp !== '' && userData.protocol !== ''
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {[userData.age, userData.sex, userData.cp, userData.protocol].filter(x => x !== '').length}/4
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('lifestyle')}
                  className={`px-4 py-3 font-medium transition-all ${
                    activeTab === 'lifestyle'
                      ? 'border-b-2 border-[#8F87F1] text-[#8F87F1]'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <span>Lifestyle & Medical</span>
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
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
                      max="100"
                      value={userData.age || '50'}
                      onChange={(e) => {
                        setUserData({...userData, age: e.target.value});
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
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                        userData.sex === item.value ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105' : 'border-gray-200 hover:border-[#8F87F1]'
                      }`}
                      onClick={() => setUserData({...userData, sex: item.value})}
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
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                        userData.cp === item.value ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105' : 'border-gray-200 hover:border-[#8F87F1]'
                      }`}
                      onClick={() => setUserData({...userData, cp: item.value})}
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
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                        userData.protocol === item.value ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105' : 'border-gray-200 hover:border-[#8F87F1]'
                      }`}
                      onClick={() => setUserData({...userData, protocol: item.value})}
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
                <>
              {/* Lifestyle Section */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">Lifestyle & Medical History</h2>
                  <p className="text-gray-600 text-sm mb-6">These factors help personalize your simulation</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Smoking Status */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-3 block">Smoking Status</label>
                      <div className="space-y-2">
                        {[
                          { value: 'non_smoker', label: 'Non-Smoker' },
                          { value: 'ex_smoker', label: 'Ex-Smoker' },
                          { value: 'smoker', label: 'Smoker' }
                        ].map((option) => (
                          <div
                            key={option.value}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                              userData.smoking_status === option.value ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5' : 'border-gray-200 hover:border-[#8F87F1]'
                            }`}
                            onClick={() => setUserData({...userData, smoking_status: option.value})}
                          >
                            <div className="text-sm font-medium text-gray-700">{option.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Diabetes History */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-3 block">Diabetes History</label>
                      <div className="space-y-2">
                        {[
                          { value: 'none', label: 'None' },
                          { value: 'type_1', label: 'Type 1' },
                          { value: 'type_2', label: 'Type 2' }
                        ].map((option) => (
                          <div
                            key={option.value}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                              userData.diabetes_history === option.value ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5' : 'border-gray-200 hover:border-[#8F87F1]'
                            }`}
                            onClick={() => setUserData({...userData, diabetes_history: option.value})}
                          >
                            <div className="text-sm font-medium text-gray-700">{option.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Alcohol Consumption */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-3 block">Alcohol Consumption</label>
                      <div className="space-y-2">
                        {[
                          { value: 'none', label: 'None' },
                          { value: 'moderate', label: 'Moderate' },
                          { value: 'heavy', label: 'Heavy' }
                        ].map((option) => (
                          <div
                            key={option.value}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                              userData.alcohol_consumption === option.value ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5' : 'border-gray-200 hover:border-[#8F87F1]'
                            }`}
                            onClick={() => setUserData({...userData, alcohol_consumption: option.value})}
                          >
                            <div className="text-sm font-medium text-gray-700">{option.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Activity Level */}
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-3 block">Activity Level</label>
                      <div className="space-y-2">
                        {[
                          { value: 'sedentary', label: 'Sedentary' },
                          { value: 'active', label: 'Active' },
                          { value: 'athlete', label: 'Athlete' }
                        ].map((option) => (
                          <div
                            key={option.value}
                            className={`p-3 rounded-lg border cursor-pointer transition-all ${
                              userData.activity_level === option.value ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5' : 'border-gray-200 hover:border-[#8F87F1]'
                            }`}
                            onClick={() => setUserData({...userData, activity_level: option.value})}
                          >
                            <div className="text-sm font-medium text-gray-700">{option.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!isFormComplete()}
                className={`submit-button w-full py-3 px-4 rounded-lg font-medium transition duration-200 shadow-lg ${
                  isFormComplete()
                    ? 'bg-gradient-to-r from-[#8F87F1] to-[#C68EFD] text-white hover:opacity-90'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isFormComplete() ? 'Start Simulation' : 'Please Select All Required Parameters'}
              </button>
                </>
              )}
            </div>

          </form>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Simulation Progress */}
          <div className="mb-8">
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
            />
          </div>

          {/* Vital Signs Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-[#8F87F1] to-[#C68EFD] p-6 rounded-lg text-white shadow-lg">
                <div className="flex items-center mb-2">
                  <Heart className="mr-2" />
                  <h3 className="text-lg font-semibold">Heart Rate</h3>
                </div>
                <p className="text-3xl font-bold">{data.thalach} BPM</p>
              </div>

              <div className="bg-gradient-to-br from-[#C68EFD] to-[#E9A5F1] p-6 rounded-lg text-white shadow-lg">
                <div className="flex items-center mb-2">
                  <Droplets className="mr-2" />
                  <h3 className="text-lg font-semibold">Cholesterol</h3>
                </div>
                <p className="text-3xl font-bold">{data.chol} mg/dL</p>
              </div>

              <div className="bg-gradient-to-br from-[#E9A5F1] to-[#FED2E2] p-6 rounded-lg text-white shadow-lg">
                <div className="flex items-center mb-2">
                  <Zap className="mr-2" />
                  <h3 className="text-lg font-semibold">ST Depression</h3>
                </div>
                <p className="text-3xl font-bold">{data.oldpeak}</p>
              </div>

              <div className="bg-gradient-to-br from-[#FED2E2] to-[#8F87F1] p-6 rounded-lg text-white shadow-lg">
                <div className="flex items-center mb-2">
                  <Activity className="mr-2" />
                  <h3 className="text-lg font-semibold">Blood Pressure</h3>
                </div>
                <p className="text-3xl font-bold">{data.trestbps} mmHg</p>
              </div>
            </div>

            {/* Risk Assessment Card - Elegant Design */}
            <div className="bg-gradient-to-br from-[#8F87F1] to-[#C68EFD] p-8 rounded-lg text-white shadow-lg flex flex-col justify-between h-full">
              <div>
                <h3 className="text-lg font-semibold mb-6 opacity-90">Cardiac Risk Assessment</h3>

                {/* Main Risk Display */}
                <div className="mb-8">
                  <p className="text-sm opacity-75 mb-2">Current Status</p>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className={`text-4xl font-bold ${
                        data.prediction?.risk_level === "High Risk" ? 'text-red-300' :
                        data.prediction?.risk_level === "Medium Risk" ? 'text-yellow-200' :
                        'text-green-300'
                      }`}>
                        {data.prediction?.probability ?? 0}%
                      </p>
                      <p className="text-xs opacity-75 mt-1">Risk Score</p>
                    </div>
                    <div className="flex-1">
                      <div className="w-full bg-white bg-opacity-20 rounded-full h-2 mb-3">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            (data.prediction?.probability ?? 0) > 70 ? 'bg-red-400' :
                            (data.prediction?.probability ?? 0) > 40 ? 'bg-yellow-300' :
                            'bg-green-400'
                          }`}
                          style={{width: `${data.prediction?.probability ?? 0}%`}}
                        ></div>
                      </div>
                      <p className={`text-sm font-semibold ${
                        data.prediction?.risk_level === "High Risk" ? 'text-red-300' :
                        data.prediction?.risk_level === "Medium Risk" ? 'text-yellow-200' :
                        'text-green-300'
                      }`}>
                        {data.prediction?.risk_level ?? 'Waiting...'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Trend Indicator */}
                <div className="bg-white bg-opacity-10 rounded-lg p-4 mb-6">
                  <p className="text-xs opacity-75 mb-2">Trend</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {data.trend === "Worsening" && "📈"}
                      {data.trend === "Improving" && "📉"}
                      {data.trend === "Stable" && "➡️"}
                    </span>
                    <p className="text-sm font-semibold">{data.trend}</p>
                  </div>
                </div>
              </div>

              {/* Confidence Badge */}
              <div className="bg-white bg-opacity-15 rounded-lg p-3 text-center">
                <p className="text-xs opacity-75 mb-1">Confidence</p>
                <p className="text-sm font-semibold">{data.prediction?.confidence ?? 'N/A'}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-100">
              <h3 className="text-xl font-semibold mb-4 gradient-text">3D Heart Visualization</h3>
              <HeartScene heartRate={data.thalach} />
            </div>
          </div>

          {/* Real-time Monitoring Chart */}
          <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-100">
            <h3 className="text-xl font-semibold mb-4 gradient-text">Real-time Monitoring</h3>
            <Line data={chartData} options={{
              responsive: true,
              plugins: {
                legend: { position: 'top' as const },
                title: { display: true, text: 'Heart Rate & Blood Pressure Trends', color: '#8F87F1' }
              },
              scales: {
                y: { grid: { color: '#E9A5F122' } },
                x: { grid: { color: '#E9A5F122' } }
              }
            }} />
          </div>


          {/* Exercise Recommendations */}
          <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-100">
            <h3 className="text-xl font-semibold mb-4 gradient-text">Exercise Recommendations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getExerciseRecommendations(data).map((exercise, index) => (
                <div
                  key={index}
                  className={`p-6 rounded-lg border ${
                    exercise.status === 'recommended'
                      ? 'border-green-200 bg-green-50'
                      : exercise.status === 'caution'
                      ? 'border-yellow-200 bg-yellow-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <h4 className="text-lg font-semibold mb-2">{exercise.type}</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    <strong>Intensity:</strong> {exercise.intensity}<br/>
                    <strong>Duration:</strong> {exercise.duration}
                  </p>
                  <div className="space-y-2">
                    {exercise.benefits.map((benefit, i) => (
                      <p key={i} className="text-sm text-gray-600">✓ {benefit}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
