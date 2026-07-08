'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createClient, AnamEvent } from '@anam-ai/js-sdk';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface AnamAvatarPanelProps {
    anamPersonaId: string;
    sessionToken: string | null;
    isActive: boolean;
    isMuted: boolean;
    onToggleMute: () => void;
    onEnd: () => void;
    /** Ref to register a callback for assistant transcript text (for Anam TTS + lip sync) */
    onAssistantTextRef: React.MutableRefObject<((text: string, isFinal: boolean) => void) | null>;
}

export default function AnamAvatarPanel({
    anamPersonaId,
    sessionToken,
    isActive,
    isMuted,
    onToggleMute,
    onEnd,
    onAssistantTextRef,
}: AnamAvatarPanelProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const clientRef = useRef<ReturnType<typeof createClient> | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const talkStreamRef = useRef<any>(null);
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);

    // Initialize Anam client when session token is available
    useEffect(() => {
        if (!sessionToken || !isActive || clientRef.current) return;

        const initAnam = async () => {
            setConnecting(true);
            try {
                const client = createClient(sessionToken, {
                    disableInputAudio: true, // We handle mic via Nova Sonic, not Anam
                });

                client.addListener(AnamEvent.CONNECTION_ESTABLISHED, () => {
                    console.log('[Anam] Connected — ready for talk commands');
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
                talkStreamRef.current = null;
                setConnected(false);
            }
        };
    }, [sessionToken, isActive]);

    // Register text callback — pipes Nova Sonic transcript text to Anam for TTS + lip sync
    useEffect(() => {
        onAssistantTextRef.current = (text: string, isFinal: boolean) => {
            if (!clientRef.current || !connected) return;

            try {
                // Create a new talk stream if needed
                if (!talkStreamRef.current || !talkStreamRef.current.isActive()) {
                    talkStreamRef.current = clientRef.current.createTalkMessageStream();
                }

                if (talkStreamRef.current.isActive()) {
                    talkStreamRef.current.streamMessageChunk(text, isFinal);
                }

                // Reset stream ref on final so next turn gets a new stream
                if (isFinal) {
                    talkStreamRef.current = null;
                }
            } catch (e) {
                console.warn('[Anam] Talk stream error:', e);
                talkStreamRef.current = null;
            }
        };

        return () => {
            onAssistantTextRef.current = null;
        };
    }, [onAssistantTextRef, connected]);

    const handleEnd = useCallback(() => {
        if (clientRef.current) {
            try {
                clientRef.current.stopStreaming();
            } catch (e) {
                // Ignore
            }
            clientRef.current = null;
            talkStreamRef.current = null;
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
                    className="flex items-center gap-2 rounded-full bg-red-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition-colors font-sans shadow-sm"
                >
                    End Session
                </button>
            </div>
        </div>
    );
}
