'use client';

import React from 'react';

export type ModuleTab = 'practice-lab' | 'note-card-exercise' | 'value-web-module' | 'investor-qa-practice';

interface ModuleTabsProps {
    activeTab: ModuleTab;
    onTabChange: (tab: ModuleTab) => void;
}

const tabs: { id: ModuleTab; label: string }[] = [
    { id: 'practice-lab', label: 'Practice Lab' },
    { id: 'note-card-exercise', label: 'Note Card Exercise' },
    { id: 'value-web-module', label: 'Value Web Module' },
    { id: 'investor-qa-practice', label: 'Investor Q&A Practice' },
];

export default function ModuleTabs({ activeTab, onTabChange }: ModuleTabsProps) {
    return (
        <nav className="w-full border-b border-gray-200 bg-white">
            <div className="mx-auto flex items-center gap-0 px-4 sm:px-6 lg:px-8 xl:px-12 overflow-x-auto scrollbar-hide">
                {tabs.map((tab) => {
                    const isActive = tab.id === activeTab;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`
                relative whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors font-sans
                ${isActive
                                    ? 'text-maroon-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-maroon-600'
                                    : 'text-gray-500 hover:text-gray-800'
                                }
              `}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
