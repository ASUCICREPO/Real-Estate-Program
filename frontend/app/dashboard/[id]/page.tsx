"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { getAnalytics } from "@/lib/api-client";
import type { SessionAnalytics, PhaseAnalytics } from "@/lib/types";

function ScoreCircle({ score, label }: { score: number; label: string }) {
    const color = score >= 80 ? "text-green-600" : score >= 60 ? "text-yellow-600" : "text-red-600";
    return (
        <div className="text-center">
            <div className={`text-4xl font-bold ${color}`}>{score}</div>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
        </div>
    );
}

function PhaseSection({ title, analytics }: { title: string; analytics: PhaseAnalytics | null }) {
    if (!analytics) {
        return (
            <div className="bg-white rounded-xl border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-400 text-sm">No data available for this phase.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                <ScoreCircle score={analytics.overallScore} label="Overall" />
            </div>

            {/* Summary */}
            {analytics.summary && (
                <p className="text-sm text-gray-600 mb-4">{analytics.summary}</p>
            )}

            {/* Metric Scores */}
            {analytics.metricScores.length > 0 && (
                <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Metrics</h4>
                    <div className="grid grid-cols-2 gap-2">
                        {analytics.metricScores.map((m, i) => (
                            <div key={i} className="p-2 bg-gray-50 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600">{m.name}</span>
                                    <span className={`text-xs font-bold ${m.score >= 80 ? "text-green-600" : m.score >= 60 ? "text-yellow-600" : "text-red-600"}`}>
                                        {m.score}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{m.details}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recommendations */}
            {analytics.recommendations.length > 0 && (
                <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                        {analytics.recommendations.map((rec, i) => (
                            <li key={i} className="text-sm text-gray-600 flex gap-2">
                                <span className="text-[#8C1D40]">•</span>
                                {rec}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default function DashboardPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const sessionId = params.id as string;
    const personaId = searchParams.get("personaId") || "";

    const [analytics, setAnalytics] = useState<SessionAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function load() {
            try {
                const data = await getAnalytics(sessionId, personaId);
                setAnalytics(data);
            } catch (err: any) {
                setError(err.message || "Failed to load analytics");
            } finally {
                setLoading(false);
            }
        }
        if (sessionId && personaId) load();
    }, [sessionId, personaId]);

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                <header className="bg-[#8C1D40] text-white px-6 py-3">
                    <span className="font-bold">Real Estate Presentation Coach</span>
                </header>

                {/* Steps */}
                <div className="bg-white border-b px-6 py-3">
                    <div className="max-w-5xl mx-auto flex items-center gap-2 text-sm">
                        <span className="bg-gray-200 text-gray-600 px-2.5 py-0.5 rounded-full text-xs">1</span>
                        <span className="text-gray-400">Select Persona</span>
                        <span className="text-gray-300 mx-2">→</span>
                        <span className="bg-gray-200 text-gray-600 px-2.5 py-0.5 rounded-full text-xs">2</span>
                        <span className="text-gray-400">Upload Content</span>
                        <span className="text-gray-300 mx-2">→</span>
                        <span className="bg-gray-200 text-gray-600 px-2.5 py-0.5 rounded-full text-xs">3</span>
                        <span className="text-gray-400">Practice & Record</span>
                        <span className="text-gray-300 mx-2">→</span>
                        <span className="bg-gray-200 text-gray-600 px-2.5 py-0.5 rounded-full text-xs">4</span>
                        <span className="text-gray-400">Audience Q&A</span>
                        <span className="text-gray-300 mx-2">→</span>
                        <span className="bg-[#8C1D40] text-white px-2.5 py-0.5 rounded-full text-xs font-medium">5</span>
                        <span className="font-medium text-[#8C1D40]">Review Analytics</span>
                    </div>
                </div>

                <main className="max-w-5xl mx-auto px-6 py-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Session Analytics</h1>
                    {analytics && (
                        <p className="text-gray-500 mb-6">Persona: {analytics.personaName}</p>
                    )}

                    {loading && (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8C1D40]" />
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
                    )}

                    {analytics && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <PhaseSection title="Presentation Analytics" analytics={analytics.presentationAnalytics} />
                            <PhaseSection title="Q&A Analytics" analytics={analytics.qaAnalytics} />
                        </div>
                    )}

                    <div className="mt-8 text-center">
                        <a href="/" className="text-[#8C1D40] font-medium hover:underline">
                            ← Start New Session
                        </a>
                    </div>
                </main>
            </div>
        </ProtectedRoute>
    );
}
