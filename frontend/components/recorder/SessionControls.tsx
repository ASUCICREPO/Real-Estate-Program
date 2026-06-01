"use client";

interface Props {
    status: "idle" | "recording" | "paused" | "stopped";
    onStart: () => void;
    onPause: () => void;
    onResume: () => void;
    onStop: () => void;
}

export default function SessionControls({ status, onStart, onPause, onResume, onStop }: Props) {
    return (
        <div className="flex items-center justify-center gap-4">
            {status === "idle" && (
                <button onClick={onStart}
                    className="px-6 py-2.5 bg-[#8C1D40] text-white rounded-lg font-medium hover:bg-[#6b1632] transition-colors flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-400 animate-pulse" />
                    Start Recording
                </button>
            )}

            {status === "recording" && (
                <>
                    <button onClick={onPause}
                        className="px-5 py-2.5 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 transition-colors">
                        Pause
                    </button>
                    <button onClick={onStop}
                        className="px-5 py-2.5 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors">
                        End Presentation → Q&A
                    </button>
                </>
            )}

            {status === "paused" && (
                <>
                    <button onClick={onResume}
                        className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors">
                        Resume
                    </button>
                    <button onClick={onStop}
                        className="px-5 py-2.5 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors">
                        End Presentation → Q&A
                    </button>
                </>
            )}

            {status === "stopped" && (
                <p className="text-gray-500 text-sm">Session ended. Redirecting to Q&A...</p>
            )}
        </div>
    );
}
