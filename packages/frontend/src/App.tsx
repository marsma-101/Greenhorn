import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import DataDirPage from './pages/DataDirPage';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/chat/:sessionId?" element={<ChatPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/data-dir" element={<DataDirPage />} />
      </Routes>
    </div>
  );
}