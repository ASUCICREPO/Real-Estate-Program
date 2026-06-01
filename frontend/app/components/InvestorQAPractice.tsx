'use client';

import React, { useState } from 'react';

interface Question {
    question: string;
    tips: string[];
}

interface QuestionCategory {
    title: string;
    description: string;
    questions: Question[];
}

const CATEGORIES: QuestionCategory[] = [
    {
        title: 'Deal Overview & Investment Thesis',
        description: 'The investor expects a crisp, defensible thesis in the first 60 seconds. Generalities and unsupported projections will be dismissed immediately.',
        questions: [
            { question: 'Tell me the investment thesis in one sentence. Why this asset, in this market, at this price, right now?', tips: ['Be specific about the opportunity', 'Reference market timing', 'State the value creation strategy'] },
            { question: 'Is this a core, core-plus, value-add, or opportunistic play?', tips: ['Define the risk/return profile clearly', 'Explain why this classification fits'] },
            { question: 'How old is this property? When was it last renovated?', tips: ['Know the exact year built', 'Detail any capital improvements made'] },
            { question: 'Describe your sub-market?', tips: ['Demographics, employment drivers', 'Supply/demand dynamics', 'Growth trajectory'] },
            { question: 'What is the primary market area and how did you determine this?', tips: ['Define the geographic boundary', 'Explain methodology (drive time, demographics)'] },
            { question: 'What is sub-market absorption rate? What absorption rate did you assume?', tips: ['Cite actual market data', 'Justify your assumption vs. historical'] },
            { question: 'What is your target market future demand?', tips: ['Population growth projections', 'Employment growth', 'Housing/office demand forecasts'] },
            { question: 'What is the purchase price? Is this all cash or seller carryback?', tips: ['State the number clearly', 'Explain the deal structure'] },
            { question: 'What return profile does that imply, and is your pricing consistent with that risk profile?', tips: ['Connect price to expected returns', 'Compare to market risk premiums'] },
            { question: 'What specifically about this submarket justifies this investment?', tips: ['Cite specific economic drivers', 'Reference barriers to entry'] },
            { question: 'What is the competitive supply?', tips: ['Pipeline of new construction', 'Planned developments in the area'] },
            { question: 'What are the population and employment growth rates?', tips: ['Cite sources (Census, BLS)', 'Compare to metro and national averages'] },
            { question: 'Describe your target market user – who are they? Give me their profile.', tips: ['Demographics, income levels', 'Industry/employer profile', 'Lifestyle preferences'] },
            { question: 'Walk me through the supply, demand, and employment fundamentals.', tips: ['Current inventory levels', 'Net absorption trends', 'Major employers and job growth'] },
            { question: 'How did you arrive at this purchase price? What comparable sales support it?', tips: ['Cite 3-5 recent comps', 'Explain adjustments made', 'Note when transactions closed'] },
        ],
    },
    {
        title: 'Income & Operations',
        description: 'The investor will dissect your income assumptions line by line. Every number needs a source.',
        questions: [
            { question: 'What is your going-in cap rate, and how does it compare to market?', tips: ['Calculate: NOI / Purchase Price', 'Compare to recent market transactions'] },
            { question: 'Is this based on buying in-place income or pro forma income?', tips: ['Distinguish between current and projected', 'Explain the gap if pro forma'] },
            { question: 'Walk me through your rent growth assumptions year by year. What is the basis for each year\'s growth rate?', tips: ['Cite historical rent growth', 'Reference lease escalation clauses', 'Compare to CPI and market forecasts'] },
            { question: 'Are you inflating expenses? What is that rate and why?', tips: ['State the inflation assumption', 'Justify with historical data'] },
            { question: 'What is current occupancy?', tips: ['Physical vs. economic occupancy', 'Trend over past 12-24 months'] },
            { question: 'What vacancy rate are you underwriting, and what is the current market vacancy?', tips: ['Your assumption vs. market average', 'Justify any difference'] },
            { question: 'How are you accounting for credit loss?', tips: ['Percentage assumption', 'Historical bad debt at this property'] },
            { question: 'Take me through your operating expense assumptions. What are you using for property taxes, insurance, management fees, and CapEx reserves?', tips: ['Line-item detail', 'Compare to market benchmarks', 'Source for each assumption'] },
            { question: 'What is your Year 1 NOI and your projected cash-on-cash return?', tips: ['Show the math clearly', 'Distinguish levered vs. unlevered'] },
            { question: 'What is your projected NOI growth? What does that look like in a downside scenario?', tips: ['Base case vs. stress case', 'Identify key sensitivities'] },
            { question: 'What is the risk of missing this NOI?', tips: ['Identify top 3 risks to income', 'Quantify the impact'] },
        ],
    },
    {
        title: 'Capital Structure & Returns',
        description: 'Every claim about returns requires evidence. Every projection requires a stress test.',
        questions: [
            { question: 'What is your capital stack – are you assuming a loan is needed for this purchase?', tips: ['Total capital required', 'Debt vs. equity split', 'Sources of each'] },
            { question: 'What loan terms — rate, LTV, amortization, term, and prepayment?', tips: ['Be specific on each term', 'Explain why these terms are achievable'] },
            { question: 'Is this fixed or floating rate, and if floating, what is your rate cap coverage?', tips: ['State the rate type', 'If floating, explain hedging strategy'] },
            { question: 'What is your DSCR at stabilization, and what is your minimum DSCR covenant with the lender?', tips: ['Calculate: NOI / Debt Service', 'Show cushion above covenant'] },
            { question: 'Walk me through the equity waterfall. What is the preferred return, the promote structure, and the LP/GP split?', tips: ['Pref rate and accrual method', 'Promote hurdles and splits', 'Catch-up provisions'] },
            { question: "What's my IRR? What's your IRR?", tips: ['LP vs. GP returns', 'Show alignment of interests'] },
            { question: 'What is the present value of my investment? What discount rate did you use and why?', tips: ['State the discount rate', 'Justify with risk-free rate + premium'] },
            { question: 'What is my cash-on-cash return unlevered and levered?', tips: ['Show both calculations', 'Explain the leverage benefit'] },
        ],
    },
    {
        title: 'Renovation & Value-Add',
        description: 'If you are projecting value creation through renovation, every dollar must be justified.',
        questions: [
            { question: 'Is there funds for renovation and what is the total renovation budget, how did you arrive at it, and who has validated those numbers?', tips: ['Total budget with contingency', 'Source of cost estimates', 'Third-party validation'] },
            { question: "Have you included funds for TI's on new leases and lease renewals? How does TI allowance compare to competition?", tips: ['TI budget per SF', 'Market comparison', 'Leasing commission assumptions'] },
            { question: 'What is your renovation timeline unit by unit, and what happens to your projections if it takes six months longer than planned?', tips: ['Detailed timeline', 'Sensitivity analysis on delays', 'Impact on returns'] },
            { question: 'You are projecting a rent premium post-renovation. What comparable renovated units in the submarket support that premium?', tips: ['Cite specific renovated comps', 'Show the rent differential', 'Justify the premium amount'] },
        ],
    },
    {
        title: 'Exit Strategy & Risk',
        description: 'The investor needs to understand how they get their money back and what can go wrong.',
        questions: [
            { question: 'What is the investment horizon? What is the assumed exit cap rate?', tips: ['State hold period', 'Justify exit cap assumption', 'Compare to going-in cap'] },
            { question: 'What is your price per unit relative to replacement cost? Could someone build this asset new for less?', tips: ['Calculate replacement cost', 'Show discount to replacement'] },
            { question: 'What exit cap rate are you using, and why? What happens to your IRR if the exit cap rate is 50 basis points higher?', tips: ['Justify the exit cap', 'Show sensitivity table', 'Quantify IRR impact'] },
            { question: 'What is your exit strategy if the market is in a downturn at your projected sale date?', tips: ['Alternative exit options', 'Refinance possibility', 'Hold strategy with cash flow'] },
            { question: 'What happens to my returns if this takes longer?', tips: ['Show timeline sensitivity', 'Impact on IRR and equity multiple'] },
            { question: 'Do you have the ability to extend your proposed loan?', tips: ['Extension options in loan docs', 'Conditions for extension'] },
            { question: 'How do you get comfortable recommending this deal at this return level given the risk profile?', tips: ['Risk-adjusted return comparison', 'Downside protection', 'Margin of safety'] },
        ],
    },
    {
        title: 'Management & Sensitivity',
        description: 'Operational execution and stress testing separate serious operators from promoters.',
        questions: [
            { question: 'Who is managing the property — third-party or in-house? What is the assumed fee?', tips: ['Name the manager', 'Fee structure', 'Track record'] },
            { question: 'What is your asset management strategy? What is your management fee on a percentage basis?', tips: ['Active vs. passive approach', 'Fee as % of revenue or equity'] },
            { question: 'Is your management fee covered by operating revenue?', tips: ['Show fee relative to NOI', 'Demonstrate sustainability'] },
            { question: 'How does this deal perform in a rising interest rate environment? What is your sensitivity to a 100 or 200 basis point increase?', tips: ['Show rate sensitivity table', 'Impact on DSCR and returns', 'Hedging strategy'] },
            { question: 'Are there any zoning, entitlement, or regulatory risks that could affect your business plan? What is the status of any required permits?', tips: ['Current zoning status', 'Required approvals', 'Timeline and risk of denial'] },
            { question: 'What is your tenant concentration? Do you have an anchor tenant?', tips: ['Top tenant as % of revenue', 'Lease expiration schedule'] },
            { question: 'What if your anchor tenant departs, what happens to your NOI and your ability to service debt?', tips: ['Quantify NOI impact', 'Show DSCR under stress', 'Re-leasing timeline and cost'] },
        ],
    },
];

interface InvestorQAPracticeProps {
    onExit: () => void;
}

export default function InvestorQAPractice({ onExit }: InvestorQAPracticeProps) {
    const [currentCategory, setCurrentCategory] = useState(0);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [showTips, setShowTips] = useState(true);

    const category = CATEGORIES[currentCategory];
    const q = category.questions[currentQuestion];
    const answerKey = `${currentCategory}-${currentQuestion}`;
    const totalQuestions = CATEGORIES.reduce((sum, c) => sum + c.questions.length, 0);
    const answeredCount = Object.values(answers).filter(a => a.trim().length > 0).length;

    // Flat question index for progress bar
    let flatIndex = 0;
    for (let i = 0; i < currentCategory; i++) flatIndex += CATEGORIES[i].questions.length;
    flatIndex += currentQuestion;
    const progressPercent = ((flatIndex + 1) / totalQuestions) * 100;

    function goNext() {
        if (currentQuestion < category.questions.length - 1) {
            setCurrentQuestion(c => c + 1);
        } else if (currentCategory < CATEGORIES.length - 1) {
            setCurrentCategory(c => c + 1);
            setCurrentQuestion(0);
        }
    }

    function goPrev() {
        if (currentQuestion > 0) {
            setCurrentQuestion(c => c - 1);
        } else if (currentCategory > 0) {
            setCurrentCategory(c => c - 1);
            setCurrentQuestion(CATEGORIES[currentCategory - 1].questions.length - 1);
        }
    }

    const isFirst = currentCategory === 0 && currentQuestion === 0;
    const isLast = currentCategory === CATEGORIES.length - 1 && currentQuestion === category.questions.length - 1;

    return (
        <div className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-6 sm:py-8 2xl:max-w-[1000px] 2xl:py-12">
            {/* Progress bar */}
            <div className="mb-6 2xl:mb-8">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-maroon-700 font-sans">
                        Question {flatIndex + 1} of {totalQuestions}
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

            {/* Category header */}
            <div className="mb-4 rounded-lg bg-maroon-50 border border-maroon-100 px-4 py-3 2xl:px-5 2xl:py-4">
                <h3 className="text-sm font-bold text-maroon-800 font-sans 2xl:text-base">{category.title}</h3>
                <p className="text-xs text-maroon-600 font-sans mt-0.5 italic 2xl:text-sm">{category.description}</p>
            </div>

            {/* Question card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 2xl:p-10">
                {/* Question */}
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
                        value={answers[answerKey] || ''}
                        onChange={(e) => setAnswers(prev => ({ ...prev, [answerKey]: e.target.value }))}
                        placeholder="Type your answer here, or practice speaking it aloud..."
                        className="w-full h-32 rounded-xl border-2 border-blue-200 bg-white p-4 text-sm text-gray-700 font-sans placeholder:text-gray-400 focus:border-blue-400 focus:outline-none resize-none 2xl:h-40 2xl:text-base 2xl:p-5"
                    />
                </div>

                {/* Tips toggle */}
                <button
                    onClick={() => setShowTips(!showTips)}
                    className="mb-4 flex items-center gap-2 rounded-lg border border-yellow-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-yellow-50 font-sans 2xl:text-base"
                >
                    <span>💡</span>
                    {showTips ? 'Hide Tips' : 'Show Tips'}
                </button>

                {/* Tips */}
                {showTips && (
                    <div className="rounded-xl border-2 border-yellow-200 bg-yellow-50/50 p-5 2xl:p-6">
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
                    {!isFirst && (
                        <button
                            onClick={goPrev}
                            className="rounded-lg border-2 border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 font-sans 2xl:px-6 2xl:py-3 2xl:text-base"
                        >
                            ← Previous
                        </button>
                    )}
                    {!isLast ? (
                        <button
                            onClick={goNext}
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

            {/* Category quick nav */}
            <div className="mt-6 flex flex-wrap gap-2 justify-center 2xl:mt-8">
                {CATEGORIES.map((cat, idx) => (
                    <button
                        key={idx}
                        onClick={() => { setCurrentCategory(idx); setCurrentQuestion(0); }}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition font-sans 2xl:text-sm 2xl:px-4 2xl:py-1.5 ${idx === currentCategory
                                ? 'bg-maroon-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        {cat.title.split('&')[0].trim()}
                    </button>
                ))}
            </div>
        </div>
    );
}
