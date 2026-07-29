/**
 * GreenHorn 启动器
 * 
 * 1. 启动一个轻量 Web 服务器（端口 3001）
 * 2. 在浏览器打开启动界面 → 用户点按钮
 * 3. 启动 GreenHorn 后端
 * 4. 检测后端就绪 → 自动跳转到应用
 */
import express from 'express';
import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3001;
const BACKEND_PORT = 3000;
const APP_URL = `http://localhost:5173`;
const PROJECT_DIR = path.resolve(__dirname, '..');

let backendProcess = null;

const app = express();

// serve 启动器 HTML
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🍃 GreenHorn 启动器</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card {
    background: white;
    border-radius: 24px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.08);
    padding: 48px;
    max-width: 520px;
    width: 90%;
    text-align: center;
  }
  .logo { font-size: 56px; margin-bottom: 12px; }
  h1 { font-size: 28px; color: #166534; margin-bottom: 8px; }
  .subtitle { color: #6b7280; font-size: 15px; line-height: 1.6; margin-bottom: 32px; }
  .step-list { text-align: left; margin-bottom: 32px; }
  .step { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
  .step-num {
    background: #dcfce7; color: #166534; font-weight: 700;
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; font-size: 14px;
  }
  .step-text { font-size: 14px; color: #374151; line-height: 1.5; }
  .step-text strong { color: #166534; }
  .btn-start {
    display: inline-flex; align-items: center; gap: 8px;
    background: #22c55e; color: white; border: none;
    padding: 16px 40px; border-radius: 14px; font-size: 18px;
    font-weight: 600; cursor: pointer; transition: all 0.2s;
    width: 100%; justify-content: center;
  }
  .btn-start:hover { background: #16a34a; transform: translateY(-1px); box-shadow: 0 8px 25px rgba(34,197,94,0.3); }
  .btn-start:disabled { background: #9ca3af; cursor: not-allowed; transform: none; box-shadow: none; }
  .status {
    margin-top: 20px; padding: 12px 16px; border-radius: 12px;
    font-size: 14px; display: none;
  }
  .status.loading { display: block; background: #fef9c3; color: #854d0e; }
  .status.success { display: block; background: #dcfce7; color: #166534; }
  .status.error { display: block; background: #fee2e2; color: #991b1b; }
  .tips { margin-top: 24px; font-size: 13px; color: #9ca3af; line-height: 1.6; }
  .log-box {
    margin-top: 16px; background: #1f2937; color: #d1d5db;
    padding: 12px; border-radius: 8px; font-size: 12px;
    font-family: monospace; text-align: left; max-height: 120px;
    overflow-y: auto; display: none; white-space: pre-wrap;
  }
</style>
</head>
<body>
<div class="card">
  <div class="logo">🍃</div>
  <h1>GreenHorn</h1>
  <p class="subtitle">小白也能用的 AI 智能体 · 一键启动</p>
  
  <div class="step-list">
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-text"><strong>点一下按钮</strong> — 自动启动后端服务，等几秒就行</div>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-text"><strong>选 Ollama（推荐）</strong> — 本机运行，免费不用注册</div>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <div class="step-text"><strong>开始对话</strong> — 让 AI 帮你干活</div>
    </div>
  </div>

  <button class="btn-start" id="btnStart">🚀 启动 GreenHorn</button>

  <div class="status" id="status"><span id="statusText"></span></div>
  <div class="log-box" id="logBox"></div>

  <div class="tips">
    关闭此页面不会停止服务。<br>
    要完全关闭，请关掉命令行窗口。
  </div>
</div>

<script>
const btn = document.getElementById('btnStart');
const status = document.getElementById('status');
const statusText = document.getElementById('statusText');
const logBox = document.getElementById('logBox');

btn.onclick = startGreenHorn;

// 页面加载时检查后端是否已运行
checkBackend();

async function checkBackend() {
  try {
    const res = await fetch('http://localhost:${BACKEND_PORT}/api/config');
    if (res.ok) {
      showStatus('success', '✅ GreenHorn 已就绪，点击打开');
      btn.textContent = '🔗 打开 GreenHorn';
      btn.onclick = () => window.open('${APP_URL}', '_blank');
      return;
    }
  } catch(e) {}
}

async function startGreenHorn() {
  btn.disabled = true;
  btn.textContent = '⏳ 启动中...';
  showStatus('loading', '正在启动后端服务...');
  logBox.style.display = 'block';
  appendLog('启动后端服务...');
  
  try {
    const res = await fetch('/api/start', { method: 'POST' });
    const data = await res.json();
    if (!data.success) {
      showStatus('error', '❌ 启动失败：' + data.message);
      btn.disabled = false;
      btn.textContent = '🔄 重试';
      return;
    }
  } catch(e) {
    showStatus('error', '❌ 启动失败：' + e.message);
    btn.disabled = false;
    btn.textContent = '🔄 重试';
    return;
  }
  
  // 轮询等待后端就绪
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    showStatus('loading', \`等待后端就绪... (\${(i+1)*2}秒)\`);
    
    try {
      const res = await fetch('http://localhost:${BACKEND_PORT}/api/config');
      if (res.ok) {
        showStatus('success', '✅ 后端已就绪！正在打开...');
        setTimeout(() => {
          window.open('${APP_URL}', '_blank');
          showStatus('success', '🎉 GreenHorn 已打开！关闭本页面不影响使用。');
          btn.textContent = '✅ 已启动';
        }, 1500);
        return;
      }
    } catch(e) {}
  }
  
  showStatus('error', '⏰ 等待超时，检查终端窗口是否有错误信息');
  btn.disabled = false;
  btn.textContent = '🔄 重试';
}

function showStatus(type, msg) {
  status.className = 'status ' + type;
  status.style.display = 'block';
  statusText.textContent = msg;
  appendLog(msg);
}

function appendLog(msg) {
  logBox.textContent += msg + '\\n';
  logBox.scrollTop = logBox.scrollHeight;
}
</script>
</body>
</html>`);
});

// API：启动后端
app.post('/api/start', (req, res) => {
  if (backendProcess) {
    return res.json({ success: true, message: '后端已在运行' });
  }
  
  // 先检查前端是否已构建
  const frontendDist = path.join(PROJECT_DIR, 'packages', 'frontend', 'dist');
  if (fs.existsSync(frontendDist)) {
    // 有构建产物 → 用生产模式（单端口）
    appendLog('检测到前端已构建，使用生产模式');
    backendProcess = spawn('pnpm', ['--filter', '@greenhorn/backend', 'start'], {
      cwd: PROJECT_DIR,
      shell: true,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } else {
    // 没有构建产物 → 用开发模式（双端口，需要 Vite）
    appendLog('未检测到前端构建，使用开发模式（双端口）');
    // 先启动后端
    backendProcess = spawn('pnpm', ['--filter', '@greenhorn/backend', 'dev'], {
      cwd: PROJECT_DIR,
      shell: true,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // 再启动前端
    const frontendProcess = spawn('pnpm', ['--filter', '@greenhorn/frontend', 'dev'], {
      cwd: PROJECT_DIR,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    frontendProcess.stdout.on('data', d => appendLog('[前端] ' + d.toString().trim()));
    frontendProcess.stderr.on('data', d => appendLog('[前端] ' + d.toString().trim()));
    // 保存引用以便清理
    (backendProcess as any).frontendProcess = frontendProcess;
  }
  
  backendProcess.stdout.on('data', d => appendLog('[后端] ' + d.toString().trim()));
  backendProcess.stderr.on('data', d => appendLog('[后端] ' + d.toString().trim()));
  
  backendProcess.on('exit', (code) => {
    appendLog('后端进程已退出 (code: ' + code + ')');
    backendProcess = null;
  });
  
  res.json({ success: true });
});

// API：检查状态
app.get('/api/status', async (req, res) => {
  try {
    const r = await fetch('http://localhost:' + BACKEND_PORT + '/api/config');
    res.json({ running: r.ok });
  } catch {
    res.json({ running: false });
  }
});

// 日志
const logs: string[] = [];
function appendLog(msg: string) {
  logs.push('[' + new Date().toLocaleTimeString() + '] ' + msg);
  if (logs.length > 50) logs.shift();
}
app.get('/api/logs', (req, res) => res.json(logs));

// 启动启动器
app.listen(PORT, () => {
  console.log('✅ GreenHorn 启动器已运行');
  console.log('   浏览器打开: http://localhost:' + PORT);
  
  // 自动打开浏览器
  const url = 'http://localhost:' + PORT;
  const platform = process.platform;
  const cmd = platform === 'win32' ? 'start' : platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(cmd, [url], { shell: true, detached: true });
});
