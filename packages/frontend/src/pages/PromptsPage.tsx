import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { IconArrowLeft, IconPlus, IconEdit, IconTrash, IconDocument } from '../components/icons';
import type { PromptTemplate } from '@greenhorn/shared';

const EMPTY_TEMPLATE: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '',
  category: '',
  content: '',
  description: '',
};

export default function PromptsPage() {
  const { useSVG } = useApp();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState<PromptTemplate | null>(null);
  const [form, setForm] = useState(EMPTY_TEMPLATE);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [tRes, cRes] = await Promise.all([
        fetch('/api/templates'),
        fetch('/api/templates/categories'),
      ]);
      const tData = await tRes.json();
      const cData = await cRes.json();
      setTemplates(tData.templates || []);
      setCategories(cData.categories || []);
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
    return templates.filter(t => {
      const matchSearch =
        !s ||
        t.name.toLowerCase().includes(s) ||
        (t.description || '').toLowerCase().includes(s) ||
        t.content.toLowerCase().includes(s);
      const matchCategory = !category || t.category === category;
      return matchSearch && matchCategory;
    });
  }, [templates, search, category]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_TEMPLATE);
  };

  const openEdit = (t: PromptTemplate) => {
    setEditing(t);
    setForm({
      name: t.name,
      category: t.category,
      content: t.content,
      description: t.description || '',
    });
  };

  const closeForm = () => {
    setEditing(null);
    setForm(EMPTY_TEMPLATE);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.category.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      const url = editing ? `/api/templates/${editing.id}` : '/api/templates';
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
    if (!window.confirm('确定要删除这个模板吗？')) return;
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) await fetchData();
    } catch {
      // ignore
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
            {useSVG ? <IconDocument size={22} /> : <span style={{ fontSize: '1.25rem' }}>📝</span>}
            <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--c-text)' }}>提示词模板</h1>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="btn-primary flex items-center gap-1"
          style={{ padding: '6px 14px', borderRadius: 'var(--r-md)', fontSize: '0.875rem' }}
        >
          {useSVG ? <IconPlus size={16} /> : '＋'}
          新建模板
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b" style={{ borderColor: 'var(--c-border)' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="搜索模板..."
          className="flex-1 max-w-xs input-field"
          style={{ padding: '6px 12px', fontSize: '0.875rem' }}
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="input-field"
          style={{ padding: '6px 12px', fontSize: '0.875rem' }}
        >
          <option value="">全部分类</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center py-12" style={{ color: 'var(--c-text-soft)' }}>加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--c-text-soft)' }}>
            {templates.length === 0 ? '还没有模板，点击右上角创建' : '没有匹配的模板'}
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {filtered.map(t => (
              <div
                key={t.id}
                className="frosted-panel flex flex-col"
                style={{
                  padding: '16px',
                  borderRadius: 'var(--r-lg)',
                  border: '1px solid var(--c-border)',
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--c-text)' }}>{t.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--c-accent)', marginTop: 4 }}>{t.category}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(t)}
                      className="icon-btn"
                      title="编辑"
                    >
                      {useSVG ? <IconEdit size={16} /> : '✏️'}
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="icon-btn"
                      title="删除"
                    >
                      {useSVG ? <IconTrash size={16} /> : '🗑️'}
                    </button>
                  </div>
                </div>
                {t.description && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--c-text-soft)', marginBottom: 8 }}>
                    {t.description}
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
                  {t.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {(editing || form.name !== '' || form.category !== '' || form.content !== '') && (
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
                {editing ? '编辑模板' : '新建模板'}
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
                  placeholder="例如：代码审查"
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--c-text-soft)' }}>分类</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full input-field"
                  placeholder="例如：编程 / 写作"
                  list="prompt-categories"
                />
                <datalist id="prompt-categories">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
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
                <label className="block text-sm mb-1" style={{ color: 'var(--c-text-soft)' }}>内容</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  className="w-full input-field font-mono"
                  rows={10}
                  placeholder="输入提示词内容..."
                />
              </div>
            </div>
            <div
              className="flex justify-end gap-2 border-t px-6 py-4"
              style={{ borderColor: 'var(--c-border)' }}
            >
              <button onClick={closeForm} className="btn-secondary" style={{ padding: '6px 14px' }}>取消</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.category.trim() || !form.content.trim()}
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
