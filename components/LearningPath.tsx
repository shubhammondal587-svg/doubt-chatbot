
import React, { useState } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { useAppContext } from '../context/AppContext';
import type { SessionSummary } from '../types';
import { Icon } from './Icon';
import { Spinner } from './Spinner';

interface LearningPathProps {
    summaries: SessionSummary[];
}

export const LearningPath: React.FC<LearningPathProps> = ({ summaries }) => {
    const { chatHistory } = useAppContext();
    const [learningPath, setLearningPath] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generatePath = async () => {
        if (!process.env.API_KEY) {
            setError("API Key not found.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setLearningPath(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            const summaryContent = summaries.map(s => `Session Summary (${s.date}):\n${s.content}`).join('\n\n---\n\n');
            const chatContent = chatHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n');
            const combinedHistory = `SESSION SUMMARIES:\n${summaryContent}\n\nCHAT HISTORY:\n${chatContent}`;
            
            if (combinedHistory.trim().length < 100) {
                 setError("Not enough interaction history to generate a meaningful learning path. Please complete more sessions or chat with the assistant.");
                 setIsLoading(false);
                 return;
            }

            const prompt = `Based on the following history of session summaries and chat interactions, analyze the user's learning journey. 
            Identify key topics of confusion or weak areas. 
            Then, generate a personalized learning path with three sections using Markdown formatting: 
            1. **Suggested Study Materials**: List specific concepts or topics to review.
            2. **Practice Exercises**: Suggest types of problems or questions to solve to reinforce learning.
            3. **Future Topics**: Propose what the user could learn next to build on their current knowledge.
            
            Keep the analysis concise and actionable.

            --- HISTORY ---
            ${combinedHistory}
            `;

            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: prompt,
            });

            setLearningPath(response.text);

        } catch (err) {
            console.error("Learning path generation error:", err);
            setError("Failed to generate learning path. Please try again later.");
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="h-full flex flex-col bg-gray-800 rounded-lg p-6 shadow-xl">
            <h1 className="text-2xl font-bold mb-2">Personalized Learning Path</h1>
            <p className="text-gray-400 mb-6">Let Gemini analyze your session and chat history to suggest next steps in your learning journey.</p>
            
            <div className="mb-6 text-center">
                <button
                    onClick={generatePath}
                    disabled={isLoading}
                    className="px-6 py-3 bg-purple-600 rounded-lg font-semibold hover:bg-purple-700 transition flex items-center justify-center gap-2 disabled:bg-gray-500 mx-auto"
                >
                    {isLoading ? <Spinner /> : <Icon icon="learning" className="h-5 w-5" />}
                    {learningPath ? 'Regenerate Path' : 'Generate My Learning Path'}
                </button>
            </div>

            <div className="flex-1 bg-gray-900 rounded-lg p-6 overflow-y-auto">
                {isLoading && (
                    <div className="text-center flex flex-col items-center justify-center h-full">
                        <Spinner size="h-12 w-12" />
                        <p className="mt-4 text-gray-400">Analyzing your progress...</p>
                    </div>
                )}
                {error && <p className="text-red-400 text-center my-4">{error}</p>}
                {learningPath && !isLoading && (
                     <pre className="text-left text-gray-300 whitespace-pre-wrap font-sans">
                        {learningPath}
                    </pre>
                )}
                 {!learningPath && !isLoading && !error && (
                    <div className="text-center text-gray-500 flex flex-col items-center justify-center h-full">
                        <Icon icon="learning" className="h-24 w-24 mx-auto mb-4" />
                        <p>Your personalized learning path will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
