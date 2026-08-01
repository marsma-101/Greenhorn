import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

// ===== Types =====
interface Config {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
}

interface SessionMeta {
  id: string;
  title: string;
  time: string;
  messageCount: number;
}

export type UIStyle = 'default' | 'claude' | 'doubao';

interface AppSettings {
  hideThinkingBlock: boolean;
  defaultThinkingLevel: string;
  quietStartup: boolean;
  sessionDir: string;
  compaction: { enabled: boolean; reserveTokens: number };
  persona: string;
  enginePersonas: Record<string, string>;
  uiStyle: UIStyle;
}

interface AppContextValue {
  // Config
  config: Config;
  configLoaded: boolean;
  refreshConfig: () => Promise<void>;
  // Settings
  settings: AppSettings;
  settingsLoaded: boolean;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  // UI style
  uiStyle: UIStyle;
  setUIStyle: (style: UIStyle) => void;
  useSVG: boolean;
  // Sessions
  sessions: SessionMeta[];
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;
  refreshSessions: () => Promise<void>;
  createNewSession: () => Promise<string | null>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
}

const DEFAULT_CONFIG: Config = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
};

const DEFAULT_SETTINGS: AppSettings = {
  hideThinkingBlock: false,
  defaultThinkingLevel: 'off',
  quietStartup: false,
  sessionDir: '~/.pi/agent/sessions',
  compaction: { enabled: false, reserveTokens: 4096 },
  persona: '',
  enginePersonas: {},
  uiStyle: 'default',
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [uiStyle, setUIStyleState] = useState<UIStyle>('default');
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const useSVG = uiStyle === 'claude' || uiStyle === 'doubao';

  // Apply theme to <html> element so CSS vars take effect
  useEffect(() => {
    document.documentElement.setAttribute('data-ui-style', uiStyle);
  }, [uiStyle]);

  // Load config
  const refreshConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      const data: Config = await res.json();
      setConfig(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshConfig().then(() => setConfigLoaded(true));
  }, [refreshConfig]);

  // Load settings
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        const rawStyle = data.uiStyle;
        const style: UIStyle = (rawStyle === 'claude' || rawStyle === 'doubao') ? rawStyle : 'default';
        setSettings({
          hideThinkingBlock: data.hideThinkingBlock || false,
          defaultThinkingLevel: data.defaultThinkingLevel || 'off',
          quietStartup: data.quietStartup || false,
          sessionDir: data.sessionDir || '~/.pi/agent/sessions',
          compaction: {
            enabled: data.compaction?.enabled || false,
            reserveTokens: data.compaction?.reserveTokens || 4096,
          },
          persona: data.persona || '',
          enginePersonas: data.enginePersonas || {},
          uiStyle: style,
        });
        setUIStyleState(style);
        setSettingsLoaded(true);
      })
      .catch(() => setSettingsLoaded(true));
  }, []);

  // Load sessions
  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshSessions().then(() => {
      // Will be handled by ChatPage for initial session
    });
  }, [refreshSessions]);

  const setUIStyle = useCallback(async (style: UIStyle) => {
    setUIStyleState(style);
    const updated = { ...settings, uiStyle: style };
    setSettings(updated);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch {
      // ignore
    }
  }, [settings]);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const updated = { ...settings, ...partial };
    if (partial.compaction) {
      updated.compaction = { ...settings.compaction, ...partial.compaction };
    }
    setSettings(updated);
    if (partial.uiStyle !== undefined) {
      setUIStyleState(partial.uiStyle);
    }
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch {
      // ignore
    }
  }, [settings]);

  const createNewSession = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.session) {
        const meta: SessionMeta = {
          id: data.session.id,
          title: data.session.title,
          time: data.session.time,
          messageCount: 0,
        };
        setSessions(prev => [meta, ...prev]);
        setCurrentSessionId(data.session.id);
        return data.session.id;
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSessions(prev => prev.filter(s => s.id !== id));
      }
    } catch {
      // ignore
    }
  }, []);

  const renameSession = useCallback(async (id: string, title: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || '未命名会话' }),
      });
      const data = await res.json();
      if (data.success) {
        setSessions(prev => prev.map(s =>
          s.id === id ? { ...s, title: data.session.title } : s
        ));
      }
    } catch {
      // ignore
    }
  }, []);

  const value: AppContextValue = {
    config,
    configLoaded,
    refreshConfig,
    settings,
    settingsLoaded,
    updateSettings,
    uiStyle,
    setUIStyle,
    useSVG,
    sessions,
    currentSessionId,
    setCurrentSessionId,
    refreshSessions,
    createNewSession,
    deleteSession,
    renameSession,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
