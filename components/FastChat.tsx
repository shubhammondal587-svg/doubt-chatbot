
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat } from '@google/genai';
import { Icon } from './Icon';
import { ChatMessage } from './ChatMessage';
import { Spinner } from './Spinner';
import type { ChatMessage as ChatMessageType } from '../types';

export const FastChat: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessageType[]>([
        { role: 'model', text: "I'm optimized for quick responses. Let's chat!" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const chatInstanceRef = useRef<Chat | null>(null);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (process.env.API_KEY) {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            chatInstanceRef.current = ai.chats.create({
                model: 'gemini-flash-lite-latest'
            });
        }
    }, []);

    const handleSend = async () => {
        if (!input.trim() || isLoading || !chatInstanceRef.current) return;

        const userMessage: ChatMessageType = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        
        try {
            const response = await chatInstanceRef.current.sendMessage({ message: input });
            const modelMessage: ChatMessageType = { role: 'model', text: response.text };
            setMessages(prev => [...prev, modelMessage]);
        } catch (error) {
            console.error("Fast chat error:", error);
            const errorMessage: ChatMessageType = { role: 'model', text: "Sorry, I had trouble responding quickly." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-800 rounded-lg p-6 shadow-xl">
            <h1 className="text-2xl font-bold mb-2">Fast Chat</h1>
            <p className="text-gray-400 mb-6">Experience low-latency conversation with Gemini 2.5 Flash Lite.</p>

            <div ref={chatContainerRef} className="flex-1 overflow-y-auto pr-4">
                 {messages.map((msg, index) => <ChatMessage key={index} message={msg} />)}
                 {isLoading && (
                    <div className="flex justify-start items-center gap-3 my-4">
                        <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-sm font-bold">G</div>
                        <div className="p-4 rounded-lg bg-gray-700">
                            <Spinner />
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
                        placeholder="Ask me anything..."
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
