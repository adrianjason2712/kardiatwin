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
    if (exerciseStages.length === 0) return Math.min(stageTime, actualExerciseDuration);

    let elapsed = 0;
    // Sum duration of all completed stages
    for (let i = 0; i < stage - 1 && i < exerciseStages.length; i++) {
      elapsed += exerciseStages[i].duration;
    }
    // Add time in current stage
    elapsed += stageTime;

    // Cap at actualExerciseDuration to prevent overflow during phase transitions
    return Math.min(elapsed, actualExerciseDuration);
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

    // Check if we're back to rest phase or in idle after completing all phases
    const isBackToRestAfterCompletion = (phase === 'rest' || phase === 'idle') &&
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

  // Phase configurations with high-end aesthetics
  const getPhaseConfig = () => {
    switch (phase) {
      case 'rest':
        return {
          icon: <Heart className="h-5 w-5" />,
          title: 'Rest Phase',
          label: 'Rest',
          description: 'Baselining vitals...',
          gradient: 'from-[#8F87F1] to-[#C68EFD]',
          bgLight: 'bg-[#8F87F1]/5',
          border: 'border-[#8F87F1]/20',
          text: 'text-[#8F87F1]',
          glow: 'shadow-[0_0_15px_rgba(143,135,225,0.3)]',
          bar: 'bg-gradient-to-r from-[#8F87F1] to-[#C68EFD]'
        };
      case 'exercise':
        return {
          icon: <Activity className="h-5 w-5" />,
          title: `Exercise - Level ${workloadLevel}`,
          label: `Stage ${stage}`,
          description: `Workload optimized`,
          gradient: 'from-[#10B981] to-[#3B82F6]',
          bgLight: 'bg-[#10B981]/5',
          border: 'border-[#10B981]/20',
          text: 'text-[#10B981]',
          glow: 'shadow-[0_0_15px_rgba(16,185,129,0.3)]',
          bar: 'bg-gradient-to-r from-[#10B981] to-[#3B82F6]'
        };
      case 'recovery':
        return {
          icon: <RefreshCcw className="h-5 w-5" />,
          title: 'Recovery Phase',
          label: 'Recovery',
          description: 'Restoring homeostasis',
          gradient: 'from-[#8B5CF6] to-[#EC4899]',
          bgLight: 'bg-[#8B5CF6]/5',
          border: 'border-[#8B5CF6]/20',
          text: 'text-[#8B5CF6]',
          glow: 'shadow-[0_0_15px_rgba(139,92,246,0.3)]',
          bar: 'bg-gradient-to-r from-[#8B5CF6] to-[#EC4899]'
        };
      default:
        return {
          icon: <Heart className="h-5 w-5" />,
          title: 'Standby',
          label: 'Waiting',
          description: 'Ready to start',
          gradient: 'from-gray-400 to-gray-600',
          bgLight: 'bg-gray-50',
          border: 'border-gray-200',
          text: 'text-gray-500',
          glow: '',
          bar: 'bg-gray-400'
        };
    }
  };

  const config = getPhaseConfig();

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
  const totalSimulationTime = totalTime > 0 ? totalTime : (phaseTimings.rest + phaseTimings.exercise + phaseTimings.recovery);

  return (
    <div className="bg-white/40 backdrop-blur-xl p-5 rounded-[2rem] border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.05)] overflow-hidden relative group">
      {/* Dynamic Background Glow */}
      <div className={`absolute -top-24 -right-24 w-64 h-64 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse bg-gradient-to-br ${config.gradient}`} />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-2xl text-white shadow-lg transition-all duration-700 bg-gradient-to-br ${config.gradient} ${config.glow} transform group-hover:scale-110`}>
              {config.icon}
            </div>
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-0.5">Session Status</h3>
              <div className="flex items-center space-x-2">
                <h4 className="text-xl font-black text-gray-900 tracking-tight leading-none">{config.title}</h4>
                <div className="flex space-x-1">
                  <div className={`w-1 h-1 rounded-full animate-bounce bg-emerald-500`} style={{ animationDelay: '0ms' }} />
                  <div className={`w-1 h-1 rounded-full animate-bounce bg-emerald-500`} style={{ animationDelay: '200ms' }} />
                  <div className={`w-1 h-1 rounded-full animate-bounce bg-emerald-500`} style={{ animationDelay: '400ms' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-900/90 backdrop-blur-md text-white p-1 rounded-2xl flex items-center shadow-2xl border border-white/10">
            <div className="px-4 py-2 flex flex-col items-center border-r border-white/5">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-0.5">Elapsed</span>
              <span className="text-lg font-black tabular-nums leading-none tracking-tighter">{formatTime(totalSimulationTime)}</span>
            </div>
            <div className="px-4 py-2 flex flex-col items-center min-w-[100px]">
              <span className="text-[9px] font-black uppercase tracking-widest text-[#8F87F1] mb-0.5 group-hover:animate-pulse">Remaining</span>
              <span className="text-lg font-black tabular-nums leading-none tracking-tighter text-[#8F87F1]">{formatTime(Math.max(0, countdownTimer))}</span>
            </div>
            <button
              onClick={handleTogglePause}
              className={`ml-1 mr-1 p-2.5 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 ${paused ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              {paused ? <RefreshCcw className="h-4 w-4 animate-spin-slow" /> : <Clock className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* High-Impact Progress Indicators */}
        <div className="space-y-6 mb-8">
          <div>
            <div className="flex justify-between items-end mb-2.5 px-1">
              <div>
                <span className="text-[11px] font-black uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-gray-500 to-gray-400">{config.description}</span>
              </div>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-2xl font-black text-gray-900 tabular-nums tracking-tighter">{formatTime(currentPhaseElapsed)}</span>
                <span className="text-xs font-black text-gray-300 uppercase tracking-tighter">/ {formatTime(currentPhaseDuration)}</span>
              </div>
            </div>

            <div className="h-4 bg-gray-100/50 rounded-full p-1 border border-gray-100 overflow-hidden shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden ${config.bar}`}
                style={{ width: `${phaseProgress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 w-full animate-shimmer" style={{ backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)' }} />
              </div>
            </div>
          </div>

          {/* Master Timeline - Premium Multi-phase Track */}
          <div className="relative pt-4">
            <span className="absolute -top-1 left-0 text-[8px] font-black uppercase tracking-[0.2em] text-gray-400">Master Protocol Timeline</span>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative shadow-inner">
              {/* Phase Zones */}
              <div className="absolute h-full bg-[#8F87F1]/10 border-r border-white/20 left-0" style={{ width: `${(restDuration / totalDuration) * 100}%` }} />
              <div className="absolute h-full bg-emerald-500/10 border-r border-white/20" style={{ left: `${(restDuration / totalDuration) * 100}%`, width: `${(actualExerciseDuration / totalDuration) * 100}%` }} />
              <div className="absolute h-full bg-purple-500/10" style={{ left: `${((restDuration + actualExerciseDuration) / totalDuration) * 100}%`, width: `${(recoveryDuration / totalDuration) * 100}%` }} />

              {/* Active Indicator */}
              <div
                className="absolute h-full bg-gradient-to-r from-[#8F87F1] via-[#C68EFD] to-purple-600 shadow-[0_0_12px_rgba(143,135,241,0.6)] transition-all duration-1000 ease-out z-10"
                style={{ width: `${totalProgress}%` }}
              >
                <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/60 blur-[4px] -skew-x-12 animate-pulse" />
              </div>
            </div>

            {/* Phase Markers */}
            <div className="flex justify-between mt-2 px-1 opacity-60">
              <span className={`text-[8px] font-black uppercase tracking-tighter ${phase === 'rest' ? 'text-[#8F87F1]' : 'text-gray-400'}`}>REST</span>
              <span className={`text-[8px] font-black uppercase tracking-tighter ${phase === 'exercise' ? 'text-emerald-500' : 'text-gray-400'}`}>ACTIVE STRESS</span>
              <span className={`text-[8px] font-black uppercase tracking-tighter ${phase === 'recovery' ? 'text-purple-500' : 'text-gray-400'}`}>COOLDOWN</span>
            </div>
          </div>
        </div>

        {/* Phase Grid - High Contrast UI */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { id: 'rest', label: 'Resting', duration: restDuration, timer: restTimer, icon: <Heart className="h-4 w-4" />, gradient: 'from-[#8F87F1] to-[#C68EFD]', marker: 'bg-[#8F87F1]' },
            { id: 'exercise', label: `LVL ${workloadLevel}`, duration: actualExerciseDuration, timer: currentPhaseElapsed, icon: <Activity className="h-4 w-4" />, gradient: 'from-[#10B981] to-[#3B82F6]', marker: 'bg-emerald-500' },
            { id: 'recovery', label: 'Recovery', duration: recoveryDuration, timer: recoveryTimer, icon: <RefreshCcw className="h-4 w-4" />, gradient: 'from-[#8B5CF6] to-[#EC4899]', marker: 'bg-purple-500' }
          ].map((p) => {
            const isActive = phase === p.id;
            const isDone = completionStatus[p.id as keyof typeof completionStatus] && !isActive;

            return (
              <div key={p.id} className={`group/card p-3 rounded-[1.5rem] border transition-all duration-500 relative overflow-hidden ${isActive ? `bg-white border-gray-200 shadow-xl scale-[1.02] z-20` :
                isDone ? 'bg-gray-50/50 border-gray-100 opacity-80' : 'bg-gray-50/30 border-gray-50 opacity-40'
                }`}>
                {isActive && <div className={`absolute top-0 left-0 w-1.5 h-full ${p.marker} animate-pulse`} />}

                <div className="flex items-center space-x-2 mb-2">
                  <div className={`p-1.5 rounded-lg transition-transform duration-500 ${isActive ? `bg-gradient-to-br ${p.gradient} text-white shadow-md rotate-[10deg]` : 'bg-gray-100 text-gray-400'}`}>
                    {p.icon}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>{p.label}</span>
                  {isDone && <CheckCircle className="h-3 w-3 text-emerald-500 ml-auto" />}
                </div>

                <div className="flex flex-col">
                  <span className={`text-sm font-black tabular-nums tracking-tighter ${isActive ? 'text-gray-900 underline decoration-2 decoration-[#8F87F1]' : 'text-gray-400'}`}>
                    {isActive ? formatTime(p.timer) : isDone ? formatTime(p.duration) : "00:00"}
                  </span>
                  <span className="text-[8px] font-black uppercase text-gray-400 tracking-tighter">Total: {formatTime(p.duration)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info bar */}
        <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Protocol</span>
              <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{protocol.replace('_', ' ')}</span>
            </div>
            {exerciseStages.length > 0 && (
              <div className="flex items-center space-x-2 border-l border-gray-100 pl-4">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Progress</span>
                <span className="text-[10px] font-black text-gray-800 tracking-tighter">{stage} / {exerciseStages.length} Stages</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 bg-rose-50 px-3 py-1 rounded-full cursor-pointer hover:bg-rose-100 transition-colors" onClick={onStop}>
            <Clock className="h-3 w-3 text-rose-500" />
            <span className="text-[9px] font-black uppercase tracking-widest text-rose-600">Sync Active</span>
          </div>
        </div>
      </div>

      {/* STYLES FOR ANIMATIONS */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
      `}} />

      {/* Completion Modal - Enhanced Design */}
      {showCompletionPrompt && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-[100] animate-in fade-in duration-500">
          <div className="bg-white rounded-[3rem] p-10 max-w-lg mx-4 text-center shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-white/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#8F87F1] via-[#10B981] to-[#8B5CF6]" />

            <div className="mb-6 relative h-24 w-24 mx-auto">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
              <div className="relative bg-emerald-500 rounded-full p-4 shadow-lg shadow-emerald-500/40">
                <CheckCircle className="h-16 w-16 text-white" />
              </div>
            </div>

            <h3 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">
              Test Protocol Complete
            </h3>
            <p className="text-gray-500 mb-8 font-medium leading-relaxed">
              Cardiac cycle successfully monitored through all phases. High-fidelity data captured and ready for analysis.
            </p>

            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Rest', val: formatTime(phaseTimings.rest), color: 'text-[#8F87F1]' },
                { label: 'Stress', val: formatTime(phaseTimings.exercise), color: 'text-emerald-500' },
                { label: 'Recovery', val: formatTime(phaseTimings.recovery), color: 'text-purple-500' }
              ].map((item, i) => (
                <div key={i} className="bg-gray-50 p-4 rounded-[1.5rem] border border-gray-100">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">{item.label}</p>
                  <p className={`text-lg font-black tabular-nums ${item.color}`}>{item.val}</p>
                </div>
              ))}
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handleSimulationComplete}
                className="flex-1 bg-gray-900 text-white py-4 px-6 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-gray-800 hover:shadow-2xl transition-all active:scale-95"
              >
                Launch Analysis
              </button>
              <button
                onClick={() => setShowCompletionPrompt(false)}
                className="flex-1 bg-gray-100 text-gray-500 py-4 px-6 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-gray-200 transition-all active:scale-95"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
