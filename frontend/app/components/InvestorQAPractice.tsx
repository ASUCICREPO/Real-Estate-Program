'use client';

import React, { useState } from 'react';

interface Question {
    question: string;
    tips: string[];
    sampleAnswer: string;
}

const QUESTIONS: Question[] = [
    {
        question: 'Walk me through the deal at a high level. What is your purchase price and all-in basis?',
        tips: [
            'Start with the property type and location',
            'State purchase price clearly',
            'Break down all-in basis: purchase price + closing costs + renovation + soft costs',
            'Show you understand total capital requirements',
        ],
        sampleAnswer: "We're acquiring a 50,000 SF Class B office building in Downtown Tempe for $8.5M. Our all-in basis is $10.2M, which includes $8.5M purchase, $300K closing costs, $1.2M in tenant improvements and deferred maintenance, and $200K in soft costs for legal, financing, and project management.",
    },
    {
        question: 'What is your underwritten cap rate vs. current market cap rate?',
        tips: [
            'State your stabilized NOI assumption',
            'Calculate cap rate: NOI / Purchase Price',
            'Compare to current market comps',
            'Explain any spread as upside or risk',
        ],
        sampleAnswer: "Based on stabilized NOI of $680K, our underwritten cap rate is 6.7%. Current market comps for similar Class B office in this submarket are trading at 6.2-6.5%, so we're buying at a slight premium. However, our business plan includes bringing occupancy from 78% to 92%, which creates immediate value and justifies the going-in cap rate.",
    },
    {
        question: 'Walk me through your NOI calculation',
        tips: [
            'Start with gross potential rent',
            'Subtract vacancy & credit loss',
            'Add other income (parking, amenities)',
            'Subtract operating expenses (taxes, insurance, utilities, management)',
        ],
        sampleAnswer: "Gross potential rent at $22/SF is $1.1M annually. With 8% vacancy & credit loss, effective gross income is $1.01M. We add $40K in parking income for total revenue of $1.05M. Operating expenses run $370K - that's property taxes at $140K, insurance $30K, utilities $80K, maintenance $70K, and management at 5% of EGI. Net operating income stabilizes at $680K.",
    },
    {
        question: "How much equity and debt are you raising? What's the expected ROI and IRR?",
        tips: [
            'State total capital stack',
            'Break down equity vs. debt',
            'State leverage ratio (LTV)',
            'Provide IRR and equity multiple over hold period',
        ],
        sampleAnswer: "Total capital need is $10.2M. We're securing a 65% LTV loan of $6.6M at 5.5% fixed for 7 years. That leaves $3.6M in equity. Based on our 5-year hold and conservative exit at a 6.5% cap, we're projecting a 17.2% IRR and 1.9x equity multiple for our investors. Cash-on-cash returns average 9.5% annually.",
    },
    {
        question: 'What is your exit strategy and hold period?',
        tips: [
            'State planned hold period',
            'Explain exit timing rationale',
            'Describe exit scenarios (sale, refi, hold)',
            "Show you've thought through market timing",
        ],
        sampleAnswer: "We plan a 5-year hold to execute our value-add business plan and capture market appreciation. Exit strategy is a sale to an institutional buyer or REIT once we've stabilized occupancy and rents. We're modeling a conservative 6.5% exit cap. Alternative exit is a cash-out refinance if cap rates compress further and we want to hold long-term for cash flow.",
    },
    {
        question: 'What are the primary risks and how are you mitigating them?',
        tips: [
            'Identify 3-4 key risks specific to the deal',
            'For each risk, state mitigation strategy',
            'Show thoughtful risk management',
            "Be honest - don't downplay real risks",
        ],
        sampleAnswer: "Three primary risks: First, lease rollover - we have 40% rolling in year 2. Mitigation: we're pre-marketing space and budgeted strong TI allowances. Second, rising interest rates affecting exit cap. Mitigation: conservative 6.5% exit assumption and willingness to hold longer. Third, submarket office demand. Mitigation: Tempe has strong fundamentals with ASU and tech employers, plus our rents are 15% below Class A, giving us pricing power.",
    },
];

interface InvestorQAPracticeProps {
    onExit: () => void;
}

export default function InvestorQAPractice({ onExit }: InvestorQAPracticeProps) {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<string[]>(Array(QUESTIONS.length).fill(''));
    const [showTips, setShowTips] = useState(true);
    const answeredCount = answers.filter(a => a.trim().length > 0).length;

    const q = QUESTIONS[currentQuestion];
    const progressPercent = ((currentQuestion + 1) / QUESTIONS.length) * 100;

    return (
        <div className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-6 sm:py-8 2xl:max-w-[1000px] 2xl:py-12">
            {/* Progress bar */}
            <div className="mb-6 2xl:mb-8">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-maroon-700 font-sans">
                        Question {currentQuestion + 1} of {QUESTIONS.length}
                    </span>
                    <span className="text-sm text-gray-500 font-sans">{answeredCount} answered</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden 2xl:h-3">
                    <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>

            {/* Question card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 2xl:p-10">
                {/* Question header */}
                <div className="flex items-start gap-3 mb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 shrink-0 2xl:h-12 2xl:w-12">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-blue-500 2xl:h-6 2xl:w-6">
                            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" fill="currentColor" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-maroon-700 font-sans 2xl:text-xl">Investor Question</h3>
                        <p className="mt-1 text-sm text-gray-800 font-sans sm:text-base 2xl:text-lg">{q.question}</p>
                    </div>
                </div>

                {/* Answer textarea */}
                <div className="mb-5">
                    <label className="block text-sm font-bold text-gray-900 font-sans mb-2 2xl:text-base">Your Answer</label>
                    <textarea
                        value={answers[currentQuestion]}
                        onChange={(e) => {
                            const newAnswers = [...answers];
                            newAnswers[currentQuestion] = e.target.value;
                            setAnswers(newAnswers);
                        }}
                        placeholder="Type your answer here, or practice speaking it aloud..."
                        className="w-full h-32 rounded-xl border-2 border-blue-200 bg-white p-4 text-sm text-gray-700 font-sans placeholder:text-gray-400 focus:border-blue-400 focus:outline-none resize-none 2xl:h-40 2xl:text-base 2xl:p-5"
                    />
                </div>

                {/* Show/Hide Tips toggle */}
                <button
                    onClick={() => setShowTips(!showTips)}
                    className="mb-4 flex items-center gap-2 rounded-lg border border-yellow-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-yellow-50 font-sans 2xl:text-base"
                >
                    <span>💡</span>
                    {showTips ? 'Hide Tips' : 'Show Tips'}
                </button>

                {/* Tips */}
                {showTips && (
                    <div className="mb-4 rounded-xl border-2 border-yellow-200 bg-yellow-50/50 p-5 2xl:p-6">
                        <h4 className="text-sm font-bold text-gray-900 font-sans mb-2 2xl:text-base">
                            💡 Tips for a Strong Answer:
                        </h4>
                        <ul className="space-y-1.5">
                            {q.tips.map((tip, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-600 font-sans 2xl:text-base">
                                    <span className="text-gray-400 mt-1">•</span>
                                    {tip}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Sample Answer */}
                {showTips && (
                    <div className="rounded-xl border-2 border-green-200 bg-green-50/30 p-5 2xl:p-6">
                        <h4 className="text-sm font-bold text-gray-900 font-sans mb-2 2xl:text-base">
                            ✓ Sample Answer:
                        </h4>
                        <p className="text-sm text-gray-700 font-sans leading-relaxed 2xl:text-base 2xl:leading-7">
                            {q.sampleAnswer}
                        </p>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <div className="mt-6 flex items-center justify-between 2xl:mt-8">
                <button
                    onClick={onExit}
                    className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 font-sans 2xl:px-6 2xl:py-3 2xl:text-base"
                >
                    Exit Practice
                </button>

                <div className="flex items-center gap-3">
                    {currentQuestion > 0 && (
                        <button
                            onClick={() => setCurrentQuestion(c => c - 1)}
                            className="rounded-lg border-2 border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 font-sans 2xl:px-6 2xl:py-3 2xl:text-base"
                        >
                            ← Previous
                        </button>
                    )}
                    {currentQuestion < QUESTIONS.length - 1 ? (
                        <button
                            onClick={() => setCurrentQuestion(c => c + 1)}
                            className="rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600 font-sans flex items-center gap-2 2xl:px-6 2xl:py-3 2xl:text-base"
                        >
                            Next Question →
                        </button>
                    ) : (
                        <button
                            onClick={onExit}
                            className="rounded-lg bg-green-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-600 font-sans flex items-center gap-2 2xl:px-6 2xl:py-3 2xl:text-base"
                        >
                            Complete Practice ✓
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
