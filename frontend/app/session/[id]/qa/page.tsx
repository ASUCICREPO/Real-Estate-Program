"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuthContext } from "@/components/auth/AuthProvider";
import SessionTimer from "@/components/recorder/SessionTimer";
import MetricIndicator from "@/components/recorder/MetricIndicator";

interface TranscriptEntry {
    role: "user" | "assistant";
    text: string;
    isPartial?: boolean;
}

export default function QAPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user } = useAuthContext();

    const sessionId = params.id as string;
    const personaId = searchParams.get("personaId") || "";

    const [status, setStatus] = useState<"idle" | "active" | "ended">("idle");
    const [elapsedTime, setElapsedTime] = useState(0);
    const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
    const [isAISpeaking, setIsAISpeaking] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    // Metrics during Q&A
    const [metrics, setMetrics] = useState({
        wpm: 0,
        eyeContact: 0,
        volume: 0,
        fillerWords: 0,
        pauses: 0,
    });

    // Timer
    useEffect(() => {
        if (status !== "active") return;
        const interval = setInterval(() => setElapsedTime((t) => t + 1), 1000);
        return () => clearInterval(interval);
    }, [status]);

    // Auto-scroll transcript
    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [transcript]);

    async function startQA() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setMediaStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setStatus("active");
            // TODO: Connect to AgentCore WebSocket here
        } catch (err) {
            console.error("Failed to access camera/mic:", err);
        }
    }

    function endQA() {
        if (mediaStream) {
            mediaStream.getTracks().forEach((t) => t.stop());
            setMediaStream(null);
        }
        setStatus("ended");
        router.push(`/dashboard/${sessionId}?personaId=${personaId}`);
    }

    function skipQA() {
        router.push(`/dashboard/${sessionId}?personaId=${personaId}`);
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <header className="bg-[#8C1D40] text-white px-6 py-3 flex items-center justify-between">
                    <span className="font-bold">Real Estate Presentation Coach</span>
                    <SessionTimer elapsed={elapsedTime} />
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
                        <span className="bg-[#8C1D40] text-white px-2.5 py-0.5 rounded-full text-xs font-medium">4</span>
                        <span className="font-medium text-[#8C1D40]">Audience Q&A</span>
                        <span className="text-gray-300 mx-2">→</span>
                        <span className="bg-gray-200 text-gray-600 px-2.5 py-0.5 rounded-full text-xs">5</span>
                        <span className="text-gray-500">Review Analytics</span>
                    </div>
                </div>

                <main className="max-w-6xl mx-auto px-6 py-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left: Video + Transcript */}
                        <div className="lg:col-span-2 space-y-4">
                            {/* Video */}
                            <div className="bg-black rounded-xl overflow-hidden aspect-video relative">
                                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                                {status === "idle" && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                                        <div className="text-center text-white">
                                            <p className="text-lg font-medium">Your Video Feed</p>
                                            <p className="text-sm text-gray-300 mt-1">Camera simulation mode</p>
                                        </div>
                                    </div>
                                )}
                                {isAISpeaking && (
                                    <div className="absolute top-3 right-3 bg-[#8C1D40] text-white text-xs px-2 py-1 rounded-full animate-pulse">
                                        AI Speaking...
                                    </div>
                                )}
                            </div>

                            {/* Transcript */}
                            <div className="bg-white rounded-xl border p-4">
                                <h3 className="font-semibold text-gray-900 mb-3">Live Transcript</h3>
                                <div className="h-48 overflow-y-auto space-y-2">
                                    {transcript.length === 0 ? (
                                        <p className="text-gray-400 italic text-sm">Transcription will appear here during the Q&A session...</p>
                                    ) : (
                                        transcript.map((entry, i) => (
                                            <div key={i} className={`text-sm ${entry.role === "assistant" ? "text-[#8C1D40]" : "text-gray-700"} ${entry.isPartial ? "opacity-60" : ""}`}>
                                                <span className="font-medium">{entry.role === "assistant" ? "Persona" : "You"}:</span>{" "}
                                                {entry.text}
                                            </div>
                                        ))
                                    )}
                                    <div ref={transcriptEndRef} />
                                </div>
                            </div>
                        </div>

                        {/* Right: Controls + Metrics */}
                        <div className="space-y-4">
                            {/* Q&A Controls */}
                            <div className="bg-white rounded-xl border p-4 text-center">
                                <p className="text-sm text-gray-500 mb-1">Presenting to:</p>
                                <p className="font-semibold text-gray-900 mb-4">Real Estate Stakeholder</p>

                                {status === "idle" && (
                                    <>
                                        <button onClick={startQA}
                                            className="w-full py-3 bg-[#8C1D40] text-white rounded-lg font-medium hover:bg-[#6b1632] transition-colors mb-2">
                                            🎙 Start Q&A Session
                                        </button>
                                        <button onClick={skipQA}
                                            className="w-full py-2 text-gray-500 text-sm hover:text-gray-700 transition-colors">
                                            SKIP Q&A →
                                        </button>
                                    </>
                                )}

                                {status === "active" && (
                                    <button onClick={endQA}
                                        className="w-full py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors">
                                        End Q&A → Analytics
                                    </button>
                                )}

                                {status === "ended" && (
                                    <p className="text-gray-500 text-sm">Session ended. Redirecting...</p>
                                )}
                            </div>

                            {/* Metrics during Q&A */}
                            <div className="bg-white rounded-xl border p-4">
                                <h3 className="font-semibold text-gray-900 mb-3">Q&A Metrics</h3>
                                <div className="space-y-3">
                                    <MetricIndicator label="Speaking Pace" value={metrics.wpm} unit="WPM" target={{ min: 120, max: 160 }} />
                                    <MetricIndicator label="Eye Contact" value={metrics.eyeContact} unit="%" target={{ min: 60 }} />
                                    <MetricIndicator label="Volume" value={metrics.volume} unit="%" target={{ min: 60, max: 85 }} />
                                    <MetricIndicator label="Filler Words" value={metrics.fillerWords} unit="/min" target={{ max: 3 }} />
                                    <MetricIndicator label="Pauses" value={metrics.pauses} unit="" target={{ min: 3 }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </ProtectedRoute>
    );
}
