import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppProvider } from '../context/AppContext';
import Sidebar from './Sidebar';

export default function MainLayout() {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);

  const handleTabClick = (tabId: string) => {
    if (activeTab === tabId) {
      // Same tab clicked - close (unless pinned)
      if (!pinned) setActiveTab(null);
    } else {
      setActiveTab(tabId);
    }
  };

  return (
    <AppProvider>
      <div className="flex h-screen overflow-hidden bg-[oklch(96%_0.006_145)] dark:bg-[oklch(13%_0.006_145)]">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          pinned={pinned}
          onTabClick={handleTabClick}
          onTogglePin={() => setPinned(!pinned)}
          onClose={() => setActiveTab(null)}
        />

        {/* Main content area — paper on desktop */}
        <main className="flex-1 flex flex-col min-w-0">
          <Outlet />
        </main>
      </div>
    </AppProvider>
  );
}
