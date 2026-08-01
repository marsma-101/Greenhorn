import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import SetupWizardPage from './pages/SetupWizardPage';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import PromptsPage from './pages/PromptsPage';
import SkillsPage from './pages/SkillsPage';
import SettingsPage from './pages/SettingsPage';
import DataDirPage from './pages/DataDirPage';
import AdvancedSettingsPage from './pages/AdvancedSettingsPage';

export default function App() {
  return (
    <div className="h-screen overflow-hidden">
      <Routes>
        <Route path="/setup" element={<SetupWizardPage />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/prompts" element={<PromptsPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/data-dir" element={<DataDirPage />} />
          <Route path="/settings/advanced" element={<AdvancedSettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
