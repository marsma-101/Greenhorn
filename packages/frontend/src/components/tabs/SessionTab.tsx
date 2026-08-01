import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { IconPlus, IconEdit, IconTrash } from '../icons';

export default function SessionTab() {
  const { sessions, currentSessionId, setCurrentSessionId, createNewSession, deleteSession, renameSession, useSVG } = useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');

  const handleCreate = async () => {
    await createNewSession();
  };

  const handleSwitch = (id: string) => {
    if (id !== currentSessionId) {
      setCurrentSessionId(id);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定删除这个会话吗？')) return;
    await deleteSession(id);
  };

  const startEditing = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setTempTitle(title);
  };

  const saveEditing = async () => {
    if (editingId) {
      await renameSession(editingId, tempTitle);
    }
    setEditingId(null);
  };

  const sessionItemStyle = (active: boolean) => ({
    padding: '10px 12px',
    borderRadius: 'var(--r-md)',
    cursor: 'pointer',
    transition: 'background-color var(--dur-fast)',
    backgroundColor: active ? 'var(--c-bg-tab-active)' : 'transparent',
    color: active ? 'var(--c-accent)' : 'var(--c-text)',
  });

  return (
    <div style={{ padding: '12px' }}>
      <button
        onClick={handleCreate}
        style={{
          width: '100%',
          padding: '10px 12px',
          marginBottom: '12px',
          borderRadius: 'var(--r-md)',
          backgroundColor: 'var(--c-bg-save)',
          color: 'var(--c-text-inverse)',
          fontSize: '0.875rem',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'opacity var(--dur-fast)',
          border: 'none',
          cursor: 'pointer',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        {useSVG ? <IconPlus size={16} /> : <span style={{ fontSize: '1rem' }}>＋</span>}
        新建对话
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {sessions.length === 0 && (
          <div style={{ padding: '32px 12px', textAlign: 'center', fontSize: '0.875rem', color: 'var(--c-text-muted)' }}>
            暂无会话记录
          </div>
        )}

        {sessions.map(session => (
          <div
            key={session.id}
            onClick={() => handleSwitch(session.id)}
            style={sessionItemStyle(session.id === currentSessionId)}
            onMouseEnter={e => {
              if (session.id !== currentSessionId) e.currentTarget.style.backgroundColor = 'var(--c-bg-session-item)';
            }}
            onMouseLeave={e => {
              if (session.id !== currentSessionId) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {editingId === session.id ? (
              <input
                type="text"
                value={tempTitle}
                onChange={e => setTempTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveEditing();
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onBlur={saveEditing}
                autoFocus
                onClick={e => e.stopPropagation()}
                className="ui-input"
                style={{ padding: '4px 8px', fontSize: '0.875rem' }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {session.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--c-text-muted)', marginTop: '2px' }}>
                    {new Date(session.time).toLocaleString('zh-CN', {
                      month: 'numeric', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                    {session.messageCount > 0 && ` · ${session.messageCount}条`}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                  <button
                    onClick={e => startEditing(session.id, session.title, e)}
                    title="重命名"
                    style={{
                      width: 24, height: 24,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 'var(--r-xs)',
                      color: 'var(--c-text-soft)',
                      background: 'transparent',
                      cursor: 'pointer',
                      border: 'none',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-bg-session-item)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {useSVG ? <IconEdit size={14} /> : <span style={{ fontSize: '0.75rem' }}>✏️</span>}
                  </button>
                  <button
                    onClick={e => handleDelete(session.id, e)}
                    title="删除"
                    style={{
                      width: 24, height: 24,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 'var(--r-xs)',
                      color: 'var(--c-text-soft)',
                      background: 'transparent',
                      cursor: 'pointer',
                      border: 'none',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-bg-session-item)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {useSVG ? <IconTrash size={14} /> : <span style={{ fontSize: '0.75rem' }}>🗑️</span>}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
