import { test, expect } from 'bun:test';
import { countTokens, formatTokenCount, estimateCost } from './tokenCounter';

test('countTokens - 空字符串应返回 0', () => {
  expect(countTokens('')).toBe(0);
});

test('countTokens - 简单文本', () => {
  const text = 'Hello, world!';
  const count = countTokens(text);
  expect(count).toBeGreaterThan(0);
  console.log(`"${text}" 的 token 数量:`, count);
});

test('countTokens - 中文文本', () => {
  const text = '你好，世界！';
  const count = countTokens(text);
  expect(count).toBeGreaterThan(0);
  console.log(`"${text}" 的 token 数量:`, count);
});

test('countTokens - 长文本', () => {
  const text = `
You are a helpful AI assistant. Your role is to provide accurate and helpful information
to users while being respectful and professional. Please follow these guidelines:

1. Always be polite and respectful
2. Provide accurate information
3. If you're unsure about something, say so
4. Keep responses clear and concise
  `.trim();

  const count = countTokens(text);
  expect(count).toBeGreaterThan(0);
  console.log('长文本的 token 数量:', count);
});

test('formatTokenCount - 格式化显示', () => {
  expect(formatTokenCount(0)).toBe('0');
  expect(formatTokenCount(500)).toBe('500');
  expect(formatTokenCount(1500)).toBe('1.5k');
  expect(formatTokenCount(10000)).toBe('10.0k');
});

test('estimateCost - 成本估算', () => {
  const cost = estimateCost(1000, 'gpt-4');
  expect(cost).toBeGreaterThan(0);
  console.log('1000 tokens (GPT-4) 的估算成本:', `$${cost.toFixed(4)}`);
});
