
import React from 'react';
import type { Feature } from '../types';
import { FEATURE_LIVE, FEATURE_IMAGE_GEN, FEATURE_SUMMARIES, FEATURE_LEARNING_PATH } from '../constants';
import { Icon } from './Icon';

interface SideNavProps {
  activeFeature: Feature;
  setActiveFeature: (feature: Feature) => void;
}

const navItems = [
  { id: FEATURE_LIVE, name: 'Live Session', icon: 'live' },
  { id: FEATURE_IMAGE_GEN, name: 'Image Generation', icon: 'image-gen' },
  { id: FEATURE_SUMMARIES, name: 'Session Summaries', icon: 'summary' },
  { id: FEATURE_LEARNING_PATH, name: 'Learning Path', icon: 'learning' },
];

export const SideNav: React.FC<SideNavProps> = ({ activeFeature, setActiveFeature }) => {
  return (
    <nav className="w-20 md:w-64 bg-gray-800 p-2 md:p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-center md:justify-start mb-10">
          <Icon icon="chat-bubble" className="h-8 w-8 text-purple-400" />
          <h1 className="hidden md:block text-xl font-bold ml-2">Omni-Studio</h1>
        </div>
        <ul>
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => setActiveFeature(item.id)}
                className={`w-full flex items-center p-3 my-2 rounded-lg transition-colors duration-200 ${
                  activeFeature === item.id
                    ? 'bg-purple-500 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <Icon icon={item.icon} className="h-6 w-6" />
                <span className="hidden md:block ml-4 font-medium">{item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
       <div className="hidden md:block p-4 border-t border-gray-700 text-center text-xs text-gray-500">
          <p>Powered by Gemini</p>
          <p>&copy; 2024</p>
        </div>
    </nav>
  );
};
