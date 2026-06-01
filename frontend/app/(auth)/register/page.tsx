"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/components/auth/AuthProvider";

export default function RegisterPage() {
    const { signUp, confirmSignUp } = useAuthContext();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [step, setStep] = useState<"register" | "confirm">("register");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await signUp(email, password);
            setStep("confirm");
        } catch (err: any) {
            setError(err.message || "Registration failed");
        } finally {
            setLoading(false);
        }
    }

    async function handleConfirm(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await confirmSignUp(email, code);
            router.push("/login");
        } catch (err: any) {
            setError(err.message || "Confirmation failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-sm border p-8">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-[#8C1D40]">Create Account</h1>
                    <p className="text-gray-500 mt-1 text-sm">W. P. Carey Experiential Learning Lab</p>
                </div>

                {step === "register" ? (
                    <form onSubmit={handleRegister} className="space-y-4">
                        {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#8C1D40] focus:border-transparent" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#8C1D40] focus:border-transparent" />
                            <p className="text-xs text-gray-400 mt-1">Min 8 chars, uppercase, lowercase, number, symbol</p>
                        </div>
                        <button type="submit" disabled={loading}
                            className="w-full py-2.5 bg-[#8C1D40] text-white rounded-lg font-medium hover:bg-[#6b1632] disabled:opacity-50 transition-colors">
                            {loading ? "Creating..." : "Create Account"}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleConfirm} className="space-y-4">
                        {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
                        <p className="text-sm text-gray-600">Check your email for a verification code.</p>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Verification Code</label>
                            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} required
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#8C1D40] focus:border-transparent" />
                        </div>
                        <button type="submit" disabled={loading}
                            className="w-full py-2.5 bg-[#8C1D40] text-white rounded-lg font-medium hover:bg-[#6b1632] disabled:opacity-50 transition-colors">
                            {loading ? "Verifying..." : "Verify Email"}
                        </button>
                    </form>
                )}

                <p className="text-center text-sm text-gray-500 mt-4">
                    Already have an account? <Link href="/login" className="text-[#8C1D40] font-medium hover:underline">Sign In</Link>
                </p>
            </div>
        </div>
    );
}
