import { Router, Request, Response } from 'express';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, appendFileSync, copyFileSync } from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { getEnginePaths, cwdToDirName, PROJECT_ROOT } from '../services/ai-agent-manager';

export const sessionsRouter: Router = Router();

// 方案 A: 会话存储在 ai-agent/pi/data/sessions/
const { sessionsDir: AI_AGENT_SESSIONS_DIR } = getEnginePaths('pi');
// 旧路径（迁移用）
const OLD_PI_SESSIONS_DIR = path.join(os.homedir(), '.pi', 'agent', 'sessions');
const OLD_SESSIONS_DIR = path.join(os.homedir(), '.pi', 'agent', 'sessions-greenhorn');

const REAL_CWD = PROJECT_ROOT;

function getSessionsDir(): string {
  const dirName = cwdToDirName(REAL_CWD);
  const dir = path.join(AI_AGENT_SESSIONS_DIR, dirName);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getAllSessionDirs(): string[] {
  const dirs: string[] = [];
  
  // 新路径
  if (existsSync(AI_AGENT_SESSIONS_DIR)) {
    dirs.push(...readdirSync(AI_AGENT_SESSIONS_DIR)
      .filter(d => d.startsWith('--') && d.endsWith('--'))
      .map(d => path.join(AI_AGENT_SESSIONS_DIR, d)));
  }
  
  // 旧路径（兼容读取）
  if (existsSync(OLD_PI_SESSIONS_DIR) && OLD_PI_SESSIONS_DIR !== AI_AGENT_SESSIONS_DIR) {
    const oldDirs = readdirSync(OLD_PI_SESSIONS_DIR)
      .filter(d => d.startsWith('--') && d.endsWith('--'))
      .map(d => path.join(OLD_PI_SESSIONS_DIR, d));
    // 只包含新路径中不存在的
    for (const oldDir of oldDirs) {
      const dirName = path.basename(oldDir);
      const newDir = path.join(AI_AGENT_SESSIONS_DIR, dirName);
      if (!existsSync(newDir)) {
        dirs.push(oldDir);
      }
    }
  }
  
  return dirs;
}

// ============ PI 原生 jsonl 事件类型 ============

// Session 事件
interface SessionEvent {
  type: 'session';
  version: number;
  id: string;
  timestamp: string;
  cwd: string;
}

// Message 内部结构（AgentMessage）
interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: Array<{ type: string; text: string }>;
  timestamp: number; // epoch milliseconds
  provider?: string;
  model?: string;
}

// Message 事件
interface MessageEvent {
  type: 'message';
  id: string;
  parentId: string | null;
  timestamp: string;
  message: AgentMessage;
}

// Session Info 事件（用于设置会话名称）
interface SessionInfoEvent {
  type: 'session_info';
  id: string;
  parentId: string | null;
  timestamp: string;
  name: string;
}

type JsonlEvent = SessionEvent | MessageEvent | SessionInfoEvent;

// ============ 数据接口 ============

interface SessionMeta {
  id: string;
  title: string;
  time: string;
  messageCount: number;
}

interface SessionData {
  id: string;
  title: string;
  time: string;
  messages: Array<{ role: string; content: string; timestamp: string }>;
}

interface OldSessionData {
  id: string;
  title: string;
  time: string;
  messages: Array<{ role: string; content: string; timestamp: string }>;
}

// ============ 工具函数 ============

function buildSessionFileName(id: string, timestamp?: string): string {
  const rawTs = timestamp || new Date().toISOString();
  const ts = rawTs.replace(/:/g, '-').replace(/\.\d+Z$/, 'Z');
  return `${ts}_${id}.jsonl`;
}

function findSessionFile(sessionId: string): string | null {
  const dirs = getAllSessionDirs();
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter(f => f.endsWith('.jsonl'));
    for (const file of files) {
      const nameWithoutExt = file.replace('.jsonl', '');
      const parts = nameWithoutExt.split('_');
      const fileId = parts[parts.length - 1];
      if (fileId === sessionId) {
        return path.join(dir, file);
      }
    }
  }
  return null;
}

function getSessionIdFromFilename(filename: string): string {
  const nameWithoutExt = filename.replace('.jsonl', '');
  const parts = nameWithoutExt.split('_');
  return parts[parts.length - 1];
}

function appendJsonlLine(filePath: string, event: JsonlEvent): void {
  const line = JSON.stringify(event) + '\n';
  appendFileSync(filePath, line, 'utf-8');
}

function readJsonlEvents(filePath: string): JsonlEvent[] {
  try {
    if (!existsSync(filePath)) return [];
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const events: JsonlEvent[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line));
      } catch {
        // 跳过无效行
      }
    }
    return events;
  } catch {
    return [];
  }
}

// ============ 会话重建 ============

function reconstructSession(sessionId: string, events: JsonlEvent[]): SessionData {
  let title = '新对话';
  let time = '';
  const messages: SessionData['messages'] = [];

  for (const event of events) {
    if (event.type === 'session') {
      time = event.timestamp;
    } else if (event.type === 'session_info') {
      // session_info 事件包含会话名称
      if (event.name) {
        title = event.name;
      }
    } else if (event.type === 'message' && event.message?.role && event.message?.content) {
      const textContent = event.message.content.map(c => c.text).join('');
      const ts = new Date(event.message.timestamp).toISOString();
      messages.push({
        role: event.message.role,
        content: textContent,
        timestamp: ts,
      });
    }
  }

  if (!time && messages.length > 0) {
    time = messages[0].timestamp;
  } else if (!time) {
    time = new Date().toISOString();
  }

  // 自动生成标题（如果仍为默认）
  if (title === '新对话') {
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (firstUserMsg) {
      title = firstUserMsg.content.slice(0, 30);
    }
  }

  return { id: sessionId, title, time, messages };
}

// ============ 迁移旧会话 ============

let migrationDone = false;
function migrateOldSessions(): void {
  if (migrationDone) return;
  migrationDone = true;

  if (!existsSync(OLD_SESSIONS_DIR)) return;

  const targetDir = getSessionsDir();
  const hasJsonl = existsSync(targetDir) && readdirSync(targetDir).some(f => f.endsWith('.jsonl'));
  if (hasJsonl) return;

  const oldFiles = readdirSync(OLD_SESSIONS_DIR).filter(f => f.endsWith('.json'));

  for (const file of oldFiles) {
    try {
      const oldData: OldSessionData = JSON.parse(readFileSync(path.join(OLD_SESSIONS_DIR, file), 'utf-8'));
      const sessionId = oldData.id;
      const timestamp = oldData.time || new Date().toISOString();
      const fileName = buildSessionFileName(sessionId, timestamp);
      const filePath = path.join(targetDir, fileName);

      // 写入 session 行
      appendJsonlLine(filePath, {
        type: 'session',
        version: 3,
        id: sessionId,
        timestamp: timestamp,
        cwd: REAL_CWD,
      });

      // 写入 message 行（嵌套 message 对象）
      let lastMsgId: string | null = null;
      for (const msg of oldData.messages) {
        const msgId = randomUUID();
        const msgTs = new Date(msg.timestamp || Date.now()).getTime();
        appendJsonlLine(filePath, {
          type: 'message',
          id: msgId,
          parentId: lastMsgId,
          timestamp: msg.timestamp || new Date().toISOString(),
          message: {
            role: msg.role as 'user' | 'assistant',
            content: [{ type: 'text', text: msg.content }],
            timestamp: msgTs,
          },
        });
        lastMsgId = msgId;
      }

      // 如果有自定义标题，写入 session_info 事件
      if (oldData.title && oldData.title !== '新对话') {
        const infoId = randomUUID();
        appendJsonlLine(filePath, {
          type: 'session_info',
          id: infoId,
          parentId: lastMsgId,
          timestamp: new Date().toISOString(),
          name: oldData.title,
        });
      }
    } catch (e) {
      console.error(`Failed to migrate session file ${file}:`, e);
    }
  }

  console.log(`[GreenHorn] Migrated ${oldFiles.length} old sessions to PI native jsonl`);
}

migrateOldSessions();

// ============ 方案 A 迁移：旧路径 → ai-agent ============
let aiAgentMigrationDone = false;
function migrateToAiAgent(): void {
  if (aiAgentMigrationDone) return;
  aiAgentMigrationDone = true;

  // 1. 迁移旧 PI 路径下的 jsonl 文件到 ai-agent
  if (existsSync(OLD_PI_SESSIONS_DIR) && OLD_PI_SESSIONS_DIR !== AI_AGENT_SESSIONS_DIR) {
    try {
      const oldDirs = readdirSync(OLD_PI_SESSIONS_DIR)
        .filter(d => d.startsWith('--') && d.endsWith('--'));
      
      let migratedCount = 0;
      for (const dirName of oldDirs) {
        const oldDir = path.join(OLD_PI_SESSIONS_DIR, dirName);
        const newDir = path.join(AI_AGENT_SESSIONS_DIR, dirName);
        
        if (!existsSync(newDir)) {
          mkdirSync(newDir, { recursive: true });
        }
        
        // 复制所有 jsonl 文件（复制不删除）
        const files = readdirSync(oldDir).filter(f => f.endsWith('.jsonl'));
        for (const file of files) {
          const srcFile = path.join(oldDir, file);
          const destFile = path.join(newDir, file);
          
          // 如果目标文件不存在，则复制
          if (!existsSync(destFile)) {
            copyFileSync(srcFile, destFile);
            migratedCount++;
          }
        }
      }
      
      if (migratedCount > 0) {
        console.log(`[GreenHorn] 方案 A 迁移: ${migratedCount} 个会话迁移到 ai-agent`);
      }
    } catch (e) {
      console.error('[GreenHorn] 方案 A 迁移失败:', e);
    }
  }
  
  // 2. 确保目标目录结构存在
  if (!existsSync(AI_AGENT_SESSIONS_DIR)) {
    mkdirSync(AI_AGENT_SESSIONS_DIR, { recursive: true });
  }
  
  console.log(`[GreenHorn] 会话存储路径: ${AI_AGENT_SESSIONS_DIR}`);
}
migrateToAiAgent();

// 一次性数据修复：修复 cwd 双重转义问题
function fixCwdEscaping(): void {
  try {
    const dirs = getAllSessionDirs();
    for (const dir of dirs) {
      if (!existsSync(dir)) continue;
      const files = readdirSync(dir).filter(f => f.endsWith('.jsonl'));
      for (const file of files) {
        const filePath = path.join(dir, file);
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n');
        let modified = false;
        const targetCwd = REAL_CWD;

        const newLines = lines.map(line => {
          try {
            const obj = JSON.parse(line);
            if (obj.type === 'session' && obj.cwd && obj.cwd !== targetCwd) {
              obj.cwd = targetCwd;
              modified = true;
            }
            return JSON.stringify(obj);
          } catch {
            return line;
          }
        });

        if (modified) {
          writeFileSync(filePath, newLines.join('\n') + '\n', 'utf-8');
          console.log(`[GreenHorn] Fixed cwd escaping in ${file}`);
        }
      }
    }
  } catch {
    // ignore
  }
}
fixCwdEscaping();

// ============================================
// GET /api/sessions
// 列出所有会话
// ============================================
sessionsRouter.get('/', (_req: Request, res: Response) => {
  try {
    const dirs = getAllSessionDirs();
    const allSessions: SessionMeta[] = [];

    for (const dir of dirs) {
      if (!existsSync(dir)) continue;
      const files = readdirSync(dir).filter(f => f.endsWith('.jsonl'));

      for (const file of files) {
        try {
          const sessionId = getSessionIdFromFilename(file);
          const filePath = path.join(dir, file);
          const events = readJsonlEvents(filePath);
          const session = reconstructSession(sessionId, events);

          allSessions.push({
            id: sessionId,
            title: session.title,
            time: session.time,
            messageCount: session.messages.length,
          });
        } catch {
          // skip corrupted files
        }
      }
    }

    allSessions.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    res.json({ sessions: allSessions });
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ success: false, message: '获取会话列表失败' });
  }
});

// ============================================
// POST /api/sessions
// 创建新会话
// ============================================
sessionsRouter.post('/', (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const sessionId = randomUUID();
    const timestamp = now.toISOString();
    const sessionsDir = getSessionsDir();
    const fileName = buildSessionFileName(sessionId, timestamp);
    const filePath = path.join(sessionsDir, fileName);

    // 写入 session 行（PI v3 格式）
    appendJsonlLine(filePath, {
      type: 'session',
      version: 3,
      id: sessionId,
      timestamp: timestamp,
      cwd: REAL_CWD,
    });

    const newSession: SessionData = {
      id: sessionId,
      title: '新对话',
      time: timestamp,
      messages: [],
    };

    res.json({ success: true, session: newSession });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ success: false, message: '创建会话失败' });
  }
});

// ============================================
// GET /api/sessions/:id
// 加载指定会话
// ============================================
sessionsRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.id);
    const filePath = findSessionFile(sessionId);
    if (!filePath) {
      return res.status(404).json({ success: false, message: '会话不存在' });
    }

    const events = readJsonlEvents(filePath);
    const session = reconstructSession(sessionId, events);

    res.json({ success: true, session });
  } catch (error) {
    console.error('Error loading session:', error);
    res.status(500).json({ success: false, message: '加载会话失败' });
  }
});

// ============================================
// PUT /api/sessions/:id
// 更新会话（追加消息）
// ============================================
sessionsRouter.put('/:id', (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.id);
    const filePath = findSessionFile(sessionId);
    if (!filePath) {
      return res.status(404).json({ success: false, message: '会话不存在' });
    }

    const { message } = req.body;

    if (message) {
      const msgId = randomUUID();
      const now = new Date();
      const timestamp = now.toISOString();
      const epochMs = now.getTime();

      // 查找最后一条消息的 id 作为 parentId
      const events = readJsonlEvents(filePath);
      const lastMessageEvent = [...events].reverse().find(e => e.type === 'message');
      const parentId = lastMessageEvent?.id || null;

      // 写入 message 行（嵌套 message 对象，符合 PI 规范）
      appendJsonlLine(filePath, {
        type: 'message',
        id: msgId,
        parentId: parentId,
        timestamp: timestamp,
        message: {
          role: message.role as 'user' | 'assistant',
          content: [{ type: 'text', text: message.content }],
          timestamp: epochMs,
        },
      });

      // 自动生成标题（第一条用户消息）
      const userMsgCount = events.filter(e => e.type === 'message' && e.message?.role === 'user').length;
      if (message.role === 'user' && userMsgCount === 0) {
        const shortTitle = message.content.slice(0, 30);
        // 写入 session_info 事件设置会话名称
        const infoId = randomUUID();
        appendJsonlLine(filePath, {
          type: 'session_info',
          id: infoId,
          parentId: msgId,
          timestamp: timestamp,
          name: shortTitle,
        });
      }
    }

    // 返回更新后的会话
    const updatedEvents = readJsonlEvents(filePath);
    const session = reconstructSession(sessionId, updatedEvents);

    res.json({ success: true, session });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ success: false, message: '更新会话失败' });
  }
});

// ============================================
// PUT /api/sessions/:id/title
// 修改会话标题（写入 session_info 事件）
// ============================================
sessionsRouter.put('/:id/title', (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.id);
    const filePath = findSessionFile(sessionId);
    if (!filePath) {
      return res.status(404).json({ success: false, message: '会话不存在' });
    }

    const { title } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ success: false, message: '标题不能为空' });
    }

    // 查找最后一条消息的 id 作为 parentId
    const events = readJsonlEvents(filePath);
    const lastMessageEvent = [...events].reverse().find(e => e.type === 'message');
    const parentId = lastMessageEvent?.id || null;

    // 写入 session_info 事件（PI 原生方式存储会话名）
    appendJsonlLine(filePath, {
      type: 'session_info',
      id: randomUUID(),
      parentId: parentId,
      timestamp: new Date().toISOString(),
      name: title,
    });

    // 返回更新后的会话
    const updatedEvents = readJsonlEvents(filePath);
    const session = reconstructSession(sessionId, updatedEvents);

    res.json({ success: true, session });
  } catch (error) {
    console.error('Error updating session title:', error);
    res.status(500).json({ success: false, message: '修改标题失败' });
  }
});

// ============================================
// DELETE /api/sessions/:id
// 删除会话
// ============================================
sessionsRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.id);
    const filePath = findSessionFile(sessionId);
    if (!filePath) {
      return res.status(404).json({ success: false, message: '会话不存在' });
    }

    // 删除 jsonl 文件
    unlinkSync(filePath);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ success: false, message: '删除会话失败' });
  }
});
