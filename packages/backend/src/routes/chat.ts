import { Router, Request, Response } from 'express';
import { streamChat } from '../services/chat-engine';
import { listSkills } from '../services/skill-manager';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import os from 'os';

export const chatRouter: Router = Router();

const ALLOWED_EXTENSIONS = ['.txt', '.md', '.json', '.js', '.ts', '.py', '.html', '.css', '.xml', '.yaml', '.yml', '.csv'];
const MAX_FILE_SIZE = 500 * 1024; // 500KB
const MAX_CONTENT_LENGTH = 20000;

function getSettingsPath(): string {
  const dir = process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), '.pi', 'agent');
  return path.join(dir, 'settings.json');
}

function readPersona(): string {
  try {
    const filePath = getSettingsPath();
    if (existsSync(filePath)) {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      return data.persona || '';
    }
  } catch {
    // ignore
  }
  return '';
}

function collectTriggeredSkills(prompt: string): string {
  const skills = listSkills().filter(s => s.enabled);
  if (skills.length === 0) return '';

  const triggered: string[] = [];
  const lowerPrompt = prompt.toLowerCase();

  for (const skill of skills) {
    const trigger = skill.trigger.trim().toLowerCase();
    if (!trigger) continue;
    if (trigger === 'alwayson' || lowerPrompt.includes(trigger)) {
      triggered.push(`[${skill.name}]\n${skill.prompt}`);
    }
  }

  if (triggered.length === 0) return '';
  return '\n\n你可以使用以下技能来辅助回答本次问题：\n' + triggered.join('\n\n');
}

function processFiles(files: Array<{ name: string; content: string }>): string {
  let systemInject = '';
  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) continue;
    if (file.content.length > MAX_CONTENT_LENGTH) {
      systemInject += `用户上传了文件 ${file.name}，内容如下（已截断）：\n---\n${file.content.slice(0, MAX_CONTENT_LENGTH)}\n---\n\n`;
    } else {
      systemInject += `用户上传了文件 ${file.name}，内容如下：\n---\n${file.content}\n---\n\n`;
    }
  }
  return systemInject;
}

chatRouter.post('/', async (req: Request, res: Response) => {
  const { prompt, context, messages: history, files } = req.body;
  
  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ success: false, message: '请提供要发送的消息' });
    return;
  }
  
  const provider = context?.provider || 'deepseek';
  const model = context?.model || process.env.DEFAULT_MODEL || 'deepseek-chat';
  const apiKey = context?.apiKey || process.env.DEEPSEEK_API_KEY || '';
  const baseUrl = context?.baseUrl || process.env.API_BASE_URL || 'https://api.deepseek.com';
  const isOllama = provider === 'ollama' || baseUrl.includes('localhost:11434');
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  // 立即发送响应头，避免客户端长时间等待首个事件（推理模型思维链可能较长）
  res.flushHeaders();
  
  try {
    if (!isOllama && !apiKey) {
      res.write(`data: ${JSON.stringify({ type: 'text', content: '💬 你好！我是 AI 助手。\n\n看起来还没有配置 API Key，请先去 [设置页面](/settings) 配置后再来对话。' })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', reason: 'complete' })}\n\n`);
      res.end();
      return;
    }
    
    let systemMessage = '';

    const persona = readPersona();
    if (persona) {
      systemMessage = `你是一个${persona}。\n\n`;
    }

    if (files && Array.isArray(files) && files.length > 0) {
      const fileInject = processFiles(files);
      if (fileInject) {
        systemMessage += fileInject;
      }
    }

    const skillInject = collectTriggeredSkills(prompt);
    if (skillInject) {
      systemMessage += skillInject;
    }
    
    // 客户端断开（连接提前关闭）时中止上游请求，避免 ollama 等串行服务被挂起请求占用。
    // 注意：不能监听 req.on('close')——POST body 读完即触发，会导致请求被提前中止
    const controller = new AbortController();
    res.on('close', () => {
      controller.abort();
    });
    
    for await (const event of streamChat(prompt, history || [], { model, apiKey, baseUrl, persona, systemMessage }, controller.signal)) {
      if (res.destroyed) break;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    
    if (!res.destroyed) {
      res.end();
    }
  } catch (error) {
    console.error('Chat error:', error);
    if (!res.destroyed) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: '出了点小问题，请再试一次' })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', reason: 'error' })}\n\n`);
      res.end();
    }
  }
});
