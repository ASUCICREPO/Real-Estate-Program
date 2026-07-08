'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createClient, AnamEvent } from '@anam-ai/js-sdk';
import { Mic, MicOff, PhoneOff, Loader2 } from 'lucide-react';

interface AnamAvatarPanelProps {
    anamPersonaId: string;
    sessionToken: string | null;
    isActive: boolean;
    isMuted: boolean;
    onToggleMute: () => void;
    onEnd: () => void;
    /** Called when a new assistant transcript chunk arrives from our WebSocket */
    transcriptText?: string;
    /** Whether this is a partial or final transcript */
    isTranscriptFinal?: boolean;
}

export default function AnamAvatarPanel({
    anamPersonaId,
    sessionToken,
    isActive,
    isMuted,
    onToggleMute,
    onEnd,
    transcriptText,
    isTranscriptFinal,
}: AnamAvatarPanelProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const clientRef = useRef<ReturnType<typeof createClient> | null>(null);
    const talkStreamRef = useRef<ReturnType<ReturnType<typeof createClient>['createTalkMessageStream']> | null>(null);
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const lastTextRef = useRef('');

    // Initialize Anam client when session token is available
    useEffect(() => {
        if (!sessionToken || !isActive || clientRef.current) return;

        const initAnam = async () => {
            setConnecting(true);
            try {
                const client = createClient(sessionToken, {
                    disableInputAudio: true, // We handle mic ourselves via Nova Sonic
                });

                client.addListener(AnamEvent.CONNECTION_ESTABLISHED, () => {
                    console.log('[Anam] Connected');
                    setConnected(true);
                    setConnecting(false);
                });

                client.addListener(AnamEvent.CONNECTION_CLOSED, () => {
                    console.log('[Anam] Connection closed');
                    setConnected(false);
                });

                clientRef.current = client;

                if (videoRef.current) {
                    await client.streamToVideoElement(videoRef.current.id);
                }
            } catch (error) {
                console.error('[Anam] Failed to connect:', error);
                setConnecting(false);
            }
        };

        initAnam();

        return () => {
            if (clientRef.current) {
                try {
                    clientRef.current.stopStreaming();
                } catch (e) {
                    // Ignore cleanup errors
                }
                clientRef.current = null;
                setConnected(false);
            }
        };
    }, [sessionToken, isActive]);

    // Stream assistant transcript text to Anam for lip sync + TTS
    useEffect(() => {
        if (!connected || !clientRef.current || !transcriptText) return;
        if (transcriptText === lastTextRef.current) return;

        const newText = transcriptText.slice(lastTextRef.current.length);
        lastTextRef.current = transcriptText;

        if (!newText) return;

        // If no active stream or the stream ended, create a new one
        if (!talkStreamRef.current || !talkStreamRef.current.isActive()) {
            talkStreamRef.current = clientRef.current.createTalkMessageStream();
        }

        try {
            if (talkStreamRef.current.isActive()) {
                talkStreamRef.current.streamMessageChunk(newText, !!isTranscriptFinal);
            }
        } catch (e) {
            console.warn('[Anam] Failed to stream chunk:', e);
        }

        // If final, reset for next turn
        if (isTranscriptFinal) {
            lastTextRef.current = '';
            talkStreamRef.current = null;
        }
    }, [transcriptText, isTranscriptFinal, connected]);

    const handleEnd = useCallback(() => {
        if (clientRef.current) {
            try {
                clientRef.current.stopStreaming();
            } catch (e) {
                // Ignore
            }
            clientRef.current = null;
        }
        setConnected(false);
        onEnd();
    }, [onEnd]);

    return (
        <div className="flex flex-col items-center gap-4">
            {/* Avatar Video */}
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black shadow-lg">
                <video
                    id={`anam-video-${anamPersonaId}`}
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                />
                {connecting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <div className="flex items-center gap-2 text-white">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-sm font-sans">Connecting avatar...</span>
                        </div>
                    </div>
                )}
                {!sessionToken && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                        <span className="text-sm text-gray-400 font-sans">Preparing avatar...</span>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onToggleMute}
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${isMuted
                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                >
                    {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>

                <button
                    onClick={handleEnd}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                    title="End Session"
                >
                    <PhoneOff className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}
