import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function DataDirPage() {
  const navigate = useNavigate();
  const [sourcePath, setSourcePath] = useState('');
  const [configPath, setConfigPath] = useState('');
  const [hasOldConfig, setHasOldConfig] = useState(false);
  const [oldConfigPath, setOldConfigPath] = useState('');
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    fetch('/api/data-dir')
      .then(res => res.json())
      .then(data => {
        setSourcePath(data.sourcePath || '');
        setConfigPath(data.configPath || '');
        setHasOldConfig(data.hasOldConfig);
        setOldConfigPath(data.oldConfigPath);
      })
      .catch(() => {});
  }, []);
  
  const handleSave = async () => {
    if (!sourcePath || !configPath) return;
    setSaving(true);
    try {
      await fetch('/api/data-dir', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath, configPath }),
      });
      navigate('/');
    } catch {
      // 保存失败处理
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          ← 返回
        </button>
        <h1 className="text-xl font-semibold">选择文件保存位置</h1>
      </div>
      
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-4 mb-6">
        <p className="text-sm text-yellow-700 dark:text-yellow-300">
          💡 PI 需要存储以下文件，默认会存在 C 盘，建议改到其他盘
        </p>
        <ul className="text-sm text-yellow-600 dark:text-yellow-400 mt-2 list-disc list-inside">
          <li>配置文件（模型、API Key、设置等）</li>
          <li>会话记录</li>
          <li>PI 源码（项目代码）</li>
        </ul>
      </div>
      
      {hasOldConfig && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            📂 检测到 C 盘已有 PI 配置（{oldConfigPath}），保存后自动指向新位置
          </p>
        </div>
      )}
      
      <div className="space-y-6">
        {/* PI 源码路径 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium mb-2">PI 项目代码保存位置</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={sourcePath}
              onChange={e => setSourcePath(e.target.value)}
              placeholder="例如：D:\GreenHorn\pi-source"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">PI 源码会克隆到这个目录</p>
        </div>
        
        {/* PI 配置路径 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium mb-2">PI 配置数据保存位置</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={configPath}
              onChange={e => setConfigPath(e.target.value)}
              placeholder="例如：D:\GreenHorn\pi-config"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">配置文件、会话记录等会存到这个目录</p>
        </div>
      </div>
      
      <button
        onClick={handleSave}
        disabled={saving || !sourcePath || !configPath}
        className="mt-6 w-full px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-xl transition-colors"
      >
        {saving ? '保存中...' : '确认并开始安装'}
      </button>
    </div>
  );
}