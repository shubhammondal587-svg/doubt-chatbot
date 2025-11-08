
import React, { createContext, useState, useContext, ReactNode } from 'react';
import type { ChatMessage } from '../types';

interface AppContextType {
  sharedImage: { data: string; mimeType: string } | null;
  setSharedImage: (image: { data: string; mimeType: string } | null) => void;
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sharedImage, setSharedImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
      { role: 'model', text: "Hello! How can I help you today?" }
  ]);

  return React.createElement(AppContext.Provider, { 
      value: { sharedImage, setSharedImage, chatHistory, setChatHistory } 
  }, children);
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};
