
import React, { useState, useEffect } from 'react';
import type { SessionSummary } from '../types';
import { Icon } from './Icon';

interface SessionSummariesProps {
    summaries: SessionSummary[];
}

export const SessionSummaries: React.FC<SessionSummariesProps> = ({ summaries }) => {
    const [selectedSummary, setSelectedSummary] = useState<SessionSummary | null>(null);

    useEffect(() => {
        if (summaries.length > 0 && !selectedSummary) {
            setSelectedSummary(summaries[summaries.length - 1]);
        }
    }, [summaries, selectedSummary]);

    if (summaries.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-gray-800 rounded-lg p-6 shadow-xl text-gray-500">
                <Icon icon="summary" className="h-24 w-24 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-gray-300">No Session Summaries Yet</h1>
                <p className="mt-2">Complete a live session to see an AI-generated summary here.</p>
            </div>
        );
    }
    
    return (
        <div className="h-full flex flex-col bg-gray-800 rounded-lg shadow-xl">
            <header className="p-6 border-b border-gray-700">
                <h1 className="text-2xl font-bold">Session Summaries</h1>
                <p className="text-gray-400">Review the key points from your past live sessions.</p>
            </header>
            <div className="flex-1 flex min-h-0">
                <aside className="w-full md:w-1/3 border-r border-gray-700 overflow-y-auto">
                    <ul>
                        {summaries.slice().reverse().map(summary => (
                            <li key={summary.id}>
                                <button 
                                    onClick={() => setSelectedSummary(summary)}
                                    className={`w-full text-left p-4 hover:bg-gray-700 transition-colors duration-150 ${selectedSummary?.id === summary.id ? 'bg-purple-600/30 border-l-4 border-purple-500' : 'border-l-4 border-transparent'}`}
                                >
                                    <h3 className="font-semibold text-white truncate">{summary.title}</h3>
                                    <p className="text-sm text-gray-400">{summary.date}</p>
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>
                <main className="hidden md:block w-2/3 p-6 overflow-y-auto">
                    {selectedSummary ? (
                        <div>
                            <h2 className="text-xl font-bold mb-2">{selectedSummary.title}</h2>
                            <p className="text-sm text-gray-500 mb-4">{selectedSummary.date}</p>
                            <pre className="text-gray-300 whitespace-pre-wrap font-sans">
                                {selectedSummary.content}
                            </pre>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            <p>Select a summary to view its details.</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};
