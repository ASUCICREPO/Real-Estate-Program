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
    /** Ref to register audio chunk callback (Nova Sonic PCM base64 -> avatar lip sync) */
    onAudioChunkRef: React.MutableRefObject<((base64: string) => void) | null>;
    /** Ref to register agent turn complete callback */
    onAgentTurnCompleteRef: React.MutableRefObject<(() => void) | null>;
}

export default function AnamAvatarPanel({
    anamPersonaId,
    sessionToken,
    isActive,
    isMuted,
    onToggleMute,
    onEnd,
    onAudioChunkRef,
    onAgentTurnCompleteRef,
}: AnamAvatarPanelProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const clientRef = useRef<ReturnType<typeof createClient> | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const audioInputRef = useRef<any>(null);
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
                    console.log('[Anam] Connected — creating audio passthrough stream');
                    setConnected(true);
                    setConnecting(false);

                    // Create audio input stream for lip-sync passthrough
                    try {
                        const audioInput = client.createAgentAudioInputStream({
                            encoding: 'pcm_s16le',
                            sampleRate: 16000,
                            channels: 1,
                        });
                        audioInputRef.current = audioInput;
                        console.log('[Anam] Audio passthrough stream ready');
                    } catch (e) {
                        console.error('[Anam] Failed to create audio input stream:', e);
                    }
                });

                client.addListener(AnamEvent.CONNECTION_CLOSED, () => {
                    console.log('[Anam] Connection closed');
                    setConnected(false);
                    audioInputRef.current = null;
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
                audioInputRef.current = null;
                setConnected(false);
            }
        };
    }, [sessionToken, isActive]);

    // Register audio chunk callback — forwards Nova Sonic PCM to Anam for lip sync
    useEffect(() => {
        onAudioChunkRef.current = (base64: string) => {
            if (audioInputRef.current) {
                try {
                    audioInputRef.current.sendAudioChunk(base64);
                } catch (e) {
                    // Ignore send errors
                }
            }
        };
        return () => {
            onAudioChunkRef.current = null;
        };
    }, [onAudioChunkRef, connected]);

    // Register agent turn complete callback
    useEffect(() => {
        onAgentTurnCompleteRef.current = () => {
            if (audioInputRef.current) {
                try {
                    audioInputRef.current.endSequence();
                } catch (e) {
                    // Ignore
                }
            }
        };
        return () => {
            onAgentTurnCompleteRef.current = null;
        };
    }, [onAgentTurnCompleteRef, connected]);

    const handleEnd = useCallback(() => {
        if (clientRef.current) {
            try {
                clientRef.current.stopStreaming();
            } catch (e) {
                // Ignore
            }
            clientRef.current = null;
            audioInputRef.current = null;
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
