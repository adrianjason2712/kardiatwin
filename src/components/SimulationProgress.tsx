import React from 'react';
import { Activity, Heart, RefreshCcw } from 'lucide-react';

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
        <div className="text-center p-2 rounded-md bg-blue-50">
          <div className="text-xs text-blue-700 font-medium">Rest</div>
          <div className="text-sm font-bold">
            {phase === 'rest' ? 
              `${formatTime(currentPhaseElapsed)} / ${formatTime(restDuration)}` : 
              phase === 'exercise' || phase === 'recovery' ? 
                `${formatTime(restDuration)} / ${formatTime(restDuration)}` : 
                `00:00 / ${formatTime(restDuration)}`
            }
          </div>
        </div>
        <div className="text-center p-2 rounded-md bg-green-50">
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
        </div>
        <div className="text-center p-2 rounded-md bg-purple-50">
          <div className="text-xs text-purple-700 font-medium">Recovery</div>
          <div className="text-sm font-bold">
            {phase === 'recovery' ? 
              `${formatTime(currentPhaseElapsed)} / ${formatTime(recoveryDuration)}` : 
              `00:00 / ${formatTime(recoveryDuration)}`
            }
          </div>
        </div>
      </div>
      
      {/* Protocol Information */}
      <div className="mt-4 text-sm text-gray-600">
        <span className="font-medium">Protocol: </span>
        {protocol === 'standard' ? 'Standard Bruce' : 'Modified Bruce'}
      </div>
    </div>
  );
};