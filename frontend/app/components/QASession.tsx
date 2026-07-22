'use client';

import React, { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import { ArrowLeft, AlertCircle, MessageSquareText, CheckCircle2, ChevronRight } from 'lucide-react';
import { useQASession } from '../hooks/useQASession';
import { QAWebSocketConfig, QATranscriptEntry } from '../services/websocket';
import { QAAnalyticsResponse, PerPersonaQAAnalytics, MultiPersonaQAResult, getAnamSessionToken } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { QA_SESSION_CONFIG, DEFAULT_QA_TIME_LIMIT_SEC, Persona } from '../config/config';
import QACameraView from './qa/QACameraView';
import QAOrbPanel from './qa/QAOrbPanel';
import AnamAvatarPanel from './qa/AnamAvatarPanel';

interface QASessionProps {
  personaId: string;
  personaIds?: string[];  // Multi-persona: list of persona IDs to run sequentially
  personaName: string;
  personaNames?: string[];  // Display names matching personaIds
  personas?: Persona[];  // Full persona objects for multi-persona
  avatarEnabled?: boolean;  // Toggle AI avatar on/off
  sessionId: string;
  userId: string;
  voiceId?: string;
  qaTimeLimitSec?: number;
  onBack: () => void;
  onComplete: (qaPromise: Promise<QAAnalyticsResponse | null>) => void;
  onMultiPersonaComplete?: (result: MultiPersonaQAResult) => void;
  onSkip: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ── Single-persona session (reusable for both single and multi-persona flows) ──

interface SinglePersonaSessionProps {
  personaId: string;
  personaName: string;
  sessionId: string;
  userId: string;
  voiceId?: string;
  qaTimeLimitSec: number;
  previousContext?: string;
  anamPersonaId?: string;  // Anam avatar persona ID
  onBack: () => void;
  onEnd: (analytics: QAAnalyticsResponse | null, transcript: QATranscriptEntry[]) => void;
  onSkip: () => void;
  showBackButton?: boolean;
  panelInfo?: { current: number; total: number };
}

function SinglePersonaSession({
  personaId,
  personaName: initialPersonaName,
  sessionId,
  userId,
  voiceId,
  qaTimeLimitSec,
  previousContext,
  anamPersonaId,
  onBack,
  onEnd,
  onSkip,
  showBackButton = true,
  panelInfo,
}: SinglePersonaSessionProps) {
  const { getIdToken } = useAuth();
  const autoNavigatedRef = useRef(false);
  const wasEverActiveRef = useRef(false);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const [anamSessionToken, setAnamSessionToken] = useState<string | null>(null);

  // Fetch Anam session token if persona has an avatar
  useEffect(() => {
    if (!anamPersonaId) return;
    getAnamSessionToken(anamPersonaId)
      .then(setAnamSessionToken)
      .catch((err) => console.error('[Anam] Failed to get session token:', err));
  }, [anamPersonaId]);

  const dateStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const wsConfig = useMemo<QAWebSocketConfig>(
    () => ({
      personaId,
      sessionId,
      userId,
      dateStr,
      voiceId,
      previousContext,
      qaTimeLimitSec,
      getIdToken,
    }),
    [personaId, sessionId, userId, dateStr, voiceId, previousContext, qaTimeLimitSec, getIdToken],
  );

  const qa = useQASession(wsConfig, getIdToken, qaTimeLimitSec);
  const { endSession } = qa;
  const displayPersonaName = qa.personaName || initialPersonaName;

  // Mute Nova Sonic audio playback when avatar is handling the voice
  useEffect(() => {
    if (anamPersonaId) {
      qa.setMuteAudioPlayback(true);
    }
    return () => { qa.setMuteAudioPlayback(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anamPersonaId]);

  const remaining = Math.max(0, qaTimeLimitSec - qa.timer);
  const isWarning = remaining <= QA_SESSION_CONFIG.WARNING_AT_SEC;
  const isCritical = remaining <= QA_SESSION_CONFIG.FINAL_WARNING_AT_SEC;

  const handleEndSession = useCallback(() => {
    if (autoNavigatedRef.current) return;
    autoNavigatedRef.current = true;
    endSession().then((analytics) => {
      onEnd(analytics, qa.transcriptEntries);
    });
  }, [endSession, onEnd, qa.transcriptEntries]);

  useEffect(() => {
    if (qa.status === 'active') wasEverActiveRef.current = true;
  }, [qa.status]);

  // Auto-start the Nova Sonic QA session when avatar is being used
  useEffect(() => {
    if (anamPersonaId && qa.status === 'idle') {
      qa.startSession();
    }
  }, [anamPersonaId, qa.status, qa.startSession]);

  useEffect(() => {
    if (qa.status === 'ended' && !autoNavigatedRef.current) {
      autoNavigatedRef.current = true;
      if (wasEverActiveRef.current) {
        onEnd(qa.qaAnalytics, qa.transcriptEntries);
      } else {
        onSkip();
      }
    }
  }, [qa.status, qa.qaAnalytics, qa.transcriptEntries, onEnd, onSkip]);

  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = 0;
    }
  }, [qa.transcriptEntries, qa.partialUserText]);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-3 sm:px-6 sm:py-4 2xl:max-w-[1600px] 2xl:py-8">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between 2xl:mb-6">
        <div className="flex items-start gap-4">
          {showBackButton && (
            <button
              onClick={onBack}
              className="group mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 shadow-sm transition-all duration-300 ease-out hover:border-maroon-200 hover:bg-maroon-50 hover:text-maroon-700 hover:shadow-md"
              title="Exit Session"
            >
              <ArrowLeft className="w-5 h-5 transition-transform duration-300 ease-out group-hover:-translate-x-1" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900 font-serif italic sm:text-2xl 2xl:text-4xl">
              Q&A Session
            </h1>
            <p className="mt-1 text-sm text-gray-500 font-sans 2xl:text-xl">
              Presenting to: <span className="text-maroon-700 font-medium">{displayPersonaName}</span>
              {panelInfo && (
                <span className="ml-2 text-gray-400">
                  ({panelInfo.current} of {panelInfo.total})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Timer */}
        <div className="text-right">
          <div
            className={`
              text-2xl font-bold font-mono 2xl:text-4xl transition-colors duration-300
              ${isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-gray-900'}
            `}
          >
            {formatTime(qa.timer)}
          </div>
          <div className="text-xs text-gray-500 font-sans 2xl:text-base">
            {qa.status === 'active' && isWarning
              ? `${formatTime(remaining)} remaining`
              : 'Session Time'}
          </div>
        </div>
      </div>

      {qa.error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-red-600" />
            <p className="text-sm text-red-700 font-sans">{qa.error}</p>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-4 2xl:gap-6">
        {/* Left: Camera */}
        <div className="min-w-0" style={{ flex: '2 1 0%' }}>
          <QACameraView />
        </div>

        {/* Right: Avatar or Orb panel with controls */}
        <div className="min-w-0" style={{ flex: '1 1 0%' }}>
          {anamPersonaId ? (
            <AnamAvatarPanel
              anamPersonaId={anamPersonaId}
              sessionToken={anamSessionToken}
              isActive={qa.status === 'active'}
              isMuted={qa.isMuted}
              onToggleMute={qa.toggleMute}
              onEnd={handleEndSession}
              onAssistantTextRef={qa.onAssistantTextRef}
            />
          ) : (
            <QAOrbPanel
              personaName={displayPersonaName}
              agentState={qa.agentState}
              status={qa.status}
              isMuted={qa.isMuted}
              botAudioTrack={qa.botAudioTrack}
              onStart={qa.startSession}
              onEnd={handleEndSession}
              onToggleMute={qa.toggleMute}
              onSkip={onSkip}
            />
          )}
        </div>
      </div>

      {/* Live Transcript */}
      <div className="mt-4 animate-slide-up 2xl:mt-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-serif text-base font-semibold text-gray-900 2xl:text-xl flex items-center gap-2">
            <MessageSquareText className="w-5 h-5 text-maroon" />
            Live Transcript
          </h4>
          {qa.status === 'active' && (
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-gray-500 font-sans">Listening</span>
            </div>
          )}
        </div>

        <div
          ref={transcriptScrollRef}
          className="max-h-[200px] overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-sm space-y-2.5 2xl:p-5 2xl:max-h-[280px]"
        >
          {qa.transcriptEntries.length === 0 && !qa.partialUserText && (
            <div className="py-6 text-center">
              <MessageSquareText className="mx-auto mb-3 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400 font-sans">
                The conversation will appear here once the Q&A session starts.
              </p>
            </div>
          )}

          {/* Partial user text */}
          {qa.partialUserText && (
            <div className="flex gap-3 items-start opacity-60">
              <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-gray-400 mt-0.5">
                ...
              </span>
              <p className="text-sm text-gray-500 italic leading-relaxed font-sans">
                {qa.partialUserText}
              </p>
            </div>
          )}

          {/* Finalized entries — newest first */}
          {[...qa.transcriptEntries].reverse().map((entry, index) => (
            <div key={index} className="flex gap-3 items-start">
              <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-medium mt-0.5 ${entry.role === 'assistant'
                ? 'bg-maroon/10 text-maroon'
                : 'bg-gray-100 text-gray-500'
                }`}>
                {entry.role === 'assistant' ? displayPersonaName : 'You'}
              </span>
              <p className="text-sm text-gray-800 leading-relaxed font-sans">
                {entry.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Multi-persona transition screen ──

interface TransitionScreenProps {
  completedPersona: string;
  nextPersona: string;
  currentIndex: number;
  totalPersonas: number;
  onContinue: () => void;
  onSkipAll: () => void;
}

function TransitionScreen({ completedPersona, nextPersona, currentIndex, totalPersonas, onContinue, onSkipAll }: TransitionScreenProps) {
  return (
    <div className="mx-auto w-full max-w-[800px] px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 font-serif italic mb-2">
          Session with {completedPersona} Complete
        </h2>
        <p className="text-gray-500 font-sans mb-8">
          {currentIndex} of {totalPersonas} stakeholders done
        </p>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {Array.from({ length: totalPersonas }).map((_, i) => (
            <div
              key={i}
              className={`h-3 w-3 rounded-full transition-colors ${i < currentIndex ? 'bg-green-500' : i === currentIndex ? 'bg-maroon' : 'bg-gray-200'
                }`}
            />
          ))}
        </div>

        <p className="text-lg text-gray-700 font-sans mb-6">
          Next: <span className="font-semibold text-maroon-700">{nextPersona}</span>
        </p>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={onSkipAll}
            className="px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors font-sans"
          >
            Skip Remaining
          </button>
          <button
            onClick={onContinue}
            className="flex items-center gap-2 rounded-full bg-maroon px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-maroon-700 transition-colors font-sans"
          >
            Continue to {nextPersona}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main QASession component (orchestrates single or multi-persona) ──

export default function QASession({
  personaId,
  personaIds,
  personaName,
  personaNames,
  personas,
  avatarEnabled = true,
  sessionId,
  userId,
  voiceId,
  qaTimeLimitSec,
  onBack,
  onComplete,
  onMultiPersonaComplete,
  onSkip,
}: QASessionProps) {
  const durationSec = qaTimeLimitSec ?? DEFAULT_QA_TIME_LIMIT_SEC;

  // Determine if this is a multi-persona session
  const allPersonaIds = useMemo(() => {
    if (personaIds && personaIds.length > 1) return personaIds;
    return [personaId];
  }, [personaId, personaIds]);

  const isMultiPersona = allPersonaIds.length > 1;

  // Multi-persona state
  const [currentPersonaIndex, setCurrentPersonaIndex] = useState(0);
  const [showTransition, setShowTransition] = useState(false);
  const [allTranscripts, setAllTranscripts] = useState<QATranscriptEntry[]>([]);
  const [perPersonaAnalytics, setPerPersonaAnalytics] = useState<PerPersonaQAAnalytics[]>([]);

  // Get persona name for a given index
  const getPersonaName = useCallback((index: number) => {
    if (personaNames && personaNames[index]) return personaNames[index];
    if (personas && personas[index]) return personas[index].name;
    if (index === 0) return personaName;
    return `Stakeholder ${index + 1}`;
  }, [personaName, personaNames, personas]);

  // Get voice ID for a given persona index
  const getVoiceId = useCallback((index: number) => {
    if (personas && personas[index] && personas[index].voiceId) {
      return personas[index].voiceId;
    }
    return voiceId;
  }, [personas, voiceId]);

  // Get Anam persona ID for a given persona index
  const getAnamPersonaId = useCallback((index: number) => {
    if (personas && personas[index] && personas[index].anamPersonaId) {
      return personas[index].anamPersonaId;
    }
    return undefined;
  }, [personas]);

  // Build previous context string from accumulated transcripts
  const previousContext = useMemo(() => {
    if (allTranscripts.length === 0) return undefined;
    return allTranscripts
      .slice(-20)  // Last 20 entries max
      .map(e => `${e.role === 'assistant' ? 'Q' : 'A'}: ${e.text}`)
      .join('\n');
  }, [allTranscripts]);

  // ── Single-persona mode ──
  if (!isMultiPersona) {
    // Get anamPersonaId from personas array (if provided) or undefined
    const singleAnamId = avatarEnabled ? personas?.[0]?.anamPersonaId : undefined;
    return (
      <SinglePersonaSession
        personaId={personaId}
        personaName={personaName}
        sessionId={sessionId}
        userId={userId}
        voiceId={voiceId}
        qaTimeLimitSec={durationSec}
        anamPersonaId={singleAnamId}
        onBack={onBack}
        onEnd={(analytics) => {
          onComplete(Promise.resolve(analytics));
        }}
        onSkip={onSkip}
      />
    );
  }

  // ── Multi-persona mode ──

  // Handle a single persona session completing
  const handlePersonaEnd = (analytics: QAAnalyticsResponse | null, transcript: QATranscriptEntry[]) => {
    setAllTranscripts(prev => [...prev, ...transcript]);

    // Store this persona's analytics
    const thisPersonaAnalytics: PerPersonaQAAnalytics | null = analytics ? {
      personaName: getPersonaName(currentPersonaIndex),
      personaId: allPersonaIds[currentPersonaIndex],
      analytics,
    } : null;

    const updatedAnalytics = thisPersonaAnalytics
      ? [...perPersonaAnalytics, thisPersonaAnalytics]
      : perPersonaAnalytics;
    setPerPersonaAnalytics(updatedAnalytics);

    // If this was the last persona, complete the whole session
    if (currentPersonaIndex >= allPersonaIds.length - 1) {
      const result: MultiPersonaQAResult = {
        perPersona: updatedAnalytics,
        combined: analytics,  // Last persona for backwards compat
      };
      if (onMultiPersonaComplete) {
        onMultiPersonaComplete(result);
      }
      // Also call onComplete with last analytics for backwards compat
      onComplete(Promise.resolve(analytics));
    } else {
      // Show transition screen before next persona
      setShowTransition(true);
    }
  };

  const handleContinueToNext = () => {
    setShowTransition(false);
    setCurrentPersonaIndex(prev => prev + 1);
  };

  const handleSkipAll = () => {
    const result: MultiPersonaQAResult = {
      perPersona: perPersonaAnalytics,
      combined: perPersonaAnalytics.length > 0 ? perPersonaAnalytics[perPersonaAnalytics.length - 1].analytics : null,
    };
    if (onMultiPersonaComplete) {
      onMultiPersonaComplete(result);
    }
    onComplete(Promise.resolve(result.combined));
  };

  // Show transition screen between personas
  if (showTransition) {
    return (
      <TransitionScreen
        completedPersona={getPersonaName(currentPersonaIndex)}
        nextPersona={getPersonaName(currentPersonaIndex + 1)}
        currentIndex={currentPersonaIndex + 1}
        totalPersonas={allPersonaIds.length}
        onContinue={handleContinueToNext}
        onSkipAll={handleSkipAll}
      />
    );
  }

  // Render current persona's session
  return (
    <SinglePersonaSession
      key={`persona-${currentPersonaIndex}-${allPersonaIds[currentPersonaIndex]}`}
      personaId={allPersonaIds[currentPersonaIndex]}
      personaName={getPersonaName(currentPersonaIndex)}
      sessionId={sessionId}
      userId={userId}
      voiceId={getVoiceId(currentPersonaIndex)}
      qaTimeLimitSec={durationSec}
      previousContext={previousContext}
      anamPersonaId={avatarEnabled ? getAnamPersonaId(currentPersonaIndex) : undefined}
      onBack={onBack}
      onEnd={handlePersonaEnd}
      onSkip={onSkip}
      showBackButton={currentPersonaIndex === 0}
      panelInfo={{ current: currentPersonaIndex + 1, total: allPersonaIds.length }}
    />
  );
}
