import { encode } from 'gpt-tokenizer';

/**
 * 统计文本的 token 数量
 * 使用 GPT tokenizer 进行统计
 * @param text 要统计的文本
 * @returns token 数量
 */
export function countTokens(text: string): number {
  if (!text) return 0;

  try {
    const tokens = encode(text);
    return tokens.length;
  } catch (error) {
    console.error('Token 统计失败:', error);
    return 0;
  }
}

/**
 * 格式化 token 数量显示
 * @param count token 数量
 * @returns 格式化后的字符串
 */
export function formatTokenCount(count: number): string {
  if (count === 0) return '0';
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

/**
 * 根据 token 数量估算成本（参考价格）
 * @param count token 数量
 * @param model 模型名称
 * @returns 成本估算（美元）
 */
export function estimateCost(count: number, model: string = 'gpt-4'): number {
  const pricing: Record<string, { input: number; output: number }> = {
    'gpt-4': { input: 0.03 / 1000, output: 0.06 / 1000 },
    'gpt-4-turbo': { input: 0.01 / 1000, output: 0.03 / 1000 },
    'gpt-3.5-turbo': { input: 0.0015 / 1000, output: 0.002 / 1000 },
    'claude-3-opus': { input: 0.015 / 1000, output: 0.075 / 1000 },
    'claude-3-sonnet': { input: 0.003 / 1000, output: 0.015 / 1000 },
    'claude-3-haiku': { input: 0.00025 / 1000, output: 0.00125 / 1000 },
  };

  const modelPricing = pricing[model.toLowerCase()] || pricing['gpt-4'];
  return count * modelPricing.input;
}
