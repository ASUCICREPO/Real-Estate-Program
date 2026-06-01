"use client";

import { useState, useRef } from "react";
import { getUploadUrl, analyzeContent } from "@/lib/api-client";
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE_MB, MAX_FILE_SIZE_BYTES } from "@/lib/types";
import type { Question } from "@/lib/types";

interface Props {
    sessionId: string;
    personaId: string;
    onUploadComplete: (s3Key: string) => void;
    onQuestionsGenerated: (questions: Question[]) => void;
    disabled?: boolean;
}

export default function ContentUploader({ sessionId, personaId, onUploadComplete, onQuestionsGenerated, disabled }: Props) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [uploaded, setUploaded] = useState(false);
    const [error, setError] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const f = e.target.files?.[0];
        if (!f) return;
        if (f.size > MAX_FILE_SIZE_BYTES) {
            setError(`File too large. Max ${MAX_FILE_SIZE_MB}MB.`);
            return;
        }
        setFile(f);
        setError("");
    }

    async function handleUpload() {
        if (!file || !personaId) return;
        setError("");
        setUploading(true);

        try {
            const { url, s3Key } = await getUploadUrl(file.name, file.type, sessionId);
            await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
            setUploaded(true);
            onUploadComplete(s3Key);

            // Analyze content
            setAnalyzing(true);
            const { questions } = await analyzeContent(s3Key, personaId, sessionId);
            onQuestionsGenerated(questions);
        } catch (err: any) {
            setError(err.message || "Upload failed");
        } finally {
            setUploading(false);
            setAnalyzing(false);
        }
    }

    return (
        <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Upload Content (Optional)</h2>
            <p className="text-sm text-gray-500 mb-4">Upload your slides or notes for AI-generated Q&A questions.</p>

            {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm mb-3">{error}</div>}

            {uploaded ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-700 font-medium text-sm">✓ {file?.name} uploaded</p>
                    {analyzing && <p className="text-green-600 text-xs mt-1">Analyzing content...</p>}
                </div>
            ) : (
                <div className={`border-2 border-dashed rounded-lg p-6 text-center ${disabled ? "opacity-50" : "hover:border-[#8C1D40]/50 cursor-pointer"}`}
                    onClick={() => !disabled && inputRef.current?.click()}>
                    <input ref={inputRef} type="file" className="hidden" accept={ACCEPTED_FILE_TYPES.join(",")} onChange={handleFileChange} disabled={disabled} />
                    {file ? (
                        <div>
                            <p className="text-sm font-medium text-gray-700">{file.name}</p>
                            <p className="text-xs text-gray-400 mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                            <button onClick={(e) => { e.stopPropagation(); handleUpload(); }} disabled={uploading || disabled}
                                className="mt-3 px-4 py-2 bg-[#8C1D40] text-white text-sm rounded-lg hover:bg-[#6b1632] disabled:opacity-50">
                                {uploading ? "Uploading..." : "Upload & Analyze"}
                            </button>
                        </div>
                    ) : (
                        <div>
                            <p className="text-gray-400 text-sm">{disabled ? "Select a persona first" : "Click to select a file"}</p>
                            <p className="text-xs text-gray-300 mt-1">PDF, PPT, PPTX, DOC, DOCX (max {MAX_FILE_SIZE_MB}MB)</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
