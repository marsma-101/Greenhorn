/**
 * 轻量对话引擎（方案B）
 * 
 * 直接调用 OpenAI 兼容 API，不依赖 PI SDK
 * 支持 Ollama（本地无需 Key）和各类云端模型
 * M1 先验证 Ollama 链路，再扩展其他供应商
 */
import type { ChatEvent } from '@greenhorn/shared/types/adapter';

interface ChatOptions {
  model: string;
  apiKey?: string;
  baseUrl: string;
  temperature?: number;
  maxTokens?: number;
  persona?: string;
  systemMessage?: string;
}

/**
 * 调用 OpenAI 兼容 API 发送消息
 * 支持 Ollama（无需 API Key）和云端模型
 * 返回 AsyncIterable<ChatEvent> 供 SSE 流式消费
 */
export async function* streamChat(
  prompt: string,
  history: Array<{ role: string; content: string }>,
  options: ChatOptions,
  signal?: AbortSignal,
): AsyncIterable<ChatEvent> {
  const { model, apiKey, baseUrl, temperature = 0.7, maxTokens = 4096, systemMessage } = options;
  
  // persona 已在 chat.ts 中注入 systemMessage，此处直接使用
  const systemPrompt = systemMessage || 'You are a helpful AI assistant.';
  
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: prompt },
  ];
  
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  
  // 构建请求头：Ollama 不需要 API Key，云端需要
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
      signal,
    });
    
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      // 提取关键错误信息，不暴露技术细节
      let userMessage = '请求失败，请检查 API Key 或网络连接';
      try {
        const err = JSON.parse(errorBody);
        if (err.error?.message) {
          // 只显示简洁的语义化信息
          const msg = err.error.message.toLowerCase();
          if (msg.includes('auth') || msg.includes('key') || msg.includes('token') || msg.includes('api_key') || msg.includes('unauthorized') || msg.includes('forbidden')) {
            userMessage = 'API Key 好像不对哦，检查有没有复制完整';
          } else if (msg.includes('model') || msg.includes('not found')) {
            userMessage = '模型名称不对，请检查设置页的模型选择';
          } else if (msg.includes('rate') || msg.includes('quota') || msg.includes('limit')) {
            userMessage = '请求太频繁了，稍等一会儿再试';
          } else if (msg.includes('balance') || msg.includes('insufficient') || msg.includes('credit')) {
            userMessage = '账户余额不足，去控制台充值后再试';
          } else {
            // 其他错误：截取关键信息辅助排查
            const detail = err.error.message.slice(0, 100);
            userMessage = `请求失败: ${detail}`;
          }
        } else {
          // 有错误体但没有 error.message，截取前 100 字符
          const raw = errorBody.slice(0, 100);
          userMessage = `请求失败: ${raw}`;
        }
      } catch {
        // JSON 解析失败，用默认提示
        if (errorBody) {
          userMessage = `请求失败: ${errorBody.slice(0, 100)}`;
        }
      }
      yield { type: 'error', message: userMessage };
      return;
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', message: '无法读取响应流' };
      return;
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let thinking = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          yield { type: 'done', reason: 'complete' };
          return;
        }
        
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          
          // 推理模型的思维链内容在 delta.reasoning，实时转发为 thinking 事件
          if (delta?.reasoning) {
            thinking += delta.reasoning;
            yield { type: 'thinking', content: thinking };
          }
          
          if (delta?.content) {
            // 模拟思考过程（前 20 个字符标记为 thinking）
            const isThinking = content.length < 20;
            content += delta.content;
            yield {
              type: isThinking ? 'thinking' : 'text',
              content: content,
            };
          }
          
          // 检查 finish_reason
          if (parsed.choices?.[0]?.finish_reason === 'stop') {
            yield { type: 'done', reason: 'complete' };
            return;
          }
        } catch {
          // 跳过解析失败的行
        }
      }
    }
  } catch (error) {
    yield { type: 'error', message: '网络连接中断，请检查网络后重试' };
    return;
  }
  
  // 流结束
  yield { type: 'done', reason: 'complete' };
}

/**
 * 验证 API Key 是否有效
 * 发送一条极简消息测试
 */
export async function verifyApiKey(
  apiKey: string,
  baseUrl: string,
  model: string,
): Promise<{ success: boolean; message: string; latency?: number }> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'say "ok"' }],
        max_tokens: 5,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (response.ok) {
      return { success: true, message: '连接正常！', latency: Date.now() - startTime };
    }
    
    const errorBody = await response.text().catch(() => '');
    return { success: false, message: 'Key 好像不对哦，检查有没有复制完整' };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, message: '连接超时（10秒），检查网络或 API 地址' };
    }
    return { success: false, message: '网络连接失败，请检查网络' };
  }
}