import { useState } from 'react';
import { tasks as tasksApi } from '../api';

export default function BatchFillModal({ planId, dates, onClose, onSuccess }) {
  const [slots, setSlots] = useState([{ start: '08', end: '09' }]);
  const [template, setTemplate] = useState('');
  const [conflictMode, setConflictMode] = useState('skip');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const addSlot = () => setSlots([...slots, { start: '08', end: '09' }]);
  const removeSlot = (i) => setSlots(slots.filter((_, idx) => idx !== i));
  const updateSlot = (i, field, val) => {
    const next = [...slots];
    next[i][field] = val;
    setSlots(next);
  };

  const handleSubmit = async () => {
    if (!template.trim()) return;
    setLoading(true);
    try {
      const slotStrs = slots.map(s => `${s.start}-${s.end}`);
      const data = await tasksApi.batch({
        plan_id: planId,
        dates,
        slots: slotStrs,
        template: template.trim(),
        conflict_mode: conflictMode,
      });
      setResult(data);
    } catch (e) {
      alert(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-medium text-gray-800 mb-1">批量填充任务</h3>
        <p className="text-xs text-gray-400 mb-4">选中 {dates.length} 天：{dates[0]} ~ {dates[dates.length - 1]}</p>

        {!result ? (
          <div className="space-y-4">
            {/* Time slots */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">时间段</label>
              {slots.map((slot, i) => (
                <div key={i} className="flex items-center gap-1 mb-1">
                  <input type="time" value={slot.start + ':00'} onChange={e => updateSlot(i, 'start', e.target.value.slice(0, 2))}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400" />
                  <span className="text-xs text-gray-400">至</span>
                  <input type="time" value={slot.end + ':00'} onChange={e => updateSlot(i, 'end', e.target.value.slice(0, 2))}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400" />
                  <button onClick={() => removeSlot(i)} className="text-xs text-red-400 hover:text-red-500 px-1">×</button>
                </div>
              ))}
              <button onClick={addSlot} className="text-xs text-blue-500 hover:text-blue-600">+ 添加时间段</button>
            </div>

            {/* Template */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">任务描述模板</label>
              <textarea value={template} onChange={e => setTemplate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 resize-none"
                rows={2} placeholder="例如：学习高数" />
            </div>

            {/* Conflict mode */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">已有任务处理方式</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer">
                  <input type="radio" name="conflict" checked={conflictMode === 'skip'} onChange={() => setConflictMode('skip')} />
                  跳过
                </label>
                <label className="flex items-center gap-1 text-sm text-gray-600 cursor-pointer">
                  <input type="radio" name="conflict" checked={conflictMode === 'overwrite'} onChange={() => setConflictMode('overwrite')} />
                  覆盖
                </label>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={handleSubmit} disabled={loading}
                className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white text-sm rounded-lg transition-colors">
                {loading ? '执行中...' : '确认填充'}
              </button>
              <button onClick={onClose} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-600 text-sm rounded-lg transition-colors">取消</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              批量操作完成
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <p>新增任务：{result.created} 个</p>
              <p>跳过（已有）：{result.skipped} 个</p>
              <p>覆盖（已有）：{result.overwritten} 个</p>
            </div>
            <button onClick={onSuccess}
              className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors">
              完成
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
