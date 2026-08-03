import React from 'react';
import { Volume2, Mic, Eye, MessageSquare, Pause, TrendingUp } from 'lucide-react';
import { VocalVarietyMetrics } from '@/app/hooks/useVocalVariety';
import { PersonaBestPractices, DEFAULT_BEST_PRACTICES } from '@/app/config/config';
import InfoTooltip from '../InfoTooltip';

interface CompactMetricsBarProps {
    isRecording: boolean;
    isDistracted: boolean;
    metrics: {
        speakingPace: number;
        volumeLevel: number;
        fillerWords: number;
        pauses: number;
    };
    vocalVariety: VocalVarietyMetrics;
    targets?: PersonaBestPractices;
}

// Color helper for monotone score (inverted — high = bad)
function getMonotoneColor(score: number): string {
    if (score >= 70) return 'text-red-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-green-500';
}

function getMonotoneBgColor(score: number): string {
    if (score >= 70) return 'bg-red-50 border-red-200';
    if (score >= 40) return 'bg-yellow-50 border-yellow-200';
    return 'bg-green-50 border-green-200';
}

export default function CompactMetricsBar({
    isRecording,
    isDistracted,
    metrics,
    vocalVariety,
    targets = DEFAULT_BEST_PRACTICES,
}: CompactMetricsBarProps) {
    const wpmMin = targets.wpm?.min ?? DEFAULT_BEST_PRACTICES.wpm.min;
    const wpmMax = targets.wpm?.max ?? DEFAULT_BEST_PRACTICES.wpm.max;
    const eyeMin = targets.eyeContact?.min ?? DEFAULT_BEST_PRACTICES.eyeContact.min;
    const fillerMax = targets.fillerWords?.max ?? DEFAULT_BEST_PRACTICES.fillerWords.max;
    const pausesMin = targets.pauses?.min ?? DEFAULT_BEST_PRACTICES.pauses.min;

    const metricItems = [
        {
            icon: Volume2,
            label: 'Speaking Pace',
            value: isRecording ? `${metrics.speakingPace}` : '--',
            unit: 'wpm',
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
            borderColor: 'border-blue-200',
            tooltip: `Speaking pace (WPM). Target: ${wpmMin}-${wpmMax} wpm`,
        },
        {
            icon: Mic,
            label: 'Volume',
            value: isRecording ? `${metrics.volumeLevel}` : '--',
            unit: '%',
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-200',
            tooltip: 'Microphone input level. Keep it steady.',
        },
        {
            icon: Eye,
            label: 'Eye Contact',
            value: isRecording ? (!isDistracted ? 'Focused' : 'Lost') : '--',
            unit: '',
            color: isRecording && !isDistracted ? 'text-green-600' : 'text-red-600',
            bgColor: isRecording && !isDistracted ? 'bg-green-50' : 'bg-red-50',
            borderColor: isRecording && !isDistracted ? 'border-green-200' : 'border-red-200',
            tooltip: `Eye contact tracking. Target: ≥ ${eyeMin}% of time`,
        },
        {
            icon: MessageSquare,
            label: 'Filler Words',
            value: isRecording ? `${metrics.fillerWords}` : '--',
            unit: '',
            color: 'text-orange-600',
            bgColor: 'bg-orange-50',
            borderColor: 'border-orange-200',
            tooltip: `Filler words count. Target: ≤ ${fillerMax} per 30s`,
        },
        {
            icon: Pause,
            label: 'Pauses',
            value: isRecording ? `${metrics.pauses}` : '--',
            unit: '',
            color: 'text-teal-600',
            bgColor: 'bg-teal-50',
            borderColor: 'border-teal-200',
            tooltip: `Strategic pauses (>3s). Target: ≥ ${pausesMin} per 30s`,
        },
        {
            icon: TrendingUp,
            label: 'Monotone',
            value: isRecording && vocalVariety.monotoneScore > 0 ? `${vocalVariety.monotoneScore}` : '--',
            unit: '%',
            color: isRecording && vocalVariety.monotoneScore > 0 ? getMonotoneColor(vocalVariety.monotoneScore) : 'text-gray-600',
            bgColor: isRecording && vocalVariety.monotoneScore > 0 ? getMonotoneBgColor(vocalVariety.monotoneScore).split(' ')[0] : 'bg-gray-50',
            borderColor: isRecording && vocalVariety.monotoneScore > 0 ? getMonotoneBgColor(vocalVariety.monotoneScore).split(' ')[1] : 'border-gray-200',
            tooltip: 'Vocal variety measure. Lower is better.',
        },
    ];

    return (
        <div className="mb-4 2xl:mb-6">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700 font-sans 2xl:text-base">Delivery Metrics</h3>
                {!isRecording && <span className="text-xs text-gray-400">Waiting to start...</span>}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 2xl:gap-4">
                {metricItems.map((item, index) => (
                    <div
                        key={index}
                        className={`rounded-lg border ${item.borderColor} ${item.bgColor} p-3 2xl:p-4 transition-all ${!isRecording ? 'opacity-60' : 'opacity-100'
                            }`}
                    >
                        <div className="flex items-start justify-between mb-2">
                            <item.icon className={`w-4 h-4 2xl:w-5 2xl:h-5 ${item.color}`} />
                            <InfoTooltip text={item.tooltip} size={12} />
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className={`text-xl 2xl:text-2xl font-bold ${item.color}`}>
                                {item.value}
                            </span>
                            {item.unit && (
                                <span className="text-xs text-gray-500 font-medium">{item.unit}</span>
                            )}
                        </div>
                        <div className="text-[10px] 2xl:text-xs text-gray-600 mt-1 font-medium truncate">
                            {item.label}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
