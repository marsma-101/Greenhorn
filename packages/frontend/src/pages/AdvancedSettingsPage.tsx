import { useNavigate } from 'react-router-dom';

export default function AdvancedSettingsPage() {
  const navigate = useNavigate();
  
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/settings')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          ← 返回设置
        </button>
        <h1 className="text-xl font-semibold">高级设置</h1>
      </div>
      
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-6 text-center">
        <div className="text-4xl mb-3">🚧</div>
        <h3 className="text-lg font-semibold text-yellow-700 dark:text-yellow-300 mb-2">即将上线</h3>
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          高级设置正在开发中，后续版本会逐步开放 <br />
          PI 配置文件中的各项参数设置。
        </p>
      </div>
    </div>
  );
}