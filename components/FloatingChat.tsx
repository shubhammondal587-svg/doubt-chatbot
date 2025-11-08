
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse, Modality } from '@google/genai';
import { Icon } from './Icon';
import { ChatMessage } from './ChatMessage';
import { Spinner } from './Spinner';
import type { ChatMessage as ChatMessageType } from '../types';
import { useAppContext } from '../context/AppContext';
import { decode, decodeAudioData } from '../utils/audio';

// Gemini Service Wrapper
class GeminiChatService {
  private ai: GoogleGenAI;
  private chat: Chat | null = null;
  private ttsAudioContext: AudioContext | null = null;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  private initializeChat() {
    this.chat = this.ai.chats.create({
      model: 'gemini-2.5-flash',
    });
  }
  
  public async sendMessage(prompt: string, imagePart: {inlineData: {data: string, mimeType: string}} | null): Promise<string> {
    if (!this.chat) {
      this.initializeChat();
    }
    
    const contents = [];
    if (imagePart) {
      contents.push(imagePart);
    }
    contents.push({ text: prompt });

    const response: GenerateContentResponse = await this.chat!.sendMessage({ contents: { parts: contents }});
    return response.text;
  }

  public async generateTTS(text: string): Promise<AudioBuffer | null> {
    if (!this.ttsAudioContext) {
      this.ttsAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    }
    const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
    });
    
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioBytes = decode(base64Audio);
      return await decodeAudioData(audioBytes, this.ttsAudioContext, 24000, 1);
    }
    return null;
  }

  public playAudio(buffer: AudioBuffer) {
    if (!this.ttsAudioContext) return;
    const source = this.ttsAudioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ttsAudioContext.destination);
    source.start();
  }
}


export const FloatingChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const { chatHistory: messages, setChatHistory: setMessages, setSharedImage } = useAppContext();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTTSLoading, setIsTTSLoading] = useState(false);
  const [image, setImage] = useState<{file: File, preview: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const geminiService = useRef<GeminiChatService | null>(null);

  useEffect(() => {
    if (process.env.API_KEY) {
      geminiService.current = new GeminiChatService(process.env.API_KEY);
    }
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage({file, preview: URL.createObjectURL(file)});
    }
  };

  const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    const base64Data = await base64EncodedDataPromise;
    setSharedImage({ data: base64Data, mimeType: file.type });
    return {
      inlineData: { data: base64Data, mimeType: file.type }
    };
  };

  const handleSend = async () => {
    if ((!input.trim() && !image) || isLoading || !geminiService.current) return;
    
    setIsLoading(true);
    const userMessage: ChatMessageType = { role: 'user', text: input, image: image?.preview };
    setMessages(prev => [...prev, userMessage]);

    let imagePart = null;
    if (image) {
      imagePart = await fileToGenerativePart(image.file);
    }

    try {
      const responseText = await geminiService.current.sendMessage(input, imagePart);
      const modelMessage: ChatMessageType = { role: 'model', text: responseText };
      setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: ChatMessageType = { role: 'model', text: "Sorry, I encountered an error." };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setInput('');
      setImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePlayTTS = async (text: string) => {
    if (!geminiService.current) return;
    setIsTTSLoading(true);
    try {
        const audioBuffer = await geminiService.current.generateTTS(text);
        if (audioBuffer) {
            geminiService.current.playAudio(audioBuffer);
        }
    } catch (error) {
        console.error("TTS Error:", error);
    } finally {
        setIsTTSLoading(false);
    }
  };


  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 bg-purple-600 p-4 rounded-full shadow-lg hover:bg-purple-700 transition-transform transform hover:scale-110"
      >
        <Icon icon="chat-bubble" className="h-8 w-8 text-white" />
      </button>
    );
  }

  return (
    <div className="w-full max-w-sm h-[95vh] m-4 bg-gray-800 rounded-2xl shadow-2xl flex flex-col border border-gray-700">
      <header className="flex items-center justify-between p-4 bg-gray-700 rounded-t-2xl">
        <h2 className="text-lg font-bold">Gemini Chat</h2>
        <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-gray-600">
          <Icon icon="close" className="h-5 w-5" />
        </button>
      </header>
      
      <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto">
        {messages.map((msg, index) => (
          <ChatMessage key={index} message={msg} onPlayTTS={handlePlayTTS} isTTSLoading={isTTSLoading}/>
        ))}
        {isLoading && (
          <div className="flex justify-start items-center gap-3 my-4">
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-sm font-bold">G</div>
            <div className="p-4 rounded-lg bg-gray-700">
              <Spinner />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-700">
        {image && (
          <div className="relative mb-2">
            <img src={image.preview} alt="preview" className="h-20 w-20 rounded-lg object-cover" />
            <button onClick={() => { setImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 text-xs">
              <Icon icon="close" className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="flex items-center bg-gray-700 rounded-lg p-2">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageChange}
            className="hidden"
          />
          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-white">
            <Icon icon="image" className="h-6 w-6" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message..."
            className="flex-1 bg-transparent focus:outline-none px-2"
          />
          <button onClick={handleSend} disabled={isLoading} className="p-2 rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-500">
            {isLoading ? <Spinner size="h-6 w-6" /> : <Icon icon="send" className="h-6 w-6" />}
          </button>
        </div>
      </div>
    </div>
  );
};
