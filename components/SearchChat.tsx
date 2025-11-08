
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { Icon } from './Icon';
import { ChatMessage } from './ChatMessage';
import { Spinner } from './Spinner';
import type { ChatMessage as ChatMessageType, GroundingSource } from '../types';

export const SearchChat: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessageType[]>([
        { role: 'model', text: 'What current information are you looking for? I can search the web for the latest answers.' }
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
                model: 'gemini-2.5-flash',
                contents: input,
                config: {
                    tools: [{ googleSearch: {} }],
                },
            });
            
            const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
            const sources: GroundingSource[] = groundingChunks ? groundingChunks
                .filter((chunk: any) => chunk.web && chunk.web.uri && chunk.web.title)
                .map((chunk: any) => ({
                    uri: chunk.web.uri,
                    title: chunk.web.title
                })) : [];

            const modelMessage: ChatMessageType = { role: 'model', text: response.text, sources: sources };
            setMessages(prev => [...prev, modelMessage]);
        } catch (error) {
            console.error("Search query error:", error);
            const errorMessage: ChatMessageType = { role: 'model', text: "Sorry, I couldn't perform the search." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-800 rounded-lg p-6 shadow-xl">
            <h1 className="text-2xl font-bold mb-2">Search Grounded Chat</h1>
            <p className="text-gray-400 mb-6">Get up-to-date answers with information from Google Search.</p>

            <div ref={chatContainerRef} className="flex-1 overflow-y-auto pr-4">
                 {messages.map((msg, index) => <ChatMessage key={index} message={msg} />)}
                 {isLoading && (
                    <div className="flex justify-start items-center gap-3 my-4">
                        <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-sm font-bold">G</div>
                        <div className="p-4 rounded-lg bg-gray-700 flex items-center gap-2">
                            <Spinner />
                            <span className="text-gray-300">Searching the web...</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-700">
                <div className="flex items-center bg-gray-700 rounded-lg p-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="e.g., Who won the latest F1 race?"
                        className="flex-1 bg-transparent focus:outline-none px-2"
                    />
                    <button onClick={handleSend} disabled={isLoading} className="p-3 rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-500">
                        {isLoading ? <Spinner size="h-6 w-6" /> : <Icon icon="send" className="h-6 w-6" />}
                    </button>
                </div>
            </div>
        </div>
    );
};
