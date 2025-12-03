import { useMemo } from 'react';

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber: { old?: number; new?: number };
}

// 简单的行级 diff 算法
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: DiffLine[] = [];

  // 使用 LCS (最长公共子序列) 简化版本
  const lcs = findLCS(oldLines, newLines);

  let oldIdx = 0;
  let newIdx = 0;
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const common of lcs) {
    // 处理 old 中被删除的行
    while (oldIdx < common.oldIndex) {
      result.push({
        type: 'removed',
        content: oldLines[oldIdx],
        lineNumber: { old: oldLineNum++ },
      });
      oldIdx++;
    }
    // 处理 new 中新增的行
    while (newIdx < common.newIndex) {
      result.push({
        type: 'added',
        content: newLines[newIdx],
        lineNumber: { new: newLineNum++ },
      });
      newIdx++;
    }
    // 处理相同的行
    result.push({
      type: 'unchanged',
      content: oldLines[oldIdx],
      lineNumber: { old: oldLineNum++, new: newLineNum++ },
    });
    oldIdx++;
    newIdx++;
  }

  // 处理剩余的行
  while (oldIdx < oldLines.length) {
    result.push({
      type: 'removed',
      content: oldLines[oldIdx],
      lineNumber: { old: oldLineNum++ },
    });
    oldIdx++;
  }
  while (newIdx < newLines.length) {
    result.push({
      type: 'added',
      content: newLines[newIdx],
      lineNumber: { new: newLineNum++ },
    });
    newIdx++;
  }

  return result;
}

interface LCSItem {
  oldIndex: number;
  newIndex: number;
}

function findLCS(oldLines: string[], newLines: string[]): LCSItem[] {
  const m = oldLines.length;
  const n = newLines.length;

  // DP 表
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 回溯找出 LCS
  const result: LCSItem[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ oldIndex: i - 1, newIndex: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

interface VersionDiffProps {
  oldVersion: { version: string; content: string };
  newVersion: { version: string; content: string };
  onClose: () => void;
}

export function VersionDiff({ oldVersion, newVersion, onClose }: VersionDiffProps) {
  const diffLines = useMemo(() => {
    return computeDiff(oldVersion.content, newVersion.content);
  }, [oldVersion.content, newVersion.content]);

  const stats = useMemo(() => {
    const added = diffLines.filter(l => l.type === 'added').length;
    const removed = diffLines.filter(l => l.type === 'removed').length;
    return { added, removed };
  }, [diffLines]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">版本对比</h2>
            <p className="text-sm text-gray-500">
              {oldVersion.version} → {newVersion.version}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-600">+{stats.added}</span>
              <span className="text-red-600">-{stats.removed}</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 版本标签 */}
        <div className="flex border-b border-gray-200">
          <div className="flex-1 px-4 py-2 bg-red-50 text-red-700 text-sm font-medium">
            旧版本: {oldVersion.version}
          </div>
          <div className="flex-1 px-4 py-2 bg-green-50 text-green-700 text-sm font-medium">
            新版本: {newVersion.version}
          </div>
        </div>

        {/* Diff 内容 */}
        <div className="flex-1 overflow-auto">
          <pre className="text-sm font-mono">
            {diffLines.map((line, index) => (
              <div
                key={index}
                className={`flex ${
                  line.type === 'added'
                    ? 'bg-green-50'
                    : line.type === 'removed'
                    ? 'bg-red-50'
                    : ''
                }`}
              >
                {/* 行号 */}
                <div className="flex-shrink-0 w-20 flex text-gray-400 text-xs border-r border-gray-200">
                  <span className="w-10 px-2 py-1 text-right bg-gray-50">
                    {line.lineNumber.old || ''}
                  </span>
                  <span className="w-10 px-2 py-1 text-right bg-gray-50">
                    {line.lineNumber.new || ''}
                  </span>
                </div>
                {/* 符号 */}
                <div
                  className={`w-6 flex-shrink-0 text-center py-1 ${
                    line.type === 'added'
                      ? 'text-green-600 bg-green-100'
                      : line.type === 'removed'
                      ? 'text-red-600 bg-red-100'
                      : 'text-gray-400'
                  }`}
                >
                  {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                </div>
                {/* 内容 */}
                <div
                  className={`flex-1 px-2 py-1 whitespace-pre-wrap break-all ${
                    line.type === 'added'
                      ? 'text-green-800'
                      : line.type === 'removed'
                      ? 'text-red-800'
                      : 'text-gray-700'
                  }`}
                >
                  {line.content || ' '}
                </div>
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}
