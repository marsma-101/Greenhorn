import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import type { PromptTemplate } from '@greenhorn/shared';

const PERSONA_TEMPLATES = [
  { id: 'general', name: '通用助手', desc: '友好、简洁、全面' },
  { id: 'coder', name: '代码专家', desc: '专注代码、调试、最佳实践' },
  { id: 'translator', name: '翻译助手', desc: '专业翻译、多语言互译' },
  { id: 'teacher', name: '教师模式', desc: '循循善诱、详细解释' },
];

export default function PersonaTab() {
  const { settings, updateSettings, settingsLoaded } = useApp();
  const [persona, setPersona] = useState(settings.persona);
  const [saved, setSaved] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);

  // Sync when settings load
  useEffect(() => {
    if (settingsLoaded) setPersona(settings.persona);
  }, [settingsLoaded, settings.persona]);

  // Load user prompt templates
  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(data => setTemplates(data.templates || []))
      .catch(() => setTemplates([]));
  }, []);

  const applyTemplate = (t: PromptTemplate) => {
    setPersona(prev => {
      const base = (prev || '').trim();
      return base ? `${base}\n\n${t.content}` : t.content;
    });
  };

  const templateCategories = Array.from(new Set(templates.map(t => t.category))).sort();

  const handleSave = async () => {
    await updateSettings({ persona });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-xs text-[oklch(50%_0.02_145)] dark:text-[oklch(65%_0.02_145)] mb-1.5">
          角色描述
          <span className="ml-1 text-[oklch(55%_0.015_145)]">告诉 AI 应该扮演什么角色</span>
        </label>
        <textarea
          value={persona}
          onChange={e => setPersona(e.target.value)}
          placeholder="你是一个 Python 专家，擅长后端开发和 API 设计"
          rows={4}
          className="w-full px-3 py-2 rounded-lg border border-[oklch(85%_0.01_145)] dark:border-[oklch(30%_0.01_145)] bg-[oklch(95%_0.005_145)] dark:bg-[oklch(20%_0.005_145)] text-sm focus:outline-none focus:ring-2 focus:ring-[oklch(70%_0.1_145)] resize-none"
        />
      </div>

      <div>
        <p className="text-xs text-[oklch(50%_0.02_145)] dark:text-[oklch(65%_0.02_145)] mb-2">预设模板</p>
        <div className="grid grid-cols-2 gap-2">
          {PERSONA_TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => setPersona(`${t.name}，${t.desc}`)}
              className={`px-3 py-2 rounded-lg text-xs border transition-colors text-left ${
                persona === `${t.name}，${t.desc}`
                  ? 'bg-[oklch(85%_0.12_145)] dark:bg-[oklch(30%_0.1_145)] border-[oklch(70%_0.12_145)] text-[oklch(30%_0.12_145)] dark:text-[oklch(80%_0.12_145)]'
                  : 'border-[oklch(85%_0.01_145)] dark:border-[oklch(30%_0.01_145)] hover:border-[oklch(70%_0.08_145)]'
              }`}
            >
              <div className="font-medium">{t.name}</div>
              <div className="text-[10px] text-[oklch(55%_0.015_145)] mt-0.5">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {templates.length > 0 && (
        <div>
          <p className="text-xs text-[oklch(50%_0.02_145)] dark:text-[oklch(65%_0.02_145)] mb-2">提示词模板</p>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {templateCategories.map(cat => (
              <div key={cat}>
                <div className="text-[10px] text-[oklch(55%_0.015_145)] mb-1">{cat}</div>
                <div className="flex flex-wrap gap-2">
                  {templates.filter(t => t.category === cat).map(t => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t)}
                      className="px-2 py-1 rounded-md text-xs border border-[oklch(85%_0.01_145)] dark:border-[oklch(30%_0.01_145)] hover:border-[oklch(70%_0.08_145)] text-left"
                      title={t.description || t.name}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        className={`w-full px-3 py-2 rounded-lg text-white text-sm transition-opacity ${
          saved ? 'bg-[oklch(55%_0.15_145)]' : 'bg-[oklch(62%_0.15_145)] hover:opacity-90'
        }`}
      >
        {saved ? '✅ 已保存' : '保存'}
      </button>
    </div>
  );
}
