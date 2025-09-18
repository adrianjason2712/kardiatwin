import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Heart, RefreshCcw, CheckCircle, AlertCircle, Clock, BarChart3 } from 'lucide-react';

interface SimulationProgressProps {
  phase: string;
  stage: number;
  stageTime: number;
  protocol: string;
  restDuration: number;
  exerciseDuration: number;
  recoveryDuration: number;
  workloadLevel: number;
}

export const SimulationProgress: React.FC<SimulationProgressProps> = ({
  phase,
  stage,
  stageTime,
  protocol,
  restDuration,
  exerciseDuration,
  recoveryDuration,
  workloadLevel
}) => {
  const [showCompletionPrompt, setShowCompletionPrompt] = useState(false);
  const [restTimer, setRestTimer] = useState(0);
  const [recoveryTimer, setRecoveryTimer] = useState(0);
  const [isSimulationComplete, setIsSimulationComplete] = useState(false);
  const [phaseHistory, setPhaseHistory] = useState<string[]>([]);
  const [countdownTimer, setCountdownTimer] = useState(0);
  const [paused, setPaused] = useState(false);
  const [phaseTimings, setPhaseTimings] = useState({
    rest: 0,
    exercise: 0,
    recovery: 0
  });

  // Calculate the total duration of all phases
  const totalDuration = restDuration + exerciseDuration + recoveryDuration;
  
  // Calculate the elapsed time based on the current phase
  let elapsedTime = 0;
  let currentPhaseElapsed = 0;
  let currentPhaseDuration = 0;
  
  if (phase === 'rest') {
    currentPhaseElapsed = stageTime;
    currentPhaseDuration = restDuration;
    elapsedTime = stageTime;
  } else if (phase === 'exercise') {
    currentPhaseElapsed = stageTime;
    currentPhaseDuration = exerciseDuration;
    elapsedTime = restDuration + stageTime;
  } else if (phase === 'recovery') {
    currentPhaseElapsed = stageTime;
    currentPhaseDuration = recoveryDuration;
    elapsedTime = restDuration + exerciseDuration + stageTime;
  }

  // Track phase history to detect completion
  useEffect(() => {
    if (phase && !phaseHistory.includes(phase)) {
      setPhaseHistory(prev => [...prev, phase]);
    }
  }, [phase, phaseHistory]);

  // (debug logs removed)

  // Update timers based on current phase
  useEffect(() => {
    if (phase === 'rest') {
      // Rest phase: timer counts up from 0 to restDuration
      setRestTimer(stageTime);
      setCountdownTimer(Math.max(0, restDuration - stageTime));
      setPhaseTimings(prev => ({ ...prev, rest: stageTime }));
    } else if (phase === 'exercise') {
      // Exercise phase: timer counts up from 0 to exerciseDuration
      setCountdownTimer(Math.max(0, exerciseDuration - stageTime));
      setPhaseTimings(prev => ({ ...prev, exercise: stageTime }));
    } else if (phase === 'recovery') {
      // Recovery phase: timer counts up from 0 to recoveryDuration
      setRecoveryTimer(stageTime);
      setCountdownTimer(Math.max(0, recoveryDuration - stageTime));
      setPhaseTimings(prev => ({ ...prev, recovery: stageTime }));
    }
  }, [phase, stageTime, restDuration, exerciseDuration, recoveryDuration]);

  // Sync pause status periodically
  useEffect(() => {
    const fetchPause = async () => {
      try {
        const res = await axios.get('http://localhost:5000/pause_status');
        setPaused(Boolean(res.data.paused));
      } catch (_) {}
    };
    fetchPause();
    const t = setInterval(fetchPause, 2000);
    return () => clearInterval(t);
  }, []);

  // Toggle pause/resume
  const handleTogglePause = async () => {
    try {
      if (paused) {
        await axios.post('http://localhost:5000/resume_simulation');
        setPaused(false);
      } else {
        await axios.post('http://localhost:5000/pause_simulation');
        setPaused(true);
      }
    } catch (e) {
      // no-op UI toast could be added
    }
  };

  // Check if simulation is complete
  useEffect(() => {
    // Check if we've been through all phases and are back to rest
    const hasCompletedAllPhases = phaseHistory.includes('rest') && 
                                  phaseHistory.includes('exercise') && 
                                  phaseHistory.includes('recovery');
    
    // Check if we're back to rest phase after completing all phases
    const isBackToRestAfterCompletion = phase === 'rest' && 
                                       hasCompletedAllPhases && 
                                       phaseHistory.length >= 3;
    
    // Alternative completion check: if we've spent enough time in recovery
    const hasSpentEnoughTimeInRecovery = phase === 'recovery' && 
                                         stageTime >= recoveryDuration - 1; // Within 1 second of completion
    
    if ((isBackToRestAfterCompletion || hasSpentEnoughTimeInRecovery) && !isSimulationComplete) {
      setIsSimulationComplete(true);
      setShowCompletionPrompt(true);
    }
  }, [phase, stageTime, recoveryDuration, phaseHistory, isSimulationComplete]);

  // Calculate progress percentages
  const totalProgress = Math.min(100, (elapsedTime / totalDuration) * 100);
  const phaseProgress = Math.min(100, (currentPhaseElapsed / currentPhaseDuration) * 100);
  
  // Get phase-specific information
  const getPhaseInfo = () => {
    switch (phase) {
      case 'rest':
        return {
          icon: <Heart className="h-5 w-5 text-blue-500" />,
          title: 'Rest Phase',
          description: 'Establishing baseline measurements',
          color: 'bg-blue-500'
        };
      case 'exercise':
        return {
          icon: <Activity className="h-5 w-5 text-green-500" />,
          title: `Exercise Phase - Stage ${stage}`,
          description: `Workload Level: ${workloadLevel}`,
          color: 'bg-green-500'
        };
      case 'recovery':
        return {
          icon: <RefreshCcw className="h-5 w-5 text-purple-500" />,
          title: 'Recovery Phase',
          description: 'Monitoring post-exercise recovery',
          color: 'bg-purple-500'
        };
      default:
        return {
          icon: <Heart className="h-5 w-5 text-gray-500" />,
          title: 'Waiting',
          description: 'Simulation not started',
          color: 'bg-gray-500'
        };
    }
  };
  
  const phaseInfo = getPhaseInfo();
  
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle simulation completion
  const handleSimulationComplete = () => {
    setShowCompletionPrompt(false);
    // You can add additional logic here like saving results, showing summary, etc.
  };

  // Get completion status for each phase
  const getPhaseCompletionStatus = () => {
    const hasRest = phaseHistory.includes('rest');
    const hasExercise = phaseHistory.includes('exercise');
    const hasRecovery = phaseHistory.includes('recovery');
    
    return {
      rest: hasRest,
      exercise: hasExercise,
      recovery: hasRecovery,
      allComplete: hasRest && hasExercise && hasRecovery
    };
  };

  const completionStatus = getPhaseCompletionStatus();

  // Calculate total simulation time
  const totalSimulationTime = phaseTimings.rest + phaseTimings.exercise + phaseTimings.recovery;

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-100">
      <h3 className="text-xl font-semibold mb-4 gradient-text">Simulation Progress</h3>
      
      {/* Current Phase Information */}
      <div className="flex items-center mb-4">
        <div className="mr-3">
          {phaseInfo.icon}
        </div>
        <div>
          <h4 className="font-medium text-gray-800">{phaseInfo.title}</h4>
          <p className="text-sm text-gray-600">{phaseInfo.description}</p>
        </div>
        <div className="ml-auto">
          <span className="text-sm font-medium">
            {formatTime(currentPhaseElapsed)} / {formatTime(currentPhaseDuration)}
          </span>
        </div>
      </div>

      {/* Current Phase Countdown Timer */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-center space-x-2">
          <Clock className="h-5 w-5 text-gray-600" />
          <span className="text-sm text-gray-600">Time remaining in current phase:</span>
          <span className="text-lg font-bold text-gray-800">
            {formatTime(Math.max(0, countdownTimer))}
          </span>
          <button
            onClick={handleTogglePause}
            className={`ml-4 px-3 py-1 rounded-md text-sm font-medium transition-colors ${paused ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-700 text-white hover:bg-gray-800'}`}
            aria-label={paused ? 'Resume simulation' : 'Pause simulation'}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>
      
      {/* Current Phase Progress Bar */}
      <div className="h-2 bg-gray-200 rounded-full mb-4 overflow-hidden">
        <div 
          className={`h-full ${phaseInfo.color} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${phaseProgress}%` }}
        ></div>
      </div>
      
      {/* Overall Progress */}
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>Rest</span>
        <span>Exercise</span>
        <span>Recovery</span>
      </div>
      
      {/* Overall Progress Bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden relative">
        {/* Rest section */}
        <div 
          className="absolute h-full bg-blue-500 left-0 top-0"
          style={{ width: `${(restDuration / totalDuration) * 100}%` }}
        ></div>
        
        {/* Exercise section */}
        <div 
          className="absolute h-full bg-green-500"
          style={{ 
            left: `${(restDuration / totalDuration) * 100}%`,
            width: `${(exerciseDuration / totalDuration) * 100}%` 
          }}
        ></div>
        
        {/* Recovery section */}
        <div 
          className="absolute h-full bg-purple-500"
          style={{ 
            left: `${((restDuration + exerciseDuration) / totalDuration) * 100}%`,
            width: `${(recoveryDuration / totalDuration) * 100}%` 
          }}
        ></div>
        
        {/* Progress indicator */}
        <div 
          className="absolute h-full bg-white opacity-50 left-0 top-0 transition-all duration-500 ease-out"
          style={{ width: `${totalProgress}%` }}
        ></div>
      </div>
      
      {/* Phase Timers */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className={`text-center p-2 rounded-md transition-all duration-200 ${
          phase === 'rest' ? 'bg-blue-100 border-2 border-blue-300' : 'bg-blue-50'
        }`}>
          <div className="text-xs text-blue-700 font-medium">Rest</div>
          <div className="text-sm font-bold">
            {phase === 'rest' ? 
              `${formatTime(restTimer)} / ${formatTime(restDuration)}` : 
              phase === 'exercise' || phase === 'recovery' ? 
                `${formatTime(restDuration)} / ${formatTime(restDuration)}` : 
                `00:00 / ${formatTime(restDuration)}`
            }
          </div>
          {phase === 'rest' && (
            <div className="text-xs text-blue-600 mt-1 flex items-center justify-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-1"></div>
              ⏱️ Running
            </div>
          )}
          {completionStatus.rest && phase !== 'rest' && (
            <div className="text-xs text-green-600 mt-1">
              ✓ Completed
            </div>
          )}
        </div>
        <div className={`text-center p-2 rounded-md transition-all duration-200 ${
          phase === 'exercise' ? 'bg-green-100 border-2 border-green-300' : 'bg-green-50'
        }`}>
          <div className="text-xs text-green-700 font-medium">Exercise</div>
          <div className="text-sm font-bold">
            {phase === 'exercise' ? 
              `${formatTime(currentPhaseElapsed)} / ${formatTime(exerciseDuration)}` : 
              phase === 'recovery' ? 
                `${formatTime(exerciseDuration)} / ${formatTime(exerciseDuration)}` : 
                phase === 'rest' ? 
                  `00:00 / ${formatTime(exerciseDuration)}` : 
                  `00:00 / ${formatTime(exerciseDuration)}`
            }
          </div>
          {phase === 'exercise' && (
            <div className="text-xs text-green-600 mt-1 flex items-center justify-center">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></div>
              ⏱️ Running
            </div>
          )}
          {completionStatus.exercise && phase !== 'exercise' && (
            <div className="text-xs text-green-600 mt-1">
              ✓ Completed
            </div>
          )}
        </div>
        <div className={`text-center p-2 rounded-md transition-all duration-200 ${
          phase === 'recovery' ? 'bg-purple-100 border-2 border-purple-300' : 'bg-purple-50'
        }`}>
          <div className="text-xs text-purple-700 font-medium">Recovery</div>
          <div className="text-sm font-bold">
            {phase === 'recovery' ? 
              `${formatTime(recoveryTimer)} / ${formatTime(recoveryDuration)}` : 
              `00:00 / ${formatTime(recoveryDuration)}`
            }
          </div>
          {phase === 'recovery' && (
            <div className="text-xs text-purple-600 mt-1 flex items-center justify-center">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse mr-1"></div>
              ⏱️ Running
            </div>
          )}
          {completionStatus.recovery && phase !== 'recovery' && (
            <div className="text-xs text-green-600 mt-1">
              ✓ Completed
            </div>
          )}
        </div>
      </div>

      {/* Debug info removed for production */}
      
      {/* Protocol Information */}
      <div className="mt-4 text-sm text-gray-600">
        <span className="font-medium">Protocol: </span>
        {protocol === 'standard' ? 'Standard Bruce' : 'Modified Bruce'}
      </div>

      {/* Simulation Completion Prompt */}
      {showCompletionPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-lg mx-4 text-center shadow-xl">
            <div className="mb-4">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              Simulation Complete!
            </h3>
            <p className="text-gray-600 mb-6">
              The cardiac stress test simulation has been completed successfully. 
              All phases (Rest, Exercise, and Recovery) have been completed.
            </p>
            
            {/* Detailed Completion Summary */}
            <div className="mb-6 text-left bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-3">Phase Completion Summary:</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Rest Phase:</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-green-600">✓ Completed</span>
                    <span className="text-xs text-gray-500">({formatTime(phaseTimings.rest)})</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Exercise Phase:</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-green-600">✓ Completed</span>
                    <span className="text-xs text-gray-500">({formatTime(phaseTimings.exercise)})</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Recovery Phase:</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-green-600">✓ Completed</span>
                    <span className="text-xs text-gray-500">({formatTime(phaseTimings.recovery)})</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Total Simulation Time:</span>
                    <span className="text-sm font-bold text-gray-800">{formatTime(totalSimulationTime)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleSimulationComplete}
                className="flex-1 bg-gradient-to-r from-[#8F87F1] to-[#C68EFD] text-white py-3 px-4 rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                View Results
              </button>
              <button
                onClick={handleSimulationComplete}
                className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};