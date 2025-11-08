
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { Icon } from './Icon';
import { ChatMessage } from './ChatMessage';
import { Spinner } from './Spinner';
import type { ChatMessage as ChatMessageType } from '../types';

export const ThinkingChat: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessageType[]>([
        { role: 'model', text: 'Ask me a complex question. I will use my advanced reasoning capabilities to find an answer.' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading || !process.env.API_KEY) return;

        const userMessage: ChatMessageType = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: input,
                config: {
                    thinkingConfig: { thinkingBudget: 32768 }
                },
            });
            const modelMessage: ChatMessageType = { role: 'model', text: response.text };
            setMessages(prev => [...prev, modelMessage]);
        } catch (error) {
            console.error("Complex query error:", error);
            const errorMessage: ChatMessageType = { role: 'model', text: "Sorry, I couldn't process that complex query." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-800 rounded-lg p-6 shadow-xl">
            <h1 className="text-2xl font-bold mb-2">Complex Q&A</h1>
            <p className="text-gray-400 mb-6">Powered by Gemini 2.5 Pro with maximum thinking budget for deep analysis.</p>

            <div ref={chatContainerRef} className="flex-1 overflow-y-auto pr-4">
                 {messages.map((msg, index) => <ChatMessage key={index} message={msg} />)}
                 {isLoading && (
                    <div className="flex justify-start items-center gap-3 my-4">
                        <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-sm font-bold">G</div>
                        <div className="p-4 rounded-lg bg-gray-700 flex items-center gap-2">
                            <Spinner />
                            <span className="text-gray-300 animate-pulse-fast">Thinking...</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-700">
                <div className="flex items-center bg-gray-700 rounded-lg p-2">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="e.g., Explain the theory of relativity as if I'm five..."
                        className="flex-1 bg-transparent focus:outline-none px-2 resize-none h-12 max-h-40"
                        rows={1}
                    />
                    <button onClick={handleSend} disabled={isLoading} className="p-3 rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-500">
                        {isLoading ? <Spinner size="h-6 w-6" /> : <Icon icon="send" className="h-6 w-6" />}
                    </button>
                </div>
            </div>
        </div>
    );
};
