import React from 'react';
import type { ChatMessage as ChatMessageType } from '../types';
import { Icon } from './Icon';
// Fix: Added missing import for Spinner component.
import { Spinner } from './Spinner';

interface ChatMessageProps {
  message: ChatMessageType;
  onPlayTTS?: (text: string) => void;
  isTTSLoading?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onPlayTTS, isTTSLoading }) => {
  const isModel = message.role === 'model';
  return (
    <div className={`flex items-start gap-3 my-4 ${isModel ? '' : 'flex-row-reverse'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isModel ? 'bg-purple-500' : 'bg-blue-500'}`}>
        {isModel ? 'G' : 'U'}
      </div>
      <div className={`p-4 rounded-lg max-w-lg ${isModel ? 'bg-gray-700' : 'bg-blue-600'}`}>
        {message.image && (
          <img src={message.image} alt="User upload" className="rounded-lg mb-2 max-h-60" />
        )}
        <p className="text-white whitespace-pre-wrap">{message.text}</p>
        {isModel && onPlayTTS && (
            <button onClick={() => onPlayTTS(message.text)} disabled={isTTSLoading} className="mt-2 p-1 rounded-full hover:bg-gray-600 disabled:opacity-50">
                {isTTSLoading ? <Spinner size="h-4 w-4" /> : <Icon icon="volume" className="h-4 w-4" />}
            </button>
        )}
        {message.sources && message.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-600">
                <h4 className="text-xs font-semibold text-gray-400 mb-1">Sources:</h4>
                <ul className="text-xs space-y-1">
                    {message.sources.map((source, index) => (
                        <li key={index}>
                            <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate">
                                {index + 1}. {source.title}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        )}
      </div>
    </div>
  );
};
