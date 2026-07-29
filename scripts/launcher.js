/**
 * GreenHorn 启动器
 * 
 * 一键启动：双击本脚本 → 自动打开浏览器
 * 点击按钮 → 启动后端 → 打开应用
 * 
 * 纯 Node.js 内置模块，无需额外依赖
 */
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 3001;
const BACKEND_PORT = 3000;
const FRONTEND_PORT = 5173;
const PROJECT_DIR = path.resolve(__dirname, '..');

let backendProcess = null;
let frontendProcess = null;
const logs = [];

function log(msg) {
  const t = '[' + new Date().toLocaleTimeString() + '] ' + msg;
  logs.push(t);
  if (logs.length > 100) logs.shift();
  console.log(t);
}

function getHTML(statusMsg, statusType) {
  const APP_URL = `http://localhost:${FRONTEND_PORT}`;
  return `<!DOCTYPE html>
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
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
  }
  .card {
    background: white; border-radius: 24px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.08);
    padding: 48px; max-width: 520px; width: 90%; text-align: center;
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
    font-size: 14px; display: ${statusMsg ? 'block' : 'none'};
  }
  .status.loading { background: #fef9c3; color: #854d0e; }
  .status.success { background: #dcfce7; color: #166534; }
  .status.error { background: #fee2e2; color: #991b1b; }
  .log-box {
    margin-top: 16px; background: #1f2937; color: #d1d5db;
    padding: 12px; border-radius: 8px; font-size: 12px;
    font-family: monospace; text-align: left; max-height: 150px;
    overflow-y: auto; white-space: pre-wrap;
  }
  .tips { margin-top: 20px; font-size: 13px; color: #9ca3af; line-height: 1.6; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">🍃</div>
  <h1>GreenHorn</h1>
  <p class="subtitle">小白也能用的 AI 智能体 · 一键启动</p>
  
  <div class="step-list">
    <div class="step"><div class="step-num">1</div><div class="step-text"><strong>点一下按钮</strong> — 自动启动后端</div></div>
    <div class="step"><div class="step-num">2</div><div class="step-text"><strong>选 Ollama（推荐）</strong> — 本机免费运行，不用注册</div></div>
    <div class="step"><div class="step-num">3</div><div class="step-text"><strong>开始对话</strong> — 让 AI 帮你干活</div></div>
  </div>

  <button class="btn-start" id="btnStart">🚀 启动 GreenHorn</button>
  <div class="status ${statusType || ''}" id="status">${statusMsg || ''}</div>
  <div class="log-box" id="log"></div>

  <div class="tips">
    关闭此页面不会停止服务。<br>
    要完全关闭请关掉命令行窗口。
  </div>
</div>
<script>
const logEl = document.getElementById('log');
const btn = document.getElementById('btnStart');
const statusEl = document.getElementById('status');

async function refreshLog() {
  try {
    const res = await fetch('/api/logs');
    const data = await res.json();
    logEl.textContent = data.join('\\n');
    logEl.scrollTop = logEl.scrollHeight;
  } catch(e) {}
}
setInterval(refreshLog, 1000);

btn.onclick = async function() {
  btn.disabled = true;
  btn.textContent = '⏳ 启动中...';
  statusEl.className = 'status loading';
  statusEl.textContent = '正在启动后端...';
  statusEl.style.display = 'block';
  
  try {
    const res = await fetch('/api/start', { method: 'POST' });
    const data = await res.json();
    if (!data.success) {
      statusEl.className = 'status error';
      statusEl.textContent = '❌ ' + data.message;
      btn.disabled = false;
      btn.textContent = '🔄 重试';
      return;
    }
  } catch(e) {
    statusEl.className = 'status error';
    statusEl.textContent = '❌ 启动失败';
    btn.disabled = false;
    btn.textContent = '🔄 重试';
    return;
  }
  
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    statusEl.textContent = '等待后端就绪... (' + ((i+1)*2) + '秒)';
    try {
      const r = await fetch('http://localhost:${BACKEND_PORT}/api/config');
      if (r.ok) {
        statusEl.className = 'status success';
        statusEl.textContent = '✅ 后端已就绪！正在打开...';
        setTimeout(() => {
          window.open('http://localhost:${FRONTEND_PORT}', '_blank');
          statusEl.textContent = '🎉 GreenHorn 已打开！关闭本页面不影响使用。';
          btn.textContent = '✅ 已启动';
        }, 1500);
        return;
      }
    } catch(e) {}
  }
  
  statusEl.className = 'status error';
  statusEl.textContent = '⏰ 等待超时，检查命令行窗口是否有错误';
  btn.disabled = false;
  btn.textContent = '🔄 重试';
};
</script>
</body>
</html>`;
}

// 创建服务器
const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 主页：启动器界面
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getHTML('', ''));
    return;
  }

  // API：启动后端
  if (req.url === '/api/start' && req.method === 'POST') {
    if (backendProcess) {
      res.end(JSON.stringify({ success: true, message: '后端已在运行' }));
      return;
    }
    
    const frontendDist = path.join(PROJECT_DIR, 'packages', 'frontend', 'dist');
    const hasBuild = fs.existsSync(path.join(frontendDist, 'index.html'));
    
    if (hasBuild) {
      log('检测到前端已构建 → 使用生产模式（单端口）');
      backendProcess = spawn('pnpm', ['--filter', '@greenhorn/backend', 'start'], {
        cwd: PROJECT_DIR, shell: true,
        env: { ...process.env, NODE_ENV: 'production', PATH: process.env.PATH },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } else {
      log('未检测到前端构建 → 使用开发模式（双端口）');
      backendProcess = spawn('pnpm', ['--filter', '@greenhorn/backend', 'dev'], {
        cwd: PROJECT_DIR, shell: true,
        env: { ...process.env, PATH: process.env.PATH },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      frontendProcess = spawn('pnpm', ['--filter', '@greenhorn/frontend', 'dev'], {
        cwd: PROJECT_DIR, shell: true,
        env: { ...process.env, PATH: process.env.PATH },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      frontendProcess.stdout.on('data', d => log('[前端] ' + d.toString().trim().slice(0, 100)));
      frontendProcess.stderr.on('data', d => log('[前端] ' + d.toString().trim().slice(0, 100)));
    }
    
    backendProcess.stdout.on('data', d => log('[后端] ' + d.toString().trim().slice(0, 100)));
    backendProcess.stderr.on('data', d => log('[后端] ' + d.toString().trim().slice(0, 100)));
    
    backendProcess.on('exit', (code) => {
      log('后端已退出 (code: ' + code + ')');
      backendProcess = null;
    });
    
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // API：日志
  if (req.url === '/api/logs') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(logs));
    return;
  }

  // 404
  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  log('🍃 GreenHorn 启动器已启动');
  log('   浏览器打开 http://localhost:' + PORT);
  
  // 自动打开浏览器
  setTimeout(() => {
    const url = 'http://localhost:' + PORT;
    const isWin = process.platform === 'win32';
    if (isWin) {
      spawn('cmd', ['/c', 'start', url], { shell: true, detached: true });
    } else {
      spawn('open', [url], { detached: true });
    }
  }, 500);
});

log('⏳ 正在打开启动页面...');
