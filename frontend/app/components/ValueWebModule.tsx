'use client';

import React, { useState } from 'react';

interface ValueWebModuleProps {
    onExit: () => void;
}

export default function ValueWebModule({ onExit }: ValueWebModuleProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = 3;

    const progressPercent = (currentPage / totalPages) * 100;

    return (
        <div className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-6 sm:py-8 2xl:max-w-[1000px] 2xl:py-12">
            {/* Progress bar */}
            <div className="mb-6 2xl:mb-8">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-maroon-700 font-sans">Module Progress</span>
                    <span className="text-sm text-gray-500 font-sans">{currentPage} of {totalPages}</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden 2xl:h-3">
                    <div
                        className="h-full rounded-full bg-maroon-600 transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            {/* Content card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 2xl:p-10">
                {currentPage === 1 && <Page1 />}
                {currentPage === 2 && <Page2 />}
                {currentPage === 3 && <Page3 />}
            </div>

            {/* Navigation */}
            <div className="mt-6 flex items-center justify-between 2xl:mt-8">
                <button
                    onClick={onExit}
                    className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 font-sans 2xl:px-6 2xl:py-3 2xl:text-base"
                >
                    Exit Module
                </button>

                <div className="flex items-center gap-3">
                    {currentPage > 1 && (
                        <button
                            onClick={() => setCurrentPage(p => p - 1)}
                            className="rounded-lg border-2 border-maroon-200 px-5 py-2.5 text-sm font-medium text-maroon-700 transition hover:bg-maroon-50 font-sans 2xl:px-6 2xl:py-3 2xl:text-base"
                        >
                            Previous
                        </button>
                    )}
                    {currentPage < totalPages ? (
                        <button
                            onClick={() => setCurrentPage(p => p + 1)}
                            className="rounded-lg bg-maroon-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-700 font-sans flex items-center gap-2 2xl:px-6 2xl:py-3 2xl:text-base"
                        >
                            Next →
                        </button>
                    ) : (
                        <button
                            onClick={onExit}
                            className="rounded-lg bg-maroon-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-700 font-sans flex items-center gap-2 2xl:px-6 2xl:py-3 2xl:text-base"
                        >
                            Complete Module ✓
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Page 1: The Real Estate Value Web ───────────────────────────────

function Page1() {
    return (
        <>
            <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-maroon-50 2xl:h-12 2xl:w-12">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-maroon-700 2xl:h-6 2xl:w-6">
                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-maroon-700 font-serif italic sm:text-2xl 2xl:text-3xl">
                    The Real Estate Value Web
                </h2>
            </div>

            <p className="text-sm text-gray-700 font-sans leading-relaxed sm:text-base 2xl:text-lg 2xl:leading-8">
                Real estate development is <strong>not a linear chain</strong> of professionals working in sequence. Instead, it&apos;s an <strong className="text-maroon-700">interconnected value web</strong> where multiple stakeholders collaborate, overlap, and influence each other throughout the project lifecycle.
            </p>

            {/* Key Concept box */}
            <div className="mt-6 rounded-xl border-2 border-blue-200 bg-blue-50/50 p-5 2xl:p-7 2xl:mt-8">
                <h3 className="text-base font-bold text-blue-800 font-sans mb-2 2xl:text-lg">
                    Key Concept: Developer as Systems Integrator
                </h3>
                <p className="text-sm text-gray-700 font-sans leading-relaxed 2xl:text-base 2xl:leading-7">
                    The developer doesn&apos;t just manage a sequence of tasks. They act as a <strong>systems integrator</strong>, coordinating a complex network of professionals who each bring specialized expertise. Success depends on understanding how these relationships create value for different stakeholders.
                </p>
            </div>

            {/* Models comparison */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:mt-8">
                <div className="rounded-xl border-2 border-red-200 bg-red-50/50 p-4 2xl:p-5">
                    <p className="text-sm font-bold text-red-600 font-sans mb-1 2xl:text-base">
                        ❌ Linear Chain Model (Wrong)
                    </p>
                    <p className="text-sm text-gray-600 font-sans 2xl:text-base">
                        Step 1 → Step 2 → Step 3 → Complete
                    </p>
                </div>
                <div className="rounded-xl border-2 border-green-200 bg-green-50/50 p-4 2xl:p-5">
                    <p className="text-sm font-bold text-green-600 font-sans mb-1 2xl:text-base">
                        ✓ Value Web Model (Correct)
                    </p>
                    <p className="text-sm text-gray-600 font-sans 2xl:text-base">
                        Interconnected network with overlapping roles
                    </p>
                </div>
            </div>
        </>
    );
}

// ── Page 2: Network of Stakeholders ─────────────────────────────────

function Page2() {
    const stakeholders = [
        { name: 'Investors', priorities: 'ROI, cap rate, IRR, exit strategy', communication: 'Numbers-driven, risk-focused', color: 'border-yellow-200 bg-yellow-50/50' },
        { name: 'Public Officials', priorities: 'Community impact, compliance, tax revenue', communication: 'Public benefit, long-term vision', color: 'border-blue-200 bg-blue-50/50' },
        { name: 'Commercial Developers', priorities: 'Feasibility, timeline, partnerships', communication: 'Practical, execution-focused', color: 'border-purple-200 bg-purple-50/50' },
        { name: 'Property Managers', priorities: 'Operations, tenant satisfaction, NOI', communication: 'Day-to-day practicality', color: 'border-green-200 bg-green-50/50' },
    ];

    return (
        <>
            <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-maroon-50 2xl:h-12 2xl:w-12">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-maroon-700 2xl:h-6 2xl:w-6">
                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-maroon-700 font-serif italic sm:text-2xl 2xl:text-3xl">
                    Network of Stakeholders
                </h2>
            </div>

            <p className="text-sm text-gray-700 font-sans leading-relaxed sm:text-base 2xl:text-lg 2xl:leading-8 mb-6">
                Each stakeholder in the value web has unique priorities, evaluation criteria, and communication preferences. Understanding these differences is critical to project success.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:gap-5">
                {stakeholders.map(s => (
                    <div key={s.name} className={`rounded-xl border-2 p-4 2xl:p-5 ${s.color}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-maroon-600">
                                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3z" fill="currentColor" />
                            </svg>
                            <h3 className="text-sm font-bold text-gray-900 font-sans 2xl:text-base">{s.name}</h3>
                        </div>
                        <p className="text-xs text-gray-700 font-sans 2xl:text-sm">
                            <strong>Priorities:</strong> {s.priorities}
                        </p>
                        <p className="text-xs text-gray-700 font-sans mt-1 2xl:text-sm">
                            <strong>Communication:</strong> {s.communication}
                        </p>
                    </div>
                ))}
            </div>
        </>
    );
}

// ── Page 3: Multi-Stakeholder Communication ─────────────────────────

function Page3() {
    return (
        <>
            <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-maroon-50 2xl:h-12 2xl:w-12">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-maroon-700 2xl:h-6 2xl:w-6">
                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-maroon-700 font-serif italic sm:text-2xl 2xl:text-3xl">
                    Multi-Stakeholder Communication
                </h2>
            </div>

            <p className="text-sm text-gray-700 font-sans leading-relaxed sm:text-base 2xl:text-lg 2xl:leading-8 mb-6">
                The same real estate project must be presented differently to different stakeholder groups. Each audience evaluates success through their own lens.
            </p>

            {/* Example box */}
            <div className="rounded-xl border-2 border-yellow-200 bg-yellow-50/50 p-5 2xl:p-7 mb-6">
                <h3 className="text-base font-bold text-yellow-800 font-sans mb-4 2xl:text-lg">
                    Example: Mixed-Use Development Project
                </h3>

                <div className="space-y-4">
                    <div>
                        <p className="text-sm font-bold text-gray-900 font-sans 2xl:text-base">To Investors:</p>
                        <p className="text-sm text-gray-600 font-sans italic 2xl:text-base">
                            &quot;7.2% cap rate with 18% IRR over 5 years. Conservative underwriting with 10% contingency.&quot;
                        </p>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-900 font-sans 2xl:text-base">To Public Officials:</p>
                        <p className="text-sm text-gray-600 font-sans italic 2xl:text-base">
                            &quot;250 jobs created, 20% affordable housing, LEED Gold certified. $12M in annual tax revenue.&quot;
                        </p>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-900 font-sans 2xl:text-base">To Commercial Partners:</p>
                        <p className="text-sm text-gray-600 font-sans italic 2xl:text-base">
                            &quot;18-month timeline, proven construction team, strong anchor tenant commitments.&quot;
                        </p>
                    </div>
                </div>
            </div>

            {/* Key Takeaway */}
            <div className="rounded-xl border-2 border-green-200 bg-green-50/50 p-5 2xl:p-7">
                <p className="text-sm text-gray-700 font-sans leading-relaxed 2xl:text-base 2xl:leading-7">
                    <strong className="text-green-800">Key Takeaway:</strong> Successful developers master the art of translating the same project vision into language that resonates with each stakeholder&apos;s priorities and evaluation criteria.
                </p>
            </div>
        </>
    );
}
