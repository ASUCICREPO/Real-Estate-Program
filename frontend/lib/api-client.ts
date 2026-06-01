/**
 * REST API client with Cognito auth token injection.
 */
import { apiConfig } from "./amplify-config";

let getIdToken: (() => string | null) | null = null;

export function setTokenProvider(provider: () => string | null) {
    getIdToken = provider;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getIdToken?.();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
    };
    if (token) {
        headers["Authorization"] = token;
    }

    const res = await fetch(`${apiConfig.baseUrl}${path}`, {
        ...options,
        headers,
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed: ${res.status}`);
    }

    return res.json();
}

// ── Personas ──

export async function listPersonas() {
    return request<any[]>("/personas");
}

export async function getPersona(id: string) {
    return request<any>(`/personas/${id}`);
}

export async function createPersona(data: any) {
    return request<any>("/personas", { method: "POST", body: JSON.stringify(data) });
}

export async function updatePersona(id: string, data: any) {
    return request<any>(`/personas/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deletePersona(id: string) {
    return request<any>(`/personas/${id}`, { method: "DELETE" });
}

// ── S3 URLs ──

export async function getUploadUrl(fileName: string, fileType: string, sessionId: string) {
    return request<{ url: string; s3Key: string }>("/s3_urls", {
        method: "POST",
        body: JSON.stringify({ fileName, fileType, sessionId, uploadType: "document" }),
    });
}

export async function getDownloadUrl(key: string) {
    return request<{ url: string }>(`/s3_urls?key=${encodeURIComponent(key)}`);
}

// ── Content Analysis ──

export async function analyzeContent(s3Key: string, personaId: string, sessionId: string) {
    return request<{ questions: any[] }>("/content", {
        method: "POST",
        body: JSON.stringify({ s3Key, personaId, sessionId }),
    });
}

// ── Analytics ──

export async function getAnalytics(sessionId: string, personaId: string) {
    return request<any>(`/analytics?sessionId=${sessionId}&personaId=${personaId}`);
}
