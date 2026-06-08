'use client';

import React, { useState, useEffect } from 'react';
import { listSessions, getVideoPlaybackUrl, fetchAnalytics, SessionHistoryEntry } from '../services/api';
import { Clock, FileText, X, ExternalLink } from 'lucide-react';

interface SessionHistoryProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SessionHistory({ isOpen, onClose }: SessionHistoryProps) {
    const [sessions, setSessions] = useState<SessionHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) return;
        setLoading(true);
        listSessions().then(setSessions).finally(() => setLoading(false));
    }, [isOpen]);

    if (!isOpen) return null;

    function formatDate(iso: string) {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function formatDuration(sec: number) {
        if (!sec) return '—';
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}m ${s}s`;
    }

    async function handleDownloadReport(session: SessionHistoryEntry) {
        try {
            const data = await fetchAnalytics(session.sessionId);
            const report = [
                `SESSION REPORT - ${session.personaName || session.persona}`,
                `Date: ${formatDate(session.startTime)}`,
                `Duration: ${formatDuration(session.durationSec)}`,
                '',
                '--- KEY RECOMMENDATIONS ---',
                ...(data.keyRecommendations || []).map((r: any, i: number) => `${i + 1}. ${r.title}: ${r.description}`),
                '',
                '--- PERFORMANCE SUMMARY ---',
                `Overall: ${data.performanceSummary?.overallAssessment || 'N/A'}`,
            ].join('\n');
            const blob = new Blob([report], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `session-report-${session.sessionId.slice(-8)}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            alert('Report not available yet');
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg max-h-[80vh] overflow-hidden rounded-2xl bg-white shadow-xl flex flex-col">
                <div className="flex items-center justify-between border-b px-6 py-4">
                    <h2 className="text-lg font-bold text-gray-900 font-serif italic">Session History</h2>
                    <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-maroon" />
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText size={32} className="mx-auto text-gray-300 mb-3" />
                            <p className="text-sm text-gray-500 font-sans">No sessions yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {sessions.map((session) => (
                                <div key={session.sessionId} className="rounded-xl border border-gray-200 bg-white p-4 hover:border-maroon-200 transition">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 font-sans">{session.personaName || session.persona}</p>
                                            <p className="text-xs text-gray-500 font-sans mt-0.5">{formatDate(session.startTime)}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1 text-xs text-gray-400">
                                                <Clock size={12} />
                                                <span>{formatDuration(session.durationSec)}</span>
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-sans ${session.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                                }`}>{session.status}</span>
                                        </div>
                                    </div>
                                    {session.status === 'completed' && (
                                        <div className="mt-3 flex gap-2">
                                            <button onClick={async () => { const url = await getVideoPlaybackUrl(session.sessionId); if (url) window.open(url, '_blank'); else alert('Recording not available'); }}
                                                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition font-sans">
                                                <ExternalLink size={12} /> View Recording
                                            </button>
                                            <button onClick={() => handleDownloadReport(session)}
                                                className="flex items-center gap-1.5 rounded-lg border border-maroon-200 bg-maroon-50 px-3 py-1.5 text-xs font-medium text-maroon-700 hover:bg-maroon-100 transition font-sans">
                                                <FileText size={12} /> Download Report
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="border-t px-6 py-3">
                    <p className="text-xs text-gray-400 font-sans text-center">Sessions are retained for 14 days</p>
                </div>
            </div>
        </div>
    );
}
