import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, Heart, RefreshCcw, CheckCircle, Clock } from 'lucide-react';

interface ExerciseStage {
  stage_num: number;
  duration: number;
  workload: number;
  target_hr: number;
}

interface SimulationProgressProps {
  phase: string;
  stage: number;
  stageTime: number;
  protocol: string;
  restDuration: number;
  exerciseDuration: number;
  recoveryDuration: number;
  workloadLevel: number;
  exerciseStages?: ExerciseStage[];
  totalTime?: number;
  onStop?: () => void;
}

export const SimulationProgress: React.FC<SimulationProgressProps> = ({
  phase,
  stage,
  stageTime,
  protocol,
  restDuration,
  exerciseDuration,
  recoveryDuration,
  workloadLevel,
  exerciseStages = [],
  totalTime = 0,
  onStop
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

  // Calculate the total duration of all phases (using actual exercise duration if stages provided)
  const actualExerciseDuration = exerciseStages.length > 0
    ? exerciseStages.reduce((sum, s) => sum + s.duration, 0)
    : exerciseDuration;
  const totalDuration = restDuration + actualExerciseDuration + recoveryDuration;

  // Calculate elapsed time in current exercise phase (all stages up to current)
  const getExercisePhaseElapsed = (): number => {
    if (exerciseStages.length === 0) return stageTime;

    let elapsed = 0;
    // Sum duration of all completed stages
    for (let i = 0; i < stage - 1 && i < exerciseStages.length; i++) {
      elapsed += exerciseStages[i].duration;
    }
    // Add time in current stage
    elapsed += stageTime;
    return elapsed;
  };

  // Calculate the elapsed time based on the current phase
  let elapsedTime = 0;
  let currentPhaseElapsed = 0;
  let currentPhaseDuration = 0;

  if (phase === 'rest') {
    currentPhaseElapsed = stageTime;
    currentPhaseDuration = restDuration;
    elapsedTime = stageTime;
  } else if (phase === 'exercise') {
    currentPhaseElapsed = getExercisePhaseElapsed();
    currentPhaseDuration = actualExerciseDuration;
    elapsedTime = restDuration + currentPhaseElapsed;
  } else if (phase === 'recovery') {
    currentPhaseElapsed = stageTime;
    currentPhaseDuration = recoveryDuration;
    elapsedTime = restDuration + actualExerciseDuration + stageTime;
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
      // Exercise phase: use actual exercise duration
      const exerciseElapsed = getExercisePhaseElapsed();
      setCountdownTimer(Math.max(0, actualExerciseDuration - exerciseElapsed));
      setPhaseTimings(prev => ({ ...prev, exercise: exerciseElapsed }));
    } else if (phase === 'recovery') {
      // Recovery phase: timer counts up from 0 to recoveryDuration
      setRecoveryTimer(stageTime);
      setCountdownTimer(Math.max(0, recoveryDuration - stageTime));
      setPhaseTimings(prev => ({ ...prev, recovery: stageTime }));
    }
  }, [phase, stageTime, restDuration, actualExerciseDuration, recoveryDuration, stage, exerciseStages]);

  // Sync pause status periodically
  useEffect(() => {
    const fetchPause = async () => {
      try {
        const res = await axios.get('http://localhost:8000/pause_status');
        setPaused(Boolean(res.data.paused));
      } catch (_) { }
    };
    fetchPause();
    const t = setInterval(fetchPause, 2000);
    return () => clearInterval(t);
  }, []);

  // Toggle pause/resume
  const handleTogglePause = async () => {
    try {
      if (paused) {
        await axios.post('http://localhost:8000/resume_simulation');
        setPaused(false);
      } else {
        await axios.post('http://localhost:8000/pause_simulation');
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
    if (onStop) onStop();
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
  const totalSimulationTime = totalTime > 0 ? totalTime : (phaseTimings.rest + phaseTimings.exercise + phaseTimings.recovery);

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={`${phaseInfo.color} p-1.5 rounded-lg text-white`}>
            {phaseInfo.icon}
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Current Phase</h3>
            <h4 className="text-sm font-black text-gray-800 leading-none">{phaseInfo.title}</h4>
          </div>
        </div>

        <div className="bg-gray-900 text-white px-3 py-1 rounded-lg flex items-center space-x-3 shadow-sm">
          <div className="flex flex-col items-center border-r border-white/10 pr-3">
            <span className="text-[8px] font-black uppercase tracking-tighter opacity-50">Total</span>
            <span className="text-xs font-black tabular-nums">{formatTime(totalSimulationTime)}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[8px] font-black uppercase tracking-tighter opacity-50">Remaining</span>
            <span className="text-xs font-black tabular-nums text-[#8F87F1]">{formatTime(Math.max(0, countdownTimer))}</span>
          </div>
          <button
            onClick={handleTogglePause}
            className={`p-1.5 rounded-md transition-colors ${paused ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
          >
            {paused ? <RefreshCcw className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Progress Bar Group */}
      <div className="space-y-3 mb-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">{phaseInfo.description}</span>
            <span className="text-[10px] font-black text-gray-800 tracking-tighter">{formatTime(currentPhaseElapsed)} / {formatTime(currentPhaseDuration)}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${phaseInfo.color} rounded-full transition-all duration-500 ease-out`}
              style={{ width: `${phaseProgress}%` }}
            ></div>
          </div>
        </div>

        {/* Overall Timeline */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden relative">
          <div className="absolute h-full bg-blue-500/20 left-0 top-0" style={{ width: `${(restDuration / totalDuration) * 100}%` }}></div>
          <div className="absolute h-full bg-emerald-500/20" style={{ left: `${(restDuration / totalDuration) * 100}%`, width: `${(actualExerciseDuration / totalDuration) * 100}%` }}></div>
          <div className="absolute h-full bg-purple-500/20" style={{ left: `${((restDuration + actualExerciseDuration) / totalDuration) * 100}%`, width: `${(recoveryDuration / totalDuration) * 100}%` }}></div>
          <div className="absolute h-full bg-[#8F87F1] opacity-60 left-0 top-0 transition-all duration-500 ease-out shadow-[0_0_8px_rgba(143,135,241,0.5)]" style={{ width: `${totalProgress}%` }}></div>
        </div>
      </div>

      {/* Compact Phase Grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { id: 'rest', label: 'Rest', duration: restDuration, timer: restTimer, icon: <Heart className="h-3 w-3" />, color: 'blue' },
          { id: 'exercise', label: `Stage ${stage}`, duration: actualExerciseDuration, timer: currentPhaseElapsed, icon: <Activity className="h-3 w-3" />, color: 'emerald' },
          { id: 'recovery', label: 'Recovery', duration: recoveryDuration, timer: recoveryTimer, icon: <RefreshCcw className="h-3 w-3" />, color: 'purple' }
        ].map((p) => {
          const isActive = phase === p.id;
          const isDone = completionStatus[p.id as keyof typeof completionStatus] && !isActive;

          return (
            <div key={p.id} className={`p-2 rounded-xl border transition-all ${isActive ? `bg-${p.color}-50 border-${p.color}-200 ring-2 ring-${p.color}-100` :
              isDone ? 'bg-gray-50 border-gray-100 grayscale-[0.8]' : 'bg-white border-gray-50 opacity-40'
              }`}>
              <div className="flex items-center space-x-1.5 mb-1">
                <div className={`text-${isActive ? p.color + '-500' : 'gray-400'}`}>{p.icon}</div>
                <span className={`text-[8px] font-black uppercase tracking-widest ${isActive ? `text-${p.color}-700` : 'text-gray-400'}`}>{p.label}</span>
                {isDone && <CheckCircle className="h-2.5 w-2.5 text-emerald-500 ml-auto" />}
              </div>
              <div className="text-[10px] font-black text-gray-800 tabular-nums">
                {isActive ? formatTime(p.timer) : isDone ? formatTime(p.duration) : "00:00"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Protocol Label */}
      <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Protocol:</span>
          <span className="text-[9px] font-black uppercase tracking-widest text-[#8F87F1]">{protocol.replace('_', ' ')}</span>
        </div>
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