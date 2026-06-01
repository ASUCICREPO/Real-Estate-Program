"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuthContext } from "@/components/auth/AuthProvider";
import SessionTimer from "@/components/recorder/SessionTimer";
import SessionControls from "@/components/recorder/SessionControls";
import MetricIndicator from "@/components/recorder/MetricIndicator";

export default function SessionPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user } = useAuthContext();

    const sessionId = params.id as string;
    const personaId = searchParams.get("personaId") || "";

    const [status, setStatus] = useState<"idle" | "recording" | "paused" | "stopped">("idle");
    const [elapsedTime, setElapsedTime] = useState(0);
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Metrics state
    const [metrics, setMetrics] = useState({
        wpm: 0,
        eyeContact: 0,
        volume: 0,
        fillerWords: 0,
        pauses: 0,
    });

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setMediaStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setStatus("recording");
        } catch (err) {
            console.error("Failed to access camera/mic:", err);
        }
    }, []);

    const pauseRecording = () => setStatus("paused");
    const resumeRecording = () => setStatus("recording");

    const stopRecording = () => {
        if (mediaStream) {
            mediaStream.getTracks().forEach((t) => t.stop());
            setMediaStream(null);
        }
        setStatus("stopped");
        // Navigate to Q&A
        router.push(`/session/${sessionId}/qa?personaId=${personaId}`);
    };

    // Timer
    useEffect(() => {
        if (status !== "recording") return;
        const interval = setInterval(() => setElapsedTime((t) => t + 1), 1000);
        return () => clearInterval(interval);
    }, [status]);

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
                        <span className="bg-[#8C1D40] text-white px-2.5 py-0.5 rounded-full text-xs font-medium">3</span>
                        <span className="font-medium text-[#8C1D40]">Practice & Record</span>
                        <span className="text-gray-300 mx-2">→</span>
                        <span className="bg-gray-200 text-gray-600 px-2.5 py-0.5 rounded-full text-xs">4</span>
                        <span className="text-gray-500">Audience Q&A</span>
                        <span className="text-gray-300 mx-2">→</span>
                        <span className="bg-gray-200 text-gray-600 px-2.5 py-0.5 rounded-full text-xs">5</span>
                        <span className="text-gray-500">Review Analytics</span>
                    </div>
                </div>

                <main className="max-w-6xl mx-auto px-6 py-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Video feed */}
                        <div className="lg:col-span-2">
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
                            </div>

                            {/* Controls */}
                            <div className="mt-4">
                                <SessionControls
                                    status={status}
                                    onStart={startRecording}
                                    onPause={pauseRecording}
                                    onResume={resumeRecording}
                                    onStop={stopRecording}
                                />
                            </div>
                        </div>

                        {/* Metrics panel */}
                        <div className="space-y-4">
                            <div className="bg-white rounded-xl border p-4">
                                <h3 className="font-semibold text-gray-900 mb-3">Live Metrics</h3>
                                <div className="space-y-3">
                                    <MetricIndicator label="Speaking Pace" value={metrics.wpm} unit="WPM" target={{ min: 120, max: 160 }} />
                                    <MetricIndicator label="Eye Contact" value={metrics.eyeContact} unit="%" target={{ min: 60 }} />
                                    <MetricIndicator label="Volume" value={metrics.volume} unit="%" target={{ min: 60, max: 85 }} />
                                    <MetricIndicator label="Filler Words" value={metrics.fillerWords} unit="/min" target={{ max: 3 }} />
                                    <MetricIndicator label="Pauses" value={metrics.pauses} unit="" target={{ min: 3 }} />
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border p-4">
                                <h3 className="font-semibold text-gray-900 mb-2">Live Transcript</h3>
                                <div className="h-40 overflow-y-auto text-sm text-gray-600">
                                    <p className="text-gray-400 italic">Transcription will appear here during the session...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </ProtectedRoute>
    );
}
