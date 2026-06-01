// ── Auth ──

export interface AuthUser {
    email: string;
    userId: string;
}

export interface AuthTokens {
    idToken: string;
    accessToken: string;
    refreshToken: string;
}

export interface AWSCredentials {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
}

export interface AuthState {
    isAuthenticated: boolean;
    user: AuthUser | null;
    tokens: AuthTokens | null;
    awsCredentials: AWSCredentials | null;
    isLoading: boolean;
}

// ── Persona ──

export interface PersonaBestPractices {
    wpm?: { min: number; max: number; label: string };
    eyeContact?: { min: number; max?: number; label: string };
    fillerWords?: { max: number; label: string };
    pauses?: { min: number; label: string };
    Volume?: { min: number; max: number; label: string };
}

export interface Persona {
    personaID: string;
    name: string;
    description: string;
    icon: string;
    expertise: string;
    communicationStyle: string;
    keyPriorities: string[];
    personaPrompt?: string;
    presentationTime: string;
    timeLimitSec: number;
    qaTimeLimitSec: number;
    bestPractices: PersonaBestPractices;
    scoringWeights: Record<string, number>;
}

// ── Session ──

export type SessionStatus = "setup" | "recording" | "paused" | "qa_active" | "completed";

export interface Session {
    sessionId: string;
    userId: string;
    personaId: string;
    status: SessionStatus;
    createdAt: string;
}

// ── Analytics ──

export interface MetricScore {
    name: string;
    score: number;
    weight: number;
    details: string;
}

export interface PhaseAnalytics {
    overallScore: number;
    metricScores: MetricScore[];
    recommendations: string[];
    summary: string;
}

export interface SessionAnalytics {
    sessionId: string;
    personaId: string;
    personaName: string;
    presentationAnalytics: PhaseAnalytics;
    qaAnalytics: PhaseAnalytics;
}

// ── Q&A ──

export interface QAFeedback {
    overallSummary: string;
    responseQuality: string;
    strengths: string[];
    improvements: string[];
    questionBreakdown: {
        question: string;
        rating: string;
        note: string;
    }[];
}

// ── Content ──

export interface Question {
    questionId: string;
    text: string;
    category: string;
    difficulty?: string;
}

// ── Constants ──

export const ACCEPTED_FILE_TYPES = [".pdf", ".ppt", ".pptx", ".doc", ".docx"] as const;
export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
