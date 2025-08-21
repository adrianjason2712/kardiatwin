import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, Activity, Droplets, Zap, Github, Gauge, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { HeartScene } from './components/HeartScene';
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
}

interface SimulationData {
  thalach: number;    // Heart Rate
  chol: number;       // Cholesterol
  oldpeak: number;    // ST Depression
  trestbps: number;   // Blood Pressure
  exang: number;      // Exercise induced angina
  prediction: string; // Risk prediction
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

interface Alert {
  timestamp: string;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  acknowledged: boolean;
}

interface AlertThresholds {
  heart_rate_high: number;
  heart_rate_low: number;
  blood_pressure_high: number;
  blood_pressure_low: number;
  st_depression_high: number;
}

function App() {
  const [userData, setUserData] = useState<UserData>({
    age: '',
    sex: '',
    cp: '',
    fbs: '0',
    restecg: '0',
    slope: '1'
  });

  const [data, setData] = useState<SimulationData>({
    thalach: 0,
    chol: 0,
    oldpeak: 0,
    trestbps: 0,
    exang: 0,
    prediction: 'Waiting...',
    future_predictions: []
  });

  const [history, setHistory] = useState<SimulationData[]>([]);
  const [simulationStarted, setSimulationStarted] = useState(false);
  const [exerciseIntensity, setExerciseIntensity] = useState(50);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [thresholds, setThresholds] = useState<AlertThresholds>({
    heart_rate_high: 170,
    heart_rate_low: 50,
    blood_pressure_high: 140,
    blood_pressure_low: 90,
    st_depression_high: 2.0
  });
  const [showThresholdSettings, setShowThresholdSettings] = useState(false);
  const [showMiniPlayer, setShowMiniPlayer] = useState(true);

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
      await axios.post("http://localhost:5000/start", userData);
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

  useEffect(() => {
    if (!simulationStarted) return;

    const fetchAlerts = async () => {
      try {
        const response = await axios.get("http://localhost:5000/alerts");
        setAlerts(response.data);
      } catch (error) {
        console.error("Error fetching alerts:", error);
      }
    };

    const alertInterval = setInterval(fetchAlerts, 2000);
    return () => clearInterval(alertInterval);
  }, [simulationStarted]);

  const handleAcknowledgeAlert = async (index: number) => {
    try {
      await axios.post(`http://localhost:5000/alerts/${index}/acknowledge`);
      setAlerts(prev => prev.filter((_, i) => i !== index));
    } catch (error) {
      console.error("Error acknowledging alert:", error);
    }
  };

  const handleThresholdChange = async (key: keyof AlertThresholds, value: number) => {
    if (value < 0) {
      alert("Negative values are not allowed");
      return;
    }

    try {
      const newThresholds = { ...thresholds, [key]: value };
      const response = await axios.post("http://localhost:5000/thresholds", newThresholds);
      
      if (response.data.error) {
        alert(response.data.error);
        return;
      }
      
      setThresholds(newThresholds);
    } catch (error) {
      console.error("Error updating thresholds:", error);
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        alert(error.response.data.error);
      } else {
        alert("Failed to update thresholds. Please try again.");
      }
    }
  };

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
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <a 
              href="https://mjonathan.uno" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <Heart className="h-6 w-6 text-[#8F87F1]" />
              <span className="text-xl font-bold gradient-text">Cardio Twin</span>
            </a>
            <div className="flex items-center space-x-4">
              <a 
                href="https://github.com/cyberhunter0304" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-gray-600 hover:text-[#8F87F1] transition-colors"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
        <div className="hero-gradient py-20 text-white">
          <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Real-time Heart Simulation</h1>
            <p className="text-lg md:text-xl mb-8 opacity-90">
            Experience advanced cardiac simulation with our cutting-edge simulation system
            </p>
          </div>
        </div>

      {/* Main Content */}
      <div className="flex-grow container mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-xl p-6 mb-8">
          {!simulationStarted ? (
            <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
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
                      onClick={() => setUserData({...userData, age: "25"})}
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
                      onClick={() => setUserData({...userData, age: "38"})}
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
                      onClick={() => setUserData({...userData, age: "53"})}
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
                      onClick={() => setUserData({...userData, age: "65"})}
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
              </div>
              
              <button
                type="submit"
                className="w-full py-3 px-4 rounded-lg text-white font-medium bg-gradient-to-r from-[#8F87F1] to-[#C68EFD] hover:opacity-90 transition duration-200 shadow-lg"
              >
                Start Simulation
              </button>
            </form>
          ) : (
            <div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="space-y-6">
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

                  <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-xl font-semibold gradient-text">Current Risk Factors</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Real-time vital signs monitoring
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Heart Rate</span>
                            <span className="text-sm font-medium">{data.thalach} BPM</span>
                        </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Blood Pressure</span>
                            <span className="text-sm font-medium">{data.trestbps} mmHg</span>
                      </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">ST Depression</span>
                            <span className="text-sm font-medium">{data.oldpeak}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-100">
                  <h3 className="text-xl font-semibold mb-4 gradient-text">3D Heart Visualization</h3>
                  <HeartScene heartRate={data.thalach} />
                </div>
              </div>
              
              {/* Exercise Recommendations Section */}
              <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-100 mt-8">
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
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          {exercise.type.includes('HIIT') ? (
                            <Zap className="h-5 w-5 text-[#8F87F1]" />
                          ) : exercise.type.includes('Walking') ? (
                            <Activity className="h-5 w-5 text-[#8F87F1]" />
                          ) : exercise.type.includes('Yoga') ? (
                            <Heart className="h-5 w-5 text-[#8F87F1]" />
                          ) : (
                            <Gauge className="h-5 w-5 text-[#8F87F1]" />
                          )}
                        <h4 className="text-lg font-semibold">{exercise.type}</h4>
                        </div>
                        {exercise.status === 'recommended' ? (
                          <CheckCircle2 className="h-6 w-6 text-green-500" />
                        ) : exercise.status === 'caution' ? (
                          <AlertCircle className="h-6 w-6 text-yellow-500" />
                        ) : (
                          <XCircle className="h-6 w-6 text-red-500" />
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <Activity className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="text-sm">Intensity: {exercise.intensity}</span>
                        </div>
                        <div className="flex items-center">
                          <Gauge className="h-4 w-4 mr-2 text-gray-500" />
                          <span className="text-sm">Duration: {exercise.duration}</span>
                        </div>
                        
                        {exercise.benefits.length > 0 && (
                          <div className="mt-4">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Benefits:</h5>
                            <ul className="space-y-1">
                              {exercise.benefits.map((benefit, i) => (
                                <li key={i} className="text-sm text-gray-600 flex items-center">
                                  <CheckCircle2 className="h-3 w-3 mr-2 text-green-500" />
                                  {benefit}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {exercise.warnings.length > 0 && (
                          <div className="mt-4">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Warnings:</h5>
                            <ul className="space-y-1">
                              {exercise.warnings.map((warning, i) => (
                                <li key={i} className="text-sm text-gray-600 flex items-center">
                                  <AlertCircle className="h-3 w-3 mr-2 text-yellow-500" />
                                  {warning}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Future Predictions Panel */}
              <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-100 mt-8">
                <h3 className="text-xl font-semibold mb-4 gradient-text">Future Predictions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {data.future_predictions?.map((prediction, index) => (
                    <div
                      key={index}
                      className={`p-6 rounded-lg border ${
                        prediction.prediction === 'High Risk'
                          ? 'border-red-200 bg-red-50'
                          : 'border-green-200 bg-green-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold">{prediction.time}</h4>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          prediction.prediction === 'High Risk'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {prediction.prediction}
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Heart Rate</span>
                          <span className="font-medium">{prediction.thalach} BPM</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Blood Pressure</span>
                          <span className="font-medium">{prediction.trestbps} mmHg</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">ST Depression</span>
                          <span className="font-medium">{prediction.oldpeak}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alert System Panel */}
              <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-100 mt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold gradient-text">Alert System</h3>
                  <button 
                    onClick={() => setShowThresholdSettings(!showThresholdSettings)}
                    className="px-4 py-2 bg-[#8F87F1] text-white rounded-lg hover:bg-[#C68EFD] transition-colors"
                  >
                    Configure Thresholds
                  </button>
                </div>

                {showThresholdSettings && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-lg font-medium mb-4">Alert Thresholds</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">High Heart Rate (BPM)</label>
                        <input
                          type="number"
                          min="0"
                          value={thresholds.heart_rate_high}
                          onChange={(e) => handleThresholdChange('heart_rate_high', Number(e.target.value))}
                          className="mt-1 block w-full rounded-lg border-gray-200 shadow-sm focus:border-[#8F87F1] focus:ring focus:ring-[#8F87F1] focus:ring-opacity-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Low Heart Rate (BPM)</label>
                        <input
                          type="number"
                          min="0"
                          value={thresholds.heart_rate_low}
                          onChange={(e) => handleThresholdChange('heart_rate_low', Number(e.target.value))}
                          className="mt-1 block w-full rounded-lg border-gray-200 shadow-sm focus:border-[#8F87F1] focus:ring focus:ring-[#8F87F1] focus:ring-opacity-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">High Blood Pressure (mmHg)</label>
                        <input
                          type="number"
                          min="0"
                          value={thresholds.blood_pressure_high}
                          onChange={(e) => handleThresholdChange('blood_pressure_high', Number(e.target.value))}
                          className="mt-1 block w-full rounded-lg border-gray-200 shadow-sm focus:border-[#8F87F1] focus:ring focus:ring-[#8F87F1] focus:ring-opacity-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Low Blood Pressure (mmHg)</label>
                        <input
                          type="number"
                          min="0"
                          value={thresholds.blood_pressure_low}
                          onChange={(e) => handleThresholdChange('blood_pressure_low', Number(e.target.value))}
                          className="mt-1 block w-full rounded-lg border-gray-200 shadow-sm focus:border-[#8F87F1] focus:ring focus:ring-[#8F87F1] focus:ring-opacity-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">High ST Depression</label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={thresholds.st_depression_high}
                          onChange={(e) => handleThresholdChange('st_depression_high', Number(e.target.value))}
                          className="mt-1 block w-full rounded-lg border-gray-200 shadow-sm focus:border-[#8F87F1] focus:ring focus:ring-[#8F87F1] focus:ring-opacity-50"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {alerts.map((alert, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${
                        alert.severity === 'critical' ? 'border-red-500 bg-red-50' :
                        alert.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                        alert.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                        'border-blue-500 bg-blue-50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center space-x-2">
                            <AlertCircle className={`h-5 w-5 ${
                              alert.severity === 'critical' ? 'text-red-500' :
                              alert.severity === 'high' ? 'text-orange-500' :
                              alert.severity === 'medium' ? 'text-yellow-500' :
                              'text-blue-500'
                            }`} />
                            <span className="font-medium">{alert.message}</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{alert.timestamp}</p>
                        </div>
                        <button
                          onClick={() => handleAcknowledgeAlert(index)}
                          className="px-3 py-1 text-sm bg-white rounded-lg border border-gray-200 hover:bg-gray-50"
                        >
                          Acknowledge
                        </button>
                      </div>
                    </div>
                  ))}
                  {alerts.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No active alerts
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-100">
                <h3 className="text-xl font-semibold mb-4 gradient-text">Real-time Monitoring</h3>
                <Line data={chartData} options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: 'top' as const,
                    },
                    title: {
                      display: true,
                      text: 'Heart Rate & Blood Pressure Trends',
                      color: '#8F87F1'
                    }
                  },
                  scales: {
                    y: {
                      grid: {
                        color: '#E9A5F122',
                      }
                    },
                    x: {
                      grid: {
                        color: '#E9A5F122',
                      }
                    }
                  }
                }} />
              </div>
            </div>
          )}
        </div>
      </div>

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
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-6">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-600">
            Made with 💜 by{' '}
            <a 
              href="https://mjonathan.uno" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-[#8F87F1] hover:text-[#C68EFD] transition-colors font-medium"
            >
              Jonathan
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;