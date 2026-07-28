/**
 * 轻量对话引擎（方案B）
 * 
 * 直接调用 OpenAI 兼容 API，不依赖 PI SDK
 * 用于 M1 快速验证端到端流程
 * M2 后再接入真正的 PI SDK
 */
import type { ChatEvent } from '@greenhorn/shared/types/adapter';

interface ChatOptions {
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 调用 OpenAI 兼容 API 发送消息
 * 返回 AsyncIterable<ChatEvent> 供 SSE 流式消费
 */
export async function* streamChat(
  prompt: string,
  history: Array<{ role: string; content: string }>,
  options: ChatOptions,
): AsyncIterable<ChatEvent> {
  const { model, apiKey, baseUrl, temperature = 0.7, maxTokens = 4096 } = options;
  
  const messages = [
    { role: 'system', content: 'You are a helpful AI assistant.' },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: prompt },
  ];
  
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });
  
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    yield { type: 'error', message: `API 请求失败 (${response.status}): ${errorBody}` };
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
  
  try {
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
          
          if (delta?.content) {
            // 模拟思考过程（前几句标记为 thinking）
            const isThinking = content.length < 5;
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
    return { success: false, message: `Key 好像不对哦 (${response.status})` };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return { success: false, message: '连接超时（10秒），检查网络或 API 地址' };
    }
    return { success: false, message: '网络连接失败，请检查网络' };
  }
}