import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  IconDocument, IconGear, IconRobot, IconPalette,
  IconFolder, IconBolt, IconPin, IconX, IconLeaf,
  IconSparkles,
} from './icons';

interface SidebarProps {
  activeTab: string | null;
  pinned: boolean;
  onTabClick: (tabId: string) => void;
  onTogglePin: () => void;
  onClose: () => void;
}

const TABS = [
  { id: 'sessions', emoji: '📄', label: '对话管理', icon: IconDocument },
  { id: 'model', emoji: '⚙️', label: '模型设置', icon: IconGear },
  { id: 'persona', emoji: '🤖', label: '智能体', icon: IconRobot },
  { id: 'appearance', emoji: '🎨', label: '外观', icon: IconPalette },
  { id: 'workbench', emoji: '📁', label: '工作台', icon: IconFolder },
  { id: 'advanced', emoji: '⚡', label: '高级', icon: IconBolt },
] as const;

const NAV_ITEMS = [
  { path: '/prompts', emoji: '📝', label: '提示词', icon: IconDocument },
  { path: '/skills', emoji: '✨', label: '技能', icon: IconSparkles },
] as const;

import SessionTab from './tabs/SessionTab';
import ModelTab from './tabs/ModelTab';
import PersonaTab from './tabs/PersonaTab';
import AppearanceTab from './tabs/AppearanceTab';
import WorkbenchTab from './tabs/WorkbenchTab';
import AdvancedTab from './tabs/AdvancedTab';

export default function Sidebar({ activeTab, pinned, onTabClick, onTogglePin, onClose }: SidebarProps) {
  const { useSVG } = useApp();
  const location = useLocation();
  const isOpen = activeTab !== null;
  const activeDef = TABS.find(t => t.id === activeTab);

  return (
    <>
      {/* Icon column — always visible */}
      <div
        className="flex-shrink-0 flex flex-col items-center py-3 gap-1 border-r"
        style={{
          width: 'var(--w-icon-col)',
          backgroundColor: 'var(--c-bg-icon-col)',
          borderColor: 'var(--c-border)',
          boxShadow: 'var(--sh-sm)',
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: '8px' }} title="GreenHorn">
          {useSVG ? <IconLeaf size={22} /> : <span style={{ fontSize: '1.25rem' }}>🍃</span>}
        </div>

        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabClick(tab.id)}
              className={`tab-icon-btn ${isActive ? 'active' : ''}`}
              title={tab.label}
            >
              {useSVG ? <Icon size={20} /> : <span style={{ fontSize: '1.125rem' }}>{tab.emoji}</span>}
            </button>
          );
        })}

        <div className="flex-1" />

        {/* Page navigation */}
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => onClose()}
              className={`tab-icon-btn ${isActive ? 'active' : ''}`}
              title={item.label}
            >
              {useSVG ? <Icon size={20} /> : <span style={{ fontSize: '1.125rem' }}>{item.emoji}</span>}
            </Link>
          );
        })}
      </div>

      {/* Panel — slides in from left */}
      <div className={`flex-shrink-0 overflow-hidden sidebar-transition ${isOpen ? '' : ''}`}
        style={{ width: isOpen ? 'var(--w-panel)' : 0 }}
      >
        {isOpen && (
          <div
            className="h-full flex flex-col frosted-panel"
            style={{
              width: 'var(--w-panel)',
              borderRight: '1px solid var(--c-border)',
              boxShadow: 'var(--sh-md)',
            }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between border-b" style={{
              padding: '12px 16px',
              borderColor: 'var(--c-border)',
            }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--c-text)' }}>
                <span style={{ marginRight: '4px' }}>
                  {useSVG && activeDef
                    ? <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
                        <activeDef.icon size={16} />
                      </span>
                    : (activeDef?.emoji || '')}
                </span>
                {activeDef?.label}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={onTogglePin}
                  title={pinned ? '取消固定' : '固定侧边栏'}
                  style={{
                    width: 28, height: 28,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 'var(--r-sm)',
                    backgroundColor: pinned ? 'var(--c-bg-tab-active)' : 'transparent',
                    color: pinned ? 'var(--c-accent)' : 'var(--c-text-soft)',
                    cursor: 'pointer', border: 'none',
                    transition: 'background-color var(--dur-fast)',
                  }}
                  onMouseEnter={e => { if (!pinned) e.currentTarget.style.backgroundColor = 'var(--c-bg-session-item)'; }}
                  onMouseLeave={e => { if (!pinned) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  {useSVG ? <IconPin size={14} /> : '📌'}
                </button>
                {!pinned && (
                  <button
                    onClick={onClose}
                    title="关闭"
                    style={{
                      width: 28, height: 28,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 'var(--r-sm)',
                      color: 'var(--c-text-soft)',
                      cursor: 'pointer', border: 'none',
                      background: 'transparent',
                      transition: 'background-color var(--dur-fast)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-bg-session-item)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {useSVG ? <IconX size={14} /> : '✕'}
                  </button>
                )}
              </div>
            </div>

            {/* Panel content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {activeTab === 'sessions' && <SessionTab />}
              {activeTab === 'model' && <ModelTab />}
              {activeTab === 'persona' && <PersonaTab />}
              {activeTab === 'appearance' && <AppearanceTab />}
              {activeTab === 'workbench' && <WorkbenchTab />}
              {activeTab === 'advanced' && <AdvancedTab />}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
