
import React, { useState } from 'react';
import { AppContextProvider } from './context/AppContext';
import { SideNav } from './components/SideNav';
import { LiveSession } from './components/LiveSession';
import { ImageGenerator } from './components/ImageGenerator';
import { FloatingChat } from './components/FloatingChat';
import type { Feature, SessionSummary } from './types';
import { FEATURE_LIVE, FEATURE_IMAGE_GEN, FEATURE_SUMMARIES, FEATURE_LEARNING_PATH } from './constants';
import { SessionSummaries } from './components/SessionSummaries';
import { LearningPath } from './components/LearningPath';


const App: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState<Feature>(FEATURE_LIVE);
  const [summaries, setSummaries] = useState<SessionSummary[]>([]);

  const handleSessionEnd = (summary: SessionSummary) => {
    setSummaries(prev => [...prev, summary]);
    setActiveFeature(FEATURE_SUMMARIES);
  }

  const renderActiveFeature = () => {
    switch (activeFeature) {
      case FEATURE_LIVE:
        return <LiveSession onSessionEnd={handleSessionEnd} />;
      case FEATURE_IMAGE_GEN:
        return <ImageGenerator />;
      case FEATURE_SUMMARIES:
        return <SessionSummaries summaries={summaries} />;
      case FEATURE_LEARNING_PATH:
        return <LearningPath summaries={summaries} />;
      default:
        return <LiveSession onSessionEnd={handleSessionEnd} />;
    }
  };

  return (
    <AppContextProvider>
      <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
        <SideNav activeFeature={activeFeature} setActiveFeature={setActiveFeature} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          {renderActiveFeature()}
        </main>
        <FloatingChat />
      </div>
    </AppContextProvider>
  );
};

export default App;
