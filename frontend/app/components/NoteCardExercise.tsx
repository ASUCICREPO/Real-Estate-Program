'use client';

import React, { useState, useEffect, useCallback } from 'react';

// ── Data ────────────────────────────────────────────────────────────

const PROFESSIONALS = [
    'Real Estate Broker',
    'Environmental Consultant',
    'Land Use Attorney',
    'Architect',
    'Civil Engineer',
    'General Contractor',
    'Leasing Agent',
    'Property Manager',
];

// Correct sequence order (index 0 = first in development process)
const CORRECT_SEQUENCE = [
    'Real Estate Broker',
    'Environmental Consultant',
    'Land Use Attorney',
    'Architect',
    'Civil Engineer',
    'General Contractor',
    'Leasing Agent',
    'Property Manager',
];

const TASKS: { task: string; professional: string }[] = [
    { task: 'Find and negotiate property acquisition', professional: 'Real Estate Broker' },
    { task: 'Conduct environmental site assessment', professional: 'Environmental Consultant' },
    { task: 'Secure zoning approvals and entitlements', professional: 'Land Use Attorney' },
    { task: 'Design building and site plans', professional: 'Architect' },
    { task: 'Design infrastructure and utilities', professional: 'Civil Engineer' },
    { task: 'Build and construct the project', professional: 'General Contractor' },
    { task: 'Market and lease retail/office spaces', professional: 'Leasing Agent' },
    { task: 'Manage ongoing operations and maintenance', professional: 'Property Manager' },
];

type ExercisePhase = 'intro' | 'part1' | 'part2' | 'results';

interface NoteCardExerciseProps {
    onExit: () => void;
}

export default function NoteCardExercise({ onExit }: NoteCardExerciseProps) {
    const [phase, setPhase] = useState<ExercisePhase>('intro');
    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes

    // Part 1 state
    const [sequenceSlots, setSequenceSlots] = useState<string[]>([]);
    const [availableProfessionals, setAvailableProfessionals] = useState<string[]>([...PROFESSIONALS].sort(() => Math.random() - 0.5));

    // Part 2 state
    const [taskAssignments, setTaskAssignments] = useState<Record<string, string[]>>({});
    const [availableTasks, setAvailableTasks] = useState<string[]>(TASKS.map(t => t.task).sort(() => Math.random() - 0.5));

    // Results
    const [part1Score, setPart1Score] = useState(0);
    const [part2Score, setPart2Score] = useState(0);

    // Timer
    useEffect(() => {
        if (phase !== 'part1' && phase !== 'part2') return;
        if (timeLeft <= 0) {
            if (phase === 'part1') handlePart1Complete();
            else handlePart2Complete();
            return;
        }
        const interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
        return () => clearInterval(interval);
    }, [phase, timeLeft]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // ── Part 1: Sequence ──────────────────────────────────────────────

    const handleAddToSequence = (professional: string) => {
        setSequenceSlots(prev => [...prev, professional]);
        setAvailableProfessionals(prev => prev.filter(p => p !== professional));
    };

    const handleRemoveFromSequence = (professional: string) => {
        setSequenceSlots(prev => prev.filter(p => p !== professional));
        setAvailableProfessionals(prev => [...prev, professional]);
    };

    const handlePart1Complete = useCallback(() => {
        // Score: count how many are in the correct position
        let correct = 0;
        sequenceSlots.forEach((prof, idx) => {
            if (prof === CORRECT_SEQUENCE[idx]) correct++;
        });
        setPart1Score(Math.round((correct / CORRECT_SEQUENCE.length) * 100));
        setPhase('part2');
        setTimeLeft(300);
        // Initialize task assignment buckets for the sequenced professionals
        const buckets: Record<string, string[]> = {};
        CORRECT_SEQUENCE.forEach(p => { buckets[p] = []; });
        setTaskAssignments(buckets);
    }, [sequenceSlots]);

    // ── Part 2: Assign Tasks ──────────────────────────────────────────

    const handleAssignTask = (task: string, professional: string) => {
        setTaskAssignments(prev => ({
            ...prev,
            [professional]: [...(prev[professional] || []), task],
        }));
        setAvailableTasks(prev => prev.filter(t => t !== task));
    };

    const handleUnassignTask = (task: string, professional: string) => {
        setTaskAssignments(prev => ({
            ...prev,
            [professional]: (prev[professional] || []).filter(t => t !== task),
        }));
        setAvailableTasks(prev => [...prev, task]);
    };

    const handlePart2Complete = useCallback(() => {
        // Score: count correct task-to-professional matches
        let correct = 0;
        Object.entries(taskAssignments).forEach(([professional, tasks]) => {
            tasks.forEach(task => {
                const correctMatch = TASKS.find(t => t.task === task);
                if (correctMatch && correctMatch.professional === professional) correct++;
            });
        });
        setPart2Score(Math.round((correct / TASKS.length) * 100));
        setPhase('results');
    }, [taskAssignments]);

    const handleRestart = () => {
        setPhase('intro');
        setTimeLeft(300);
        setSequenceSlots([]);
        setAvailableProfessionals([...PROFESSIONALS].sort(() => Math.random() - 0.5));
        setTaskAssignments({});
        setAvailableTasks(TASKS.map(t => t.task).sort(() => Math.random() - 0.5));
        setPart1Score(0);
        setPart2Score(0);
    };

    const overallScore = Math.round((part1Score + part2Score) / 2);

    // ── Intro Screen ──────────────────────────────────────────────────

    if (phase === 'intro') {
        return (
            <div className="mx-auto w-full max-w-[800px] px-4 py-6 sm:px-6 sm:py-8 2xl:max-w-[1000px] 2xl:py-16">
                <h1 className="text-2xl font-bold text-maroon-700 font-serif italic sm:text-3xl 2xl:text-4xl">
                    Note Card Exercise
                </h1>

                <h2 className="mt-6 text-lg font-bold text-gray-900 font-sans sm:text-xl 2xl:text-2xl">
                    Real Estate Development Process Game
                </h2>

                {/* Scenario box */}
                <div className="mt-6 rounded-lg border-2 border-yellow-200 bg-yellow-50 p-5 2xl:p-8">
                    <p className="text-sm font-semibold text-maroon-700 font-sans mb-2 2xl:text-base">
                        Scenario - Real Estate Value Web
                    </p>
                    <p className="text-sm text-gray-700 font-sans leading-relaxed 2xl:text-base 2xl:leading-7">
                        You work in the Development Management Division of <strong>Big Cool Vision Developers, LLC (BCVD)</strong>, developing a mixed-use project (residential, office, retail) near a navigable river. Real estate development requires coordinating a complex <strong>value web</strong> of interconnected professionals. Your task: organize the development team and assign responsibilities in the correct sequence.
                    </p>
                </div>

                {/* Parts description */}
                <div className="mt-6 space-y-4 2xl:mt-8">
                    <div>
                        <h3 className="text-base font-bold text-gray-900 font-sans 2xl:text-lg">Part 1: Sequence Professionals (5 minutes)</h3>
                        <p className="mt-1 text-sm text-gray-600 font-sans 2xl:text-base">
                            Arrange the professionals in the order their services will be used during the project, from left to right.
                        </p>
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-gray-900 font-sans 2xl:text-lg">Part 2: Assign Tasks (5 minutes)</h3>
                        <p className="mt-1 text-sm text-gray-600 font-sans 2xl:text-base">
                            Match each task card to the professional who will perform that work.
                        </p>
                    </div>
                </div>

                {/* Buttons */}
                <div className="mt-8 flex items-center gap-4 2xl:mt-12">
                    <button
                        onClick={() => { setPhase('part1'); setTimeLeft(300); }}
                        className="flex-1 rounded-lg bg-maroon-600 py-3.5 text-center text-sm font-semibold text-white shadow-sm transition-all hover:bg-maroon-700 hover:shadow-md font-sans 2xl:py-4 2xl:text-lg"
                    >
                        Start Exercise
                    </button>
                    <button
                        onClick={onExit}
                        className="rounded-lg border border-gray-300 px-6 py-3.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 font-sans 2xl:px-8 2xl:py-4 2xl:text-lg"
                    >
                        Exit
                    </button>
                </div>
            </div>
        );
    }

    // ── Part 1: Sequence Professionals ────────────────────────────────

    if (phase === 'part1') {
        return (
            <div className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-6 sm:py-8 2xl:max-w-[1100px] 2xl:py-12">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between rounded-lg bg-gray-50 p-4 2xl:p-6">
                    <h2 className="text-lg font-bold text-maroon-700 font-serif italic sm:text-xl 2xl:text-2xl">
                        Part 1: Sequence Professionals
                    </h2>
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-gray-600 font-sans 2xl:text-base">
                            ⏱ {formatTime(timeLeft)}
                        </span>
                        <button
                            onClick={handlePart1Complete}
                            disabled={sequenceSlots.length < PROFESSIONALS.length}
                            className="rounded-lg bg-maroon-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-maroon-700 disabled:opacity-40 disabled:cursor-not-allowed font-sans 2xl:px-5 2xl:py-2.5 2xl:text-sm"
                        >
                            Continue to Part 2 →
                        </button>
                    </div>
                </div>

                <p className="mb-4 text-sm text-gray-600 font-sans 2xl:text-base">
                    Drag professionals from the pool below into the sequence area in the order they&apos;ll be used in the development process.
                </p>

                {/* Sequence drop zone */}
                <div className="mb-6 rounded-xl border-2 border-dashed border-maroon-300 bg-maroon-50/30 p-4 2xl:p-6">
                    <p className="mb-3 text-xs font-semibold text-maroon-700 font-sans 2xl:text-sm">
                        Development Sequence (Left to Right)
                    </p>
                    <div className="min-h-[60px] rounded-lg border-2 border-dashed border-gray-200 bg-white p-3 flex flex-wrap gap-2 2xl:min-h-[80px] 2xl:p-4">
                        {sequenceSlots.length === 0 ? (
                            <p className="text-sm text-gray-400 font-sans w-full text-center py-2">Drag professionals here to sequence them</p>
                        ) : (
                            sequenceSlots.map((prof, idx) => (
                                <button
                                    key={prof}
                                    onClick={() => handleRemoveFromSequence(prof)}
                                    className="flex items-center gap-1.5 rounded-lg border border-maroon-200 bg-maroon-50 px-3 py-2 text-sm font-medium text-maroon-800 transition hover:bg-maroon-100 font-sans 2xl:text-base"
                                >
                                    <span className="text-xs text-maroon-500 font-mono">{idx + 1}.</span>
                                    {prof}
                                    <span className="ml-1 text-maroon-400">×</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Available professionals */}
                <div className="rounded-xl border border-gray-200 bg-white p-4 2xl:p-6">
                    <p className="mb-3 text-sm font-semibold text-gray-900 font-sans 2xl:text-base">
                        Available Professionals ({availableProfessionals.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {availableProfessionals.map(prof => (
                            <button
                                key={prof}
                                onClick={() => handleAddToSequence(prof)}
                                className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:border-maroon-300 hover:bg-maroon-50 hover:text-maroon-700 font-sans 2xl:text-base 2xl:px-5 2xl:py-3"
                            >
                                {prof}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ── Part 2: Assign Tasks ──────────────────────────────────────────

    if (phase === 'part2') {
        return (
            <div className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-6 sm:py-8 2xl:max-w-[1100px] 2xl:py-12">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between rounded-lg bg-gray-50 p-4 2xl:p-6">
                    <h2 className="text-lg font-bold text-maroon-700 font-serif italic sm:text-xl 2xl:text-2xl">
                        Part 2: Assign Tasks
                    </h2>
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-gray-600 font-sans 2xl:text-base">
                            ⏱ {formatTime(timeLeft)}
                        </span>
                        <button
                            onClick={handlePart2Complete}
                            disabled={availableTasks.length > 0}
                            className="rounded-lg bg-maroon-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-maroon-700 disabled:opacity-40 disabled:cursor-not-allowed font-sans 2xl:px-5 2xl:py-2.5 2xl:text-sm"
                        >
                            See Results ✨
                        </button>
                    </div>
                </div>

                <p className="mb-4 text-sm text-gray-600 font-sans 2xl:text-base">
                    Drag each task to the professional who will perform that work.
                </p>

                {/* Professional drop zones */}
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:gap-6">
                    {CORRECT_SEQUENCE.map(prof => (
                        <div key={prof} className="rounded-xl border border-gray-200 bg-white p-4 2xl:p-5">
                            <p className="mb-2 text-sm font-semibold text-maroon-700 font-sans 2xl:text-base">{prof}</p>
                            <div className="min-h-[50px] rounded-lg border border-dashed border-gray-200 bg-gray-50 p-2 space-y-1.5">
                                {(taskAssignments[prof] || []).length === 0 ? (
                                    <p className="text-xs text-gray-400 font-sans py-2 text-center">Drop tasks here</p>
                                ) : (
                                    (taskAssignments[prof] || []).map(task => (
                                        <button
                                            key={task}
                                            onClick={() => handleUnassignTask(task, prof)}
                                            className="w-full text-left rounded border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs text-green-800 font-sans hover:bg-green-100 transition 2xl:text-sm"
                                        >
                                            {task} <span className="text-green-400 float-right">×</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Available tasks */}
                <div className="rounded-xl border border-gray-200 bg-yellow-50/50 p-4 2xl:p-6">
                    <p className="mb-3 text-sm font-semibold text-gray-900 font-sans 2xl:text-base">
                        Available Tasks ({availableTasks.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {availableTasks.map(task => (
                            <div key={task} className="group relative">
                                <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs font-medium text-gray-700 font-sans 2xl:text-sm 2xl:px-4 2xl:py-2.5">
                                    {task}
                                    {/* Assign dropdown on click */}
                                    <div className="absolute top-full left-0 mt-1 hidden group-hover:block z-10 w-48 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                                        {CORRECT_SEQUENCE.map(prof => (
                                            <button
                                                key={prof}
                                                onClick={() => handleAssignTask(task, prof)}
                                                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-maroon-50 hover:text-maroon-700 font-sans"
                                            >
                                                {prof}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {availableTasks.length > 0 && (
                        <p className="mt-3 text-xs text-gray-400 font-sans">Hover over a task and click a professional to assign it.</p>
                    )}
                </div>
            </div>
        );
    }

    // ── Results Screen ────────────────────────────────────────────────

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-600';
        if (score >= 50) return 'text-yellow-600';
        return 'text-red-500';
    };

    const getFeedback = (score: number) => {
        if (score >= 80) return '🎉 Excellent work! You have a strong understanding of the real estate development process.';
        if (score >= 50) return '👍 Good effort! Review the areas where you can improve your knowledge of the development process.';
        return '📚 Keep learning! This exercise shows areas where you can improve your knowledge of the development process.';
    };

    return (
        <div className="mx-auto w-full max-w-[600px] px-4 py-6 sm:px-6 sm:py-8 2xl:max-w-[700px] 2xl:py-16">
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center 2xl:p-12">
                {/* Trophy */}
                <div className="mb-4 text-5xl 2xl:text-6xl">🏆</div>

                <h2 className="text-2xl font-bold text-maroon-700 font-serif italic 2xl:text-3xl">
                    Exercise Complete!
                </h2>
                <p className="mt-2 text-sm text-gray-500 font-sans 2xl:text-base">Here&apos;s how you did:</p>

                {/* Overall score */}
                <div className="mt-6 rounded-xl border-2 border-orange-200 bg-orange-50/50 p-6 2xl:p-8">
                    <p className={`text-5xl font-bold ${getScoreColor(overallScore)} 2xl:text-6xl`}>
                        {overallScore}%
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-600 font-sans 2xl:text-base">Overall Score</p>
                </div>

                {/* Part scores */}
                <div className="mt-4 grid grid-cols-2 gap-4 2xl:mt-6">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 2xl:p-6">
                        <p className={`text-2xl font-bold ${getScoreColor(part1Score)} 2xl:text-3xl`}>{part1Score}%</p>
                        <p className="mt-1 text-xs text-gray-500 font-sans 2xl:text-sm">Part 1: Sequencing</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 2xl:p-6">
                        <p className={`text-2xl font-bold ${getScoreColor(part2Score)} 2xl:text-3xl`}>{part2Score}%</p>
                        <p className="mt-1 text-xs text-gray-500 font-sans 2xl:text-sm">Part 2: Task Assignment</p>
                    </div>
                </div>

                {/* Feedback */}
                <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 2xl:p-5">
                    <p className="text-sm text-gray-700 font-sans 2xl:text-base">{getFeedback(overallScore)}</p>
                </div>

                {/* Buttons */}
                <div className="mt-6 flex gap-4 2xl:mt-8">
                    <button
                        onClick={handleRestart}
                        className="flex-1 rounded-lg border-2 border-maroon-200 px-4 py-3 text-sm font-medium text-maroon-700 transition hover:bg-maroon-50 font-sans 2xl:py-4 2xl:text-base"
                    >
                        ↻ Try Again
                    </button>
                    <button
                        onClick={onExit}
                        className="flex-1 rounded-lg bg-green-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-600 font-sans 2xl:py-4 2xl:text-base"
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );
}
