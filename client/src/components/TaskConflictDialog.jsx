import { useState } from 'react';

const fmtHour = (h) => String(h).padStart(2, '0') + ':00';

export default function TaskConflictDialog({ conflictInfo, conflictType, pendingAction, onResolve, onCancel }) {
  const conflictText = conflictInfo
    ? conflictInfo.map(o => `${o.date ? o.date + ' ' : ''}${fmtHour(o.start_hour)}-${fmtHour(o.end_hour)} ${o.description}`).join('\n')
    : '';

  if (!conflictInfo || !pendingAction) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onCancel}>
      <div className={`bg-white rounded-xl shadow-lg p-5 w-full max-w-sm mx-4 border-t-4 animate-fade-scale ${conflictType === 'same_name' ? 'border-yellow-400' : 'border-red-400'}`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2">
          {conflictType === 'same_name' ? (
            <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          ) : (
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          )}
          <h4 className={`text-sm font-medium ${conflictType === 'same_name' ? 'text-yellow-700' : 'text-red-700'}`}>
            {conflictType === 'same_name' ? '任务名重复' : '时段冲突'}
          </h4>
        </div>
        <p className="text-xs mb-3">
          {conflictType === 'same_name'
            ? <span className="text-yellow-600">已存在同名任务，请选择处理方式：</span>
            : <span className="text-red-600">以下任务时间有重叠：</span>}
        </p>
        {conflictType !== 'same_name' && (
          <div className="text-xs text-gray-600 bg-gray-50 rounded p-2 mb-4 whitespace-pre-line font-mono">
            {conflictText}
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <button onClick={() => onResolve('keep_both')}
            className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg transition-colors">
            保留新旧
          </button>
          <button onClick={() => onResolve('skip')}
            className="flex-1 py-2 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50 transition-colors">
            跳过
          </button>
          <button onClick={() => onResolve('overwrite')}
            className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg transition-colors">
            覆盖
          </button>
        </div>
        {conflictType === 'same_name' && (
          <div className="text-center pt-1">
            <button onClick={() => onResolve('skip')}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              取消添加
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
