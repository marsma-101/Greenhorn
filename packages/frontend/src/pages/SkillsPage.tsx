import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { IconArrowLeft, IconPlus, IconEdit, IconTrash, IconSparkles } from '../components/icons';
import type { Skill } from '@greenhorn/shared';

const EMPTY_SKILL: Omit<Skill, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  prompt: '',
  trigger: '',
  enabled: true,
};

export default function SkillsPage() {
  const { useSVG } = useApp();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Skill | null>(null);
  const [form, setForm] = useState(EMPTY_SKILL);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importPath, setImportPath] = useState('');
  const [scanResults, setScanResults] = useState<Array<{ path: string; name: string; type: string }>>([]);
  const [importing, setImporting] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/skills');
      const data = await res.json();
      setSkills(data.skills || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return skills;
    return skills.filter(sk =>
      sk.name.toLowerCase().includes(s) ||
      (sk.description || '').toLowerCase().includes(s) ||
      sk.trigger.toLowerCase().includes(s)
    );
  }, [skills, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_SKILL);
  };

  const openEdit = (s: Skill) => {
    setEditing(s);
    setForm({
      name: s.name,
      description: s.description || '',
      prompt: s.prompt,
      trigger: s.trigger,
      enabled: s.enabled,
    });
  };

  const closeForm = () => {
    setEditing(null);
    setForm(EMPTY_SKILL);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.prompt.trim() || !form.trigger.trim()) return;
    setSaving(true);
    try {
      const url = editing ? `/api/skills/${editing.id}` : '/api/skills';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        closeForm();
        await fetchData();
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定要删除这个技能吗？')) return;
    try {
      const res = await fetch(`/api/skills/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) await fetchData();
    } catch {
      // ignore
    }
  };

  const toggleEnabled = async (s: Skill) => {
    try {
      const res = await fetch(`/api/skills/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...s, enabled: !s.enabled }),
      });
      const data = await res.json();
      if (data.success) await fetchData();
    } catch {
      // ignore
    }
  };

  const handleScan = async () => {
    if (!importPath.trim()) return;
    try {
      const res = await fetch('/api/skills/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: importPath.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setScanResults(data.results || []);
      }
    } catch {
      // ignore
    }
  };

  const handleImport = async (sourcePath: string) => {
    setImporting(true);
    try {
      const res = await fetch('/api/skills/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`导入成功：${data.skill.name}`);
        setScanResults(prev => prev.filter(r => r.path !== sourcePath));
        await fetchData();
      } else {
        alert(data.message || '导入失败');
      }
    } catch {
      alert('导入失败');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--c-bg-main)' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--c-border)' }}>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center"
            style={{
              width: 32, height: 32, borderRadius: 'var(--r-sm)',
              color: 'var(--c-text-soft)',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--c-bg-session-item)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {useSVG ? <IconArrowLeft size={20} /> : '←'}
          </Link>
          <div className="flex items-center gap-2">
            {useSVG ? <IconSparkles size={22} /> : <span style={{ fontSize: '1.25rem' }}>✨</span>}
            <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--c-text)' }}>技能管理</h1>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="btn-primary flex items-center gap-1"
          style={{ padding: '6px 14px', borderRadius: 'var(--r-md)', fontSize: '0.875rem' }}
        >
          {useSVG ? <IconPlus size={16} /> : '＋'}
          新建技能
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b" style={{ borderColor: 'var(--c-border)' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索技能..."
          className="flex-1 max-w-xs input-field"
          style={{ padding: '6px 12px', fontSize: '0.875rem' }}
        />
        <button
          onClick={() => setShowImport(v => !v)}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
        >
          {showImport ? '取消导入' : '📂 从文件夹导入'}
        </button>
      </div>

      {/* Import panel */}
      {showImport && (
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-bg-session-item)' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <input
              type="text"
              value={importPath}
              onChange={e => setImportPath(e.target.value)}
              placeholder="输入外部文件夹路径，如 D:\my-skills"
              className="flex-1 input-field"
              style={{ padding: '6px 12px', fontSize: '0.875rem' }}
            />
            <button
              onClick={handleScan}
              className="btn-primary"
              style={{ padding: '6px 16px', fontSize: '0.875rem' }}
            >
              扫描
            </button>
          </div>
          {scanResults.length > 0 && (
            <div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--c-text-soft)', marginBottom: '8px' }}>
                发现 {scanResults.length} 个技能：
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {scanResults.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--c-border)',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.name}</div>
                      <div style={{ color: 'var(--c-text-soft)', fontSize: '0.75rem' }}>{r.path}</div>
                    </div>
                    <button
                      onClick={() => handleImport(r.path)}
                      disabled={importing}
                      className="btn-primary"
                      style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                    >
                      {importing ? '导入中...' : '导入'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center py-12" style={{ color: 'var(--c-text-soft)' }}>加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--c-text-soft)' }}>
            {skills.length === 0 ? '还没有技能，点击右上角创建' : '没有匹配的技能'}
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {filtered.map(s => (
              <div
                key={s.id}
                className="frosted-panel flex flex-col"
                style={{
                  padding: '16px',
                  borderRadius: 'var(--r-lg)',
                  border: '1px solid var(--c-border)',
                  opacity: s.enabled ? 1 : 0.7,
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--c-text)' }}>{s.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--c-accent)', marginTop: 4 }}>
                      触发词：{s.trigger || '无'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(s)} className="icon-btn" title="编辑">
                      {useSVG ? <IconEdit size={16} /> : '✏️'}
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="icon-btn" title="删除">
                      {useSVG ? <IconTrash size={16} /> : '🗑️'}
                    </button>
                  </div>
                </div>
                {s.description && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--c-text-soft)', marginBottom: 8 }}>
                    {s.description}
                  </div>
                )}
                <div
                  className="text-sm font-mono whitespace-pre-wrap flex-1"
                  style={{
                    color: 'var(--c-text)',
                    backgroundColor: 'var(--c-bg-message-user)',
                    padding: '8px 10px',
                    borderRadius: 'var(--r-md)',
                    maxHeight: 120,
                    overflow: 'auto',
                  }}
                >
                  {s.prompt}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--c-text-soft)' }}>
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={() => toggleEnabled(s)}
                      className="accent-[var(--c-accent)]"
                    />
                    {s.enabled ? '已启用' : '已禁用'}
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {(editing || form.name !== '' || form.prompt !== '' || form.trigger !== '') && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
        >
          <div
            className="frosted-panel w-full max-w-2xl flex flex-col"
            style={{
              maxHeight: '90vh',
              borderRadius: 'var(--r-lg)',
              border: '1px solid var(--c-border)',
            }}
          >
            <div
              className="flex items-center justify-between border-b px-6 py-4"
              style={{ borderColor: 'var(--c-border)' }}
            >
              <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--c-text)' }}>
                {editing ? '编辑技能' : '新建技能'}
              </h2>
              <button onClick={closeForm} className="icon-btn">
                {useSVG ? <IconTrash size={18} /> : '✕'}
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--c-text-soft)' }}>名称</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full input-field"
                  placeholder="例如：解释代码"
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--c-text-soft)' }}>触发词</label>
                <input
                  type="text"
                  value={form.trigger}
                  onChange={e => setForm({ ...form, trigger: e.target.value })}
                  className="w-full input-field"
                  placeholder="例如：解释 / alwaysOn"
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--c-text-very-soft)', marginTop: 4 }}>
                  用户消息包含该词时自动注入技能 Prompt；填 alwaysOn 则每条消息都注入
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--c-text-soft)' }}>描述（可选）</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full input-field"
                  placeholder="一句话说明用途"
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--c-text-soft)' }}>技能 Prompt</label>
                <textarea
                  value={form.prompt}
                  onChange={e => setForm({ ...form, prompt: e.target.value })}
                  className="w-full input-field font-mono"
                  rows={10}
                  placeholder="输入触发时要追加给模型的指令..."
                />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--c-text-soft)' }}>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={e => setForm({ ...form, enabled: e.target.checked })}
                  className="accent-[var(--c-accent)]"
                />
                启用该技能
              </label>
            </div>
            <div
              className="flex justify-end gap-2 border-t px-6 py-4"
              style={{ borderColor: 'var(--c-border)' }}
            >
              <button onClick={closeForm} className="btn-secondary" style={{ padding: '6px 14px' }}>取消</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.prompt.trim() || !form.trigger.trim()}
                className="btn-primary"
                style={{ padding: '6px 14px' }}
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
