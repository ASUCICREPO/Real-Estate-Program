"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuthContext } from "@/components/auth/AuthProvider";
import PersonaSelector from "@/components/persona/PersonaSelector";
import ContentUploader from "@/components/upload/ContentUploader";
import type { Persona, Question } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const { user, signOut } = useAuthContext();
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [uploadedS3Key, setUploadedS3Key] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);

  function handleStartSession() {
    if (!selectedPersona) return;
    router.push(`/session/${sessionId}?personaId=${selectedPersona.personaID}`);
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen">
        {/* Header */}
        <header className="bg-[#8C1D40] text-white px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg">Real Estate Presentation Coach</span>
            <span className="text-white/70 text-sm">Experiential Learning Lab</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/80">Welcome, {user?.email?.split("@")[0]}</span>
            <button onClick={signOut} className="text-sm bg-white/10 px-3 py-1 rounded hover:bg-white/20 transition-colors">
              Log Out
            </button>
          </div>
        </header>

        {/* Steps indicator */}
        <div className="bg-white border-b px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center gap-2 text-sm">
            <span className="bg-[#8C1D40] text-white px-2.5 py-0.5 rounded-full text-xs font-medium">1</span>
            <span className="font-medium text-[#8C1D40]">Select Persona</span>
            <span className="text-gray-300 mx-2">→</span>
            <span className="bg-gray-200 text-gray-600 px-2.5 py-0.5 rounded-full text-xs">2</span>
            <span className="text-gray-500">Upload Content</span>
            <span className="text-gray-300 mx-2">→</span>
            <span className="bg-gray-200 text-gray-600 px-2.5 py-0.5 rounded-full text-xs">3</span>
            <span className="text-gray-500">Practice & Record</span>
            <span className="text-gray-300 mx-2">→</span>
            <span className="bg-gray-200 text-gray-600 px-2.5 py-0.5 rounded-full text-xs">4</span>
            <span className="text-gray-500">Audience Q&A</span>
            <span className="text-gray-300 mx-2">→</span>
            <span className="bg-gray-200 text-gray-600 px-2.5 py-0.5 rounded-full text-xs">5</span>
            <span className="text-gray-500">Review Analytics</span>
          </div>
        </div>

        {/* Main content */}
        <main className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <PersonaSelector onSelect={setSelectedPersona} />
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <ContentUploader
                sessionId={sessionId}
                personaId={selectedPersona?.personaID || ""}
                onUploadComplete={setUploadedS3Key}
                onQuestionsGenerated={setQuestions}
                disabled={!selectedPersona}
              />
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <button onClick={handleStartSession} disabled={!selectedPersona}
              className="px-8 py-3 bg-[#8C1D40] text-white rounded-lg font-medium hover:bg-[#6b1632] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              Start Practice Session
            </button>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
