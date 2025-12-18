import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, Activity, Droplets, Zap, Gauge, AlertCircle, CheckCircle2, XCircle, MessageCircle, Menu, X, TrendingDown, BarChart3 } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { HeartScene } from './components/HeartScene';
import PulseChatbot from './components/PulseChatbot';
import { SimulationProgress } from './components/SimulationProgress';
import { SimulationPage } from './pages/SimulationPage';
import { HeartAgeCalculatorPage } from './pages/HeartAgeCalculatorPage';
import { WhatIfCalculatorPage } from './pages/WhatIfCalculatorPage';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

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

interface UserData {
  age: string;
  sex: string;
  cp: string;
  fbs: string;
  restecg: string;
  slope: string;
  protocol: string;  // Add protocol selection
  // Lifestyle & History parameters
  smoking_status?: string;  // "non_smoker" | "smoker" | "ex_smoker"
  diabetes_history?: string;  // "none" | "type_1" | "type_2"
  alcohol_consumption?: string;  // "none" | "moderate" | "heavy"
  activity_level?: string;  // "sedentary" | "active" | "athlete"
}

interface SimulationData {
  thalach: number;    // Heart Rate
  chol: number;       // Cholesterol
  oldpeak: number;    // ST Depression
  trestbps: number;   // Blood Pressure
  exang: number;      // Exercise induced angina
  prediction: string; // Risk prediction
  phase: string;      // rest | exercise | recovery
  workload_level: number; // Current workload level
  protocol: string;   // standard | modified_bruce
  stage: number;      // Current stage number (1-indexed)
  stage_time: number; // Time in current stage (seconds)
  future_predictions: Array<{
    time: string;
    trestbps: number;
    thalach: number;
    oldpeak: number;
    prediction: string;
  }>;
}

interface ExerciseRecommendation {
  type: string;
  intensity: string;
  duration: string;
  benefits: string[];
  warnings: string[];
  status: 'recommended' | 'caution' | 'avoid';
}

function App() {
  const [userData, setUserData] = useState<UserData>({
    age: '',
    sex: '',
    cp: '',
    fbs: '0',
    restecg: '0',
    slope: '1',
    protocol: 'Standard Bruce', // Default to Standard Bruce
    smoking_status: 'non_smoker',
    diabetes_history: 'none',
    alcohol_consumption: 'none',
    activity_level: 'active'
  });

  const [data, setData] = useState<SimulationData>({
    thalach: 0,
    chol: 0,
    oldpeak: 0,
    trestbps: 0,
    exang: 0,
    prediction: 'Waiting...',
    phase: 'rest',
    workload_level: 0,
    protocol: 'standard',
    stage: 0,
    stage_time: 0,
    future_predictions: []
  });

  const [history, setHistory] = useState<SimulationData[]>([]);
  const [simulationStarted, setSimulationStarted] = useState(false);
  const [engineConfig, setEngineConfig] = useState({
    rest_duration_s: 60,
    exercise_duration_s: 180,
    recovery_duration_s: 120,
    max_workload_level: 3,
    protocol: "standard"
  });
  const [exerciseStages, setExerciseStages] = useState<any[]>([]);
  const [exerciseIntensity, setExerciseIntensity] = useState(50);
  const [showMiniPlayer, setShowMiniPlayer] = useState(true);
  const [showChatbot, setShowChatbot] = useState(false);
  const [showWhatIfMode, setShowWhatIfMode] = useState(false);
  const [whatIfResults, setWhatIfResults] = useState<any>(null);
  const [heartAge, setHeartAge] = useState<any>(null);
  const [whatIfChanges, setWhatIfChanges] = useState({
    smoking_status: userData.smoking_status,
    diabetes_history: userData.diabetes_history,
    alcohol_consumption: userData.alcohol_consumption,
    activity_level: userData.activity_level
  });
  const [currentPage, setCurrentPage] = useState<'simulation' | 'heart-age' | 'what-if'>('simulation');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Update default protocol based on age (following medical standards)
  const updateDefaultProtocolByAge = (age: string) => {
    if (age !== '') {
      const ageNum = parseInt(age);
      if (ageNum >= 60) {
        // Older patients (60+) should default to Modified Bruce per medical standards
        setUserData(prev => ({ ...prev, protocol: 'Modified Bruce' }));
      } else {
        // Younger patients default to Standard Bruce
        setUserData(prev => ({ ...prev, protocol: 'Standard Bruce' }));
      }
    }
  };

  // Check if all required parameters are selected
  const isFormComplete = () => {
    return userData.age !== '' && userData.sex !== '' && userData.cp !== '' && userData.protocol !== '';
  };

  const fetchWhatIfAnalysis = async () => {
    try {
      const response = await axios.post("http://localhost:5000/what_if_analysis", whatIfChanges);
      setWhatIfResults(response.data);
    } catch (error) {
      console.error("Error fetching What If analysis:", error);
      alert("Failed to fetch What If analysis");
    }
  };

  const fetchHeartAge = async () => {
    try {
      const response = await axios.get("http://localhost:5000/biological_age");
      setHeartAge(response.data);
    } catch (error) {
      console.error("Error fetching heart age:", error);
    }
  };

  useEffect(() => {
    if (simulationStarted) {
      fetchHeartAge();
    }
  }, [simulationStarted]);

  const evaluateRisk = (data: SimulationData): string => {
    // Define risk thresholds
    const heartRateThreshold = 100 + (exerciseIntensity * 0.7); // Adjust based on exercise intensity
    const bloodPressureThreshold = 140;
    const stDepressionThreshold = 2.0;

    // Count risk factors
    let riskFactors = 0;
    
    // Heart rate risk
    if (data.thalach > heartRateThreshold) {
      riskFactors++;
    }
    
    // Blood pressure risk
    if (data.trestbps > bloodPressureThreshold) {
      riskFactors++;
    }
    
    // ST depression risk
    if (data.oldpeak > stDepressionThreshold) {
      riskFactors++;
    }

    // Determine risk level based on number of risk factors
    if (riskFactors >= 2) {
      return 'High Risk';
    } else if (riskFactors === 1) {
      return 'Medium Risk';
    } else {
      return 'Low Risk';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Map protocol names to backend values
      const protocolMap = {
        "Standard Bruce": "standard",
        "Modified Bruce": "modified_bruce"
      };
      
      const submissionData = {
        ...userData,
        simulation: {
          protocol: protocolMap[userData.protocol as keyof typeof protocolMap] || "standard"
        }
      };
      
      const response = await axios.post("http://localhost:5000/start", submissionData);

      // Store the engine configuration and exercise stages
      if (response.data && response.data.engine_config) {
        setEngineConfig(response.data.engine_config);
      }
      if (response.data && response.data.exercise_stages) {
        setExerciseStages(response.data.exercise_stages);
      }

      setSimulationStarted(true);
    } catch (error) {
      console.error("Error starting simulation:", error);
    }
  };

  useEffect(() => {
    if (!simulationStarted) return;

    const fetchData = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/prediction?intensity=${exerciseIntensity}`);
        const newData = response.data;
        setData(newData);
        setHistory(prev => [...prev.slice(-19), newData]);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, [simulationStarted, exerciseIntensity]);

  const chartData = {
    labels: history.map((_, index) => `${index + 1}s`),
    datasets: [
      {
        label: 'Heart Rate',
        data: history.map(h => h.thalach),
        borderColor: '#8F87F1',
        backgroundColor: '#8F87F122',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Blood Pressure',
        data: history.map(h => h.trestbps),
        borderColor: '#C68EFD',
        backgroundColor: '#C68EFD22',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const getExerciseRecommendations = (data: SimulationData): ExerciseRecommendation[] => {
    // Get chest pain type from user data
    const chestPainType = userData.cp;
    
    // Always return all exercise types with their current status
    return [
      {
        type: 'Brisk Walking',
        intensity: 'Moderate',
        duration: '30-45 minutes',
        benefits: chestPainType === "0" ? [
          'Gradual exertion helps monitor symptoms',
          'Easy to stop if pain occurs',
          'Maintains cardiovascular health'
        ] : chestPainType === "1" ? [
          'Gentle on the heart',
          'Can be done at comfortable pace',
          'Helps maintain fitness level'
        ] : chestPainType === "2" ? [
          'Low impact exercise',
          'Helps with overall fitness',
          'Can be adjusted to comfort level'
        ] : [
          'Maintains heart health',
          'Helps prevent future issues',
          'Builds endurance gradually'
        ],
        warnings: chestPainType === "0" ? [
          'Stop immediately if chest pain occurs',
          'Start with shorter durations',
          'Monitor heart rate closely'
        ] : chestPainType === "1" ? [
          'Be aware of any unusual sensations',
          'Keep emergency medication accessible',
          'Exercise with a partner if possible'
        ] : chestPainType === "2" ? [
          'Focus on proper posture',
          'Avoid sudden movements',
          'Stay within comfort zone'
        ] : [
          'Regular check-ups recommended',
          'Monitor for any new symptoms',
          'Build intensity gradually'
        ],
        status: data.thalach < 180 ? 'recommended' : 'caution'
      },
      {
      type: 'Yoga',
      intensity: 'Low',
      duration: '30-60 minutes',
        benefits: chestPainType === "0" ? [
          'Improves breathing control',
          'Reduces stress and anxiety',
          'Gentle on the heart'
        ] : chestPainType === "1" ? [
          'Helps manage stress',
          'Improves body awareness',
          'Can be modified for comfort'
        ] : chestPainType === "2" ? [
          'Improves flexibility',
          'Reduces muscle tension',
          'Gentle on the body'
        ] : [
          'Maintains overall health',
          'Improves circulation',
          'Reduces stress'
        ],
        warnings: chestPainType === "0" ? [
          'Avoid strenuous poses',
          'Stop if chest pain occurs',
          'Focus on breathing exercises'
        ] : chestPainType === "1" ? [
          'Be cautious with inverted poses',
          'Listen to body signals',
          'Keep emergency medication nearby'
        ] : chestPainType === "2" ? [
          'Avoid poses that strain chest',
          'Focus on gentle movements',
          'Stay within comfort range'
        ] : [
          'Regular monitoring recommended',
          'Build practice gradually',
          'Focus on relaxation'
        ],
      status: 'recommended'
      },
      {
        type: 'Swimming',
        intensity: 'Moderate',
        duration: '30-45 minutes',
        benefits: chestPainType === "0" ? [
          'Low impact on joints',
          'Easy to control intensity',
          'Improves circulation'
        ] : chestPainType === "1" ? [
          'Gentle on the body',
          'Can be done at own pace',
          'Improves lung capacity'
        ] : chestPainType === "2" ? [
          'Full-body workout',
          'Low impact exercise',
          'Improves flexibility'
        ] : [
          'Excellent cardiovascular exercise',
          'Builds endurance',
          'Improves overall fitness'
        ],
        warnings: chestPainType === "0" ? [
          'Stop if chest pain occurs',
          'Start with shorter sessions',
          'Monitor heart rate'
        ] : chestPainType === "1" ? [
          'Be aware of any unusual sensations',
          'Swim with a partner',
          'Keep emergency medication accessible'
        ] : chestPainType === "2" ? [
          'Focus on proper technique',
          'Avoid overexertion',
          'Stay within comfort zone'
        ] : [
          'Regular health checks recommended',
          'Build intensity gradually',
          'Monitor for any symptoms'
        ],
        status: data.thalach < 170 ? 'recommended' : 'caution'
      },
      {
        type: 'Cycling',
        intensity: 'Moderate',
        duration: '30-60 minutes',
        benefits: chestPainType === "0" ? [
          'Controlled intensity',
          'Easy to stop if needed',
          'Improves cardiovascular health'
        ] : chestPainType === "1" ? [
          'Can be done at comfortable pace',
          'Improves circulation',
          'Builds endurance gradually'
        ] : chestPainType === "2" ? [
          'Low impact exercise',
          'Improves leg strength',
          'Can be adjusted to comfort'
        ] : [
          'Excellent for heart health',
          'Builds endurance',
          'Improves overall fitness'
        ],
        warnings: chestPainType === "0" ? [
          'Stop if chest pain occurs',
          'Monitor heart rate closely',
          'Start with shorter rides'
        ] : chestPainType === "1" ? [
          'Be aware of any unusual sensations',
          'Ride with a partner',
          'Keep emergency medication accessible'
        ] : chestPainType === "2" ? [
          'Focus on proper posture',
          'Avoid overexertion',
          'Stay within comfort zone'
        ] : [
          'Regular health monitoring',
          'Build intensity gradually',
          'Watch for any symptoms'
        ],
        status: data.thalach < 170 ? 'recommended' : 'caution'
      },
      {
        type: 'Competitive Sports',
        intensity: 'High',
        duration: 'N/A',
        benefits: chestPainType === "0" ? [
          'Team building',
          'Improves coordination',
          'Social interaction'
        ] : chestPainType === "1" ? [
          'Social engagement',
          'Team participation',
          'Mild physical activity'
        ] : chestPainType === "2" ? [
          'Social benefits',
          'Team interaction',
          'Light physical activity'
        ] : [
          'Social engagement',
          'Team building',
          'Physical activity'
        ],
        warnings: chestPainType === "0" ? [
          'High risk of overexertion',
          'May trigger chest pain',
          'Requires medical clearance'
        ] : chestPainType === "1" ? [
          'High risk of symptoms',
          'Requires medical supervision',
          'Keep emergency medication accessible'
        ] : chestPainType === "2" ? [
          'Risk of injury',
          'May aggravate pain',
          'Requires medical approval'
        ] : [
          'Regular health monitoring required',
          'Medical clearance needed',
          'Monitor for any symptoms'
        ],
        status: data.prediction === 'High Risk' || data.thalach > 170 ? 'avoid' : 'caution'
      }
    ];
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left Sidebar Navigation */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col shadow-sm`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center space-x-2">
              <Heart className="h-5 w-5 text-[#8F87F1]" />
              <span className="font-bold gradient-text text-sm">KardiaTwin</span>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setCurrentPage('simulation')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              currentPage === 'simulation'
                ? 'bg-[#8F87F1] bg-opacity-10 text-[#8F87F1] border border-[#8F87F1]'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Activity className="h-5 w-5 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">Simulation</span>}
          </button>

          <button
            onClick={() => setCurrentPage('heart-age')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              currentPage === 'heart-age'
                ? 'bg-red-50 text-red-600 border border-red-300'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Heart className="h-5 w-5 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">Heart Age</span>}
          </button>

          <button
            onClick={() => setCurrentPage('what-if')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              currentPage === 'what-if'
                ? 'bg-purple-50 text-purple-600 border border-purple-300'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <TrendingDown className="h-5 w-5 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">What If</span>}
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          <button
            onClick={() => setShowChatbot(!showChatbot)}
            className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors ${
              showChatbot ? 'bg-gray-100' : ''
            }`}
            title="Chat Assistant"
          >
            <MessageCircle className="h-5 w-5 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">Chat</span>}
          </button>

          <button
            onClick={() => setShowMiniPlayer(!showMiniPlayer)}
            className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors ${
              showMiniPlayer ? 'bg-gray-100' : ''
            }`}
            title="Vital Signs Widget"
          >
            <Heart className="h-5 w-5 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">Vitals</span>}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Navbar */}
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-8 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold gradient-text">
                {currentPage === 'simulation' && 'Cardiac Stress Test Simulation'}
                {currentPage === 'heart-age' && 'Biological Heart Age Calculator'}
                {currentPage === 'what-if' && 'What If Analysis'}
              </h1>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                {simulationStarted && (
                  <span className="flex items-center space-x-1">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <span>Simulation Active</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <div className="px-8 py-8">
            {currentPage === 'simulation' && (
              <SimulationPage
                userData={userData}
                data={data}
                history={history}
                simulationStarted={simulationStarted}
                isFormComplete={isFormComplete}
                handleSubmit={handleSubmit}
                setUserData={setUserData}
                updateDefaultProtocolByAge={updateDefaultProtocolByAge}
                getExerciseRecommendations={getExerciseRecommendations}
                chartData={chartData}
                engineConfig={engineConfig}
                exerciseStages={exerciseStages}
              />
            )}

            {currentPage === 'heart-age' && (
              <HeartAgeCalculatorPage
                userData={userData}
                data={data}
              />
            )}

            {currentPage === 'what-if' && (
              <WhatIfCalculatorPage
                userData={userData}
                data={data}
                originalWhatIfChanges={whatIfChanges}
              />
            )}
          </div>
        </div>
      </div>

      {/* Original inline simulation form - kept for reference but now in SimulationPage */}
      {false && (
        <div className="bg-white rounded-xl shadow-xl p-6 mb-8">
          {!simulationStarted ? (
            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
                             {/* Form Completion Status */}
               <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                 <div className="flex items-center justify-between">
                   <h3 className="text-lg font-medium text-gray-700">Required Parameters</h3>
                   <div className="flex items-center space-x-2">
                     <span className="text-sm text-gray-600">Completion:</span>
                     <span className={`text-sm font-medium ${
                       isFormComplete() ? 'text-green-600' : 'text-orange-600'
                     }`}>
                       {isFormComplete() ? 'Complete ✓' : 'Incomplete ⚠'}
                     </span>
                   </div>
                 </div>
                 <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                   <div className={`flex items-center space-x-2 text-sm ${
                     userData.age !== '' ? 'text-green-600' : 'text-gray-500'
                   }`}>
                     {userData.age !== '' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                     <span>Age: {userData.age !== '' ? 'Selected' : 'Required'}</span>
                   </div>
                   <div className={`flex items-center space-x-2 text-sm ${
                     userData.sex !== '' ? 'text-green-600' : 'text-gray-500'
                   }`}>
                     {userData.sex !== '' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                     <span>Gender: {userData.sex !== '' ? 'Selected' : 'Required'}</span>
                   </div>
                   <div className={`flex items-center space-x-2 text-sm ${
                     userData.cp !== '' ? 'text-green-600' : 'text-gray-500'
                   }`}>
                     {userData.cp !== '' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                     <span>Chest Pain: {userData.cp !== '' ? 'Selected' : 'Required'}</span>
                   </div>
                   <div className={`flex items-center space-x-2 text-sm ${
                     userData.protocol !== '' ? 'text-green-600' : 'text-gray-500'
                   }`}>
                     {userData.protocol !== '' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                     <span>Protocol: {userData.protocol !== '' ? 'Selected' : 'Required'}</span>
                   </div>
                 </div>
               </div>

               {/* User Input Section */}
               <div className="space-y-8">
                {/* Age Input Section */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">Age Range</h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div 
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                        parseInt(userData.age) >= 18 && parseInt(userData.age) <= 30 ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105' : 'border-gray-200 hover:border-[#8F87F1] hover:bg-[#8F87F1] hover:bg-opacity-5'
                      }`}
                      onClick={() => {
                        setUserData({...userData, age: "25"});
                        updateProtocolBasedOnAge("25");
                      }}
                    >
                      <div className="font-medium text-gray-700 text-center mb-2">18-30</div>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Young Adult
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Lower Risk
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Active Lifestyle
                        </li>
                      </ul>
                    </div>
                    <div 
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                        parseInt(userData.age) >= 31 && parseInt(userData.age) <= 45 ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105' : 'border-gray-200 hover:border-[#8F87F1] hover:bg-[#8F87F1] hover:bg-opacity-5'
                      }`}
                      onClick={() => {
                        setUserData({...userData, age: "38"});
                        updateProtocolBasedOnAge("38");
                      }}
                    >
                      <div className="font-medium text-gray-700 text-center mb-2">31-45</div>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Middle Age
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Moderate Risk
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Career Focus
                        </li>
                      </ul>
                    </div>
                    <div 
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                        parseInt(userData.age) >= 46 && parseInt(userData.age) <= 60 ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105' : 'border-gray-200 hover:border-[#8F87F1] hover:bg-[#8F87F1] hover:bg-opacity-5'
                      }`}
                      onClick={() => {
                        setUserData({...userData, age: "53"});
                        updateProtocolBasedOnAge("53");
                      }}
                    >
                      <div className="font-medium text-gray-700 text-center mb-2">46-60</div>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Senior Adult
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Higher Risk
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Health Focus
                        </li>
                      </ul>
                    </div>
                    <div 
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                        parseInt(userData.age) > 60 ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105' : 'border-gray-200 hover:border-[#8F87F1] hover:bg-[#8F87F1] hover:bg-opacity-5'
                      }`}
                      onClick={() => {
                        setUserData({...userData, age: "65"});
                        updateProtocolBasedOnAge("65");
                      }}
                    >
                      <div className="font-medium text-gray-700 text-center mb-2">60+</div>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Elderly
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Highest Risk
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Regular Checkups
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                {/* Gender Input Section */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">Gender</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div 
                      className={`p-6 rounded-lg border cursor-pointer transition-all duration-200 ${
                        userData.sex === "1" ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105' : 'border-gray-200 hover:border-[#8F87F1] hover:bg-[#8F87F1] hover:bg-opacity-5'
                      }`}
                      onClick={() => setUserData({...userData, sex: "1"})}
                    >
                      <div className="flex items-center justify-center mb-4">
                        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                          <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-gray-700 text-lg mb-2">Male</div>
                        <ul className="text-sm text-gray-600 space-y-1">
                          <li className="flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                            Higher Risk Before 50
                          </li>
                          <li className="flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                            More Common in Men
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div 
                      className={`p-6 rounded-lg border cursor-pointer transition-all duration-200 ${
                        userData.sex === "0" ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105' : 'border-gray-200 hover:border-[#8F87F1] hover:bg-[#8F87F1] hover:bg-opacity-5'
                      }`}
                      onClick={() => setUserData({...userData, sex: "0"})}
                    >
                      <div className="flex items-center justify-center mb-4">
                        <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center">
                          <svg className="w-8 h-8 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-gray-700 text-lg mb-2">Female</div>
                        <ul className="text-sm text-gray-600 space-y-1">
                          <li className="flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                            Higher Risk After 50
                          </li>
                          <li className="flex items-center justify-center">
                            <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                            Different Symptoms
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Chest Pain Type Section */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">Chest Pain Type</h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div 
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                        userData.cp === "0" ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105' : 'border-gray-200 hover:border-[#8F87F1] hover:bg-[#8F87F1] hover:bg-opacity-5'
                      }`}
                      onClick={() => setUserData({...userData, cp: "0"})}
                    >
                      <div className="font-medium text-gray-700 text-center mb-2">Typical Angina</div>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Triggered by exertion
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Relieved by rest
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Pressure/squeezing
                        </li>
                      </ul>
                    </div>
                    <div 
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                        userData.cp === "1" ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105' : 'border-gray-200 hover:border-[#8F87F1] hover:bg-[#8F87F1] hover:bg-opacity-5'
                      }`}
                      onClick={() => setUserData({...userData, cp: "1"})}
                    >
                      <div className="font-medium text-gray-700 text-center mb-2">Atypical Angina</div>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          May occur at rest
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Different sensations
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Common in women
                        </li>
                      </ul>
                    </div>
                    <div 
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                        userData.cp === "2" ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105' : 'border-gray-200 hover:border-[#8F87F1] hover:bg-[#8F87F1] hover:bg-opacity-5'
                      }`}
                      onClick={() => setUserData({...userData, cp: "2"})}
                    >
                      <div className="font-medium text-gray-700 text-center mb-2">Non-Anginal Pain</div>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Not heart-related
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Sharp/stabbing
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Localized pain
                        </li>
                      </ul>
                    </div>
                    <div 
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                        userData.cp === "3" ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105' : 'border-gray-200 hover:border-[#8F87F1] hover:bg-[#8F87F1] hover:bg-opacity-5'
                      }`}
                      onClick={() => setUserData({...userData, cp: "3"})}
                    >
                      <div className="font-medium text-gray-700 text-center mb-2">Asymptomatic</div>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          No chest pain
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          May have other symptoms
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Risk factors present
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Protocol Selection Section */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">Exercise Protocol</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div 
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                        userData.protocol === "Standard Bruce" ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105' : 'border-gray-200 hover:border-[#8F87F1] hover:bg-[#8F87F1] hover:bg-opacity-5'
                      }`}
                      onClick={() => setUserData({...userData, protocol: "Standard Bruce"})}
                    >
                      <div className="font-medium text-gray-700 text-center mb-2">Standard Bruce</div>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Most Common Protocol
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Simple to follow
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Good for beginners
                        </li>
                      </ul>
                    </div>
                    <div 
                      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                        userData.protocol === "Modified Bruce" ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105' : 'border-gray-200 hover:border-[#8F87F1] hover:bg-[#8F87F1] hover:bg-opacity-5'
                      }`}
                      onClick={() => setUserData({...userData, protocol: "Modified Bruce"})}
                    >
                      <div className="font-medium text-gray-700 text-center mb-2">Modified Bruce</div>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          More intense
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Suitable for advanced users
                        </li>
                        <li className="flex items-center">
                          <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                          Requires more equipment
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lifestyle & History Section */}
              <div className="space-y-8 mt-8 pt-8 border-t-2 border-gray-200">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">Lifestyle & Medical History</h2>
                  <p className="text-gray-600 text-sm mb-6">These factors help personalize your simulation experience</p>

                  {/* Smoking Status */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Smoking Status</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { value: 'non_smoker', label: 'Non-Smoker', description: 'Never smoked' },
                        { value: 'ex_smoker', label: 'Ex-Smoker', description: 'Quit smoking' },
                        { value: 'smoker', label: 'Smoker', description: 'Currently smoking' }
                      ].map(option => (
                        <div
                          key={option.value}
                          className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                            userData.smoking_status === option.value
                              ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105'
                              : 'border-gray-200 hover:border-[#8F87F1] hover:bg-[#8F87F1] hover:bg-opacity-5'
                          }`}
                          onClick={() => setUserData({...userData, smoking_status: option.value})}
                        >
                          <div className="font-medium text-gray-700 text-center">{option.label}</div>
                          <div className="text-xs text-gray-600 text-center mt-1">{option.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Diabetes History */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Diabetes History</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { value: 'none', label: 'No Diabetes', description: 'No history' },
                        { value: 'type_2', label: 'Type 2', description: 'Type 2 Diabetes' },
                        { value: 'type_1', label: 'Type 1', description: 'Type 1 Diabetes' }
                      ].map(option => (
                        <div
                          key={option.value}
                          className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                            userData.diabetes_history === option.value
                              ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105'
                              : 'border-gray-200 hover:border-[#8F87F1] hover:bg-[#8F87F1] hover:bg-opacity-5'
                          }`}
                          onClick={() => setUserData({...userData, diabetes_history: option.value})}
                        >
                          <div className="font-medium text-gray-700 text-center">{option.label}</div>
                          <div className="text-xs text-gray-600 text-center mt-1">{option.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Alcohol Consumption */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Alcohol Consumption</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { value: 'none', label: 'No Alcohol', description: 'Rarely or never' },
                        { value: 'moderate', label: 'Moderate', description: '1-2 drinks/day' },
                        { value: 'heavy', label: 'Heavy', description: '3+ drinks/day' }
                      ].map(option => (
                        <div
                          key={option.value}
                          className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                            userData.alcohol_consumption === option.value
                              ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105'
                              : 'border-gray-200 hover:border-[#8F87F1] hover:bg-[#8F87F1] hover:bg-opacity-5'
                          }`}
                          onClick={() => setUserData({...userData, alcohol_consumption: option.value})}
                        >
                          <div className="font-medium text-gray-700 text-center">{option.label}</div>
                          <div className="text-xs text-gray-600 text-center mt-1">{option.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Activity Level */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Typical Activity Level</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { value: 'sedentary', label: 'Sedentary', description: 'Mostly sitting' },
                        { value: 'active', label: 'Active', description: '3-5 days/week exercise' },
                        { value: 'athlete', label: 'Athlete', description: 'Regular intense activity' }
                      ].map(option => (
                        <div
                          key={option.value}
                          className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                            userData.activity_level === option.value
                              ? 'border-[#8F87F1] bg-[#8F87F1] bg-opacity-5 scale-105'
                              : 'border-gray-200 hover:border-[#8F87F1] hover:bg-[#8F87F1] hover:bg-opacity-5'
                          }`}
                          onClick={() => setUserData({...userData, activity_level: option.value})}
                        >
                          <div className="font-medium text-gray-700 text-center">{option.label}</div>
                          <div className="text-xs text-gray-600 text-center mt-1">{option.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

                             <button
                 type="submit"
                 disabled={!isFormComplete()}
                 className={`w-full py-3 px-4 rounded-lg font-medium transition duration-200 shadow-lg ${
                   isFormComplete()
                     ? 'bg-gradient-to-r from-[#8F87F1] to-[#C68EFD] text-white hover:opacity-90'
                     : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                 }`}
               >
                 {isFormComplete() ? 'Start Simulation' : 'Please Select All Required Parameters'}
               </button>
            </form>
          ) : (
            <div>
              {/* This section is now in SimulationPage component */}
            </div>
          )}
        </div>
      )}

      {/* Note: The inline simulation UI below has been moved to SimulationPage component */}

      {/* Mini Player Component */}
      {/* Mini Player Component */}
      {simulationStarted && showMiniPlayer && (
        <div className="fixed top-4 right-4 w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
          {/* Mini Player Header */}
          <div className="bg-gradient-to-r from-[#8F87F1] to-[#C68EFD] p-2 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Heart className="h-4 w-4 text-white" />
              <span className="text-white text-sm font-medium">Vital Signs</span>
            </div>
            <button 
              onClick={() => setShowMiniPlayer(false)}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>

          {/* Vital Signs Grid */}
          <div className="p-2 grid grid-cols-2 gap-2">
            <div className="bg-gray-50 p-2 rounded-lg">
              <div className="flex items-center space-x-1 mb-1">
                <Heart className="h-3 w-3 text-[#8F87F1]" />
                <span className="text-xs font-medium text-gray-700">Heart Rate</span>
              </div>
              <p className="text-lg font-bold text-gray-800">{data.thalach} BPM</p>
            </div>
            
            <div className="bg-gray-50 p-2 rounded-lg">
              <div className="flex items-center space-x-1 mb-1">
                <Droplets className="h-3 w-3 text-[#C68EFD]" />
                <span className="text-xs font-medium text-gray-700">Cholesterol</span>
              </div>
              <p className="text-lg font-bold text-gray-800">{data.chol} mg/dL</p>
            </div>
            
            <div className="bg-gray-50 p-2 rounded-lg">
              <div className="flex items-center space-x-1 mb-1">
                <Zap className="h-3 w-3 text-[#E9A5F1]" />
                <span className="text-xs font-medium text-gray-700">ST Depression</span>
              </div>
              <p className="text-lg font-bold text-gray-800">{data.oldpeak}</p>
            </div>
            
            <div className="bg-gray-50 p-2 rounded-lg">
              <div className="flex items-center space-x-1 mb-1">
                <Activity className="h-3 w-3 text-[#FED2E2]" />
                <span className="text-xs font-medium text-gray-700">Blood Pressure</span>
              </div>
              <p className="text-lg font-bold text-gray-800">{data.trestbps} mmHg</p>
            </div>
          </div>

          {/* User Information */}
          <div className="border-t border-gray-100 p-2">
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Age Range</span>
                <span className="text-xs font-medium text-gray-800">
                  {userData.age === "25" ? "18-30" :
                   userData.age === "38" ? "31-45" :
                   userData.age === "53" ? "46-60" :
                   "60+"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Gender</span>
                <span className="text-xs font-medium text-gray-800">
                  {userData.sex === "1" ? "Male" : "Female"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Chest Pain Type</span>
                <span className="text-xs font-medium text-gray-800">
                  {userData.cp === "0" ? "Typical Angina" :
                   userData.cp === "1" ? "Atypical Angina" :
                   userData.cp === "2" ? "Non-Anginal Pain" :
                   "Asymptomatic"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Exercise Protocol</span>
                <span className="text-xs font-medium text-gray-800">
                  {userData.protocol}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

             {/* Chatbot Component */}
       <PulseChatbot 
         isOpen={showChatbot} 
         onClose={() => setShowChatbot(false)} 
       />

       {/* Floating Chat Button */}
       {!showChatbot && (
         <button
           onClick={() => setShowChatbot(true)}
           className="fixed bottom-4 right-4 w-14 h-14 bg-gradient-to-r from-[#8F87F1] to-[#C68EFD] text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110 z-40 flex items-center justify-center"
         >
           <MessageCircle className="w-6 h-6" />
         </button>
       )}

    </div>
  );
}

export default App;