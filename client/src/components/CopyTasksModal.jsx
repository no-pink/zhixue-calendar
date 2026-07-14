import { useState, useEffect } from 'react';
import { tasks as tasksApi, plans as plansApi } from '../api';
import { useToast } from '../context/ToastContext';

export default function CopyTasksModal({ planId, selectedTasks, onClose, onSuccess }) {
  const [targetPlanId, setTargetPlanId] = useState(planId);
  const [plans, setPlans] = useState([]);
  const [targetDates, setTargetDates] = useState([]);
  const [dateInput, setDateInput] = useState('');
  const [conflictMode, setConflictMode] = useState('keep_both');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const toast = useToast();

  useEffect(() => {
    plansApi.list().then(setPlans).catch(console.error);
  }, []);

  const addDate = () => {
    if (dateInput && !targetDates.includes(dateInput)) {
      setTargetDates([...targetDates, dateInput]);
      setDateInput('');
    }
  };

  const removeDate = (d) => setTargetDates(targetDates.filter(x => x !== d));

  const handleSubmit = async () => {
    if (targetDates.length === 0) return;
    setLoading(true);
    try {
      const data = await tasksApi.copy({
        task_ids: selectedTasks.map(t => t.id),
        target_dates: targetDates,
        target_plan_id: targetPlanId,
        conflict_mode: conflictMode,
      });
      if (data.conflict) {
        if (!window.confirm(
          `目标日期存在 ${data.conflicts.length} 个冲突，是否继续？\n\n确定→保留新旧，取消→跳过冲突。`
        )) {
          const skipData = await tasksApi.copy({
            task_ids: selectedTasks.map(t => t.id),
            target_dates: targetDates,
            target_plan_id: targetPlanId,
            conflict_mode: 'skip',
          });
          setResult(skipData);
        } else {
          const keepData = await tasksApi.copy({
            task_ids: selectedTasks.map(t => t.id),
            target_dates: targetDates,
            target_plan_id: targetPlanId,
            conflict_mode: 'keep_both',
          });
          setResult(keepData);
        }
      } else {
        setResult(data);
      }
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto animate-fade-scale" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-medium text-gray-800 mb-1">复制任务到其他日期</h3>
        <p className="text-xs text-gray-400 mb-4">已选 {selectedTasks.length} 个任务</p>

        {/* Selected tasks preview */}
        <div className="mb-4 p-2 bg-gray-50 rounded-lg max-h-24 overflow-y-auto">
          {selectedTasks.map(t => (
            <div key={t.id} className="text-xs text-gray-600 truncate">
              {String(t.start_hour).padStart(2, '0')}:00 - {String(t.end_hour).padStart(2, '0')}:00 {t.description}
            </div>
          ))}
        </div>

        {!result ? (
          <div className="space-y-4">
            {/* Target plan */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">目标计划</label>
              <select value={targetPlanId} onChange={e => setTargetPlanId(Number(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white">
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.id === planId ? '(当前)' : ''}</option>
                ))}
              </select>
            </div>

            {/* Target dates */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">目标日期</label>
              <div className="flex gap-1 mb-1">
                <input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400" />
                <button onClick={addDate}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs rounded transition-colors">添加</button>
              </div>
              {targetDates.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {targetDates.map(d => (
                    <span key={d} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
                      {d}
                      <button onClick={() => removeDate(d)} className="text-blue-400 hover:text-blue-600">&times;</button>
                    </span>
                  ))}
                </div>
              )}
              {targetDates.length === 0 && (
                <p className="text-[10px] text-gray-400">请添加至少一个目标日期</p>
              )}
            </div>

            {/* Conflict mode */}
            <div>
              <label className="block text-xs text-gray-600 mb-1">已有任务处理方式</label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer p-2 rounded hover:bg-gray-50">
                  <input type="radio" name="conflict" checked={conflictMode === 'keep_both'} onChange={() => setConflictMode('keep_both')} />
                  <div>
                    <div className="font-medium text-gray-700">保留新旧</div>
                    <div className="text-[10px] text-gray-400">保留原有任务，同时添加复制的任务</div>
                  </div>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer p-2 rounded hover:bg-gray-50">
                  <input type="radio" name="conflict" checked={conflictMode === 'skip'} onChange={() => setConflictMode('skip')} />
                  <div>
                    <div className="font-medium text-gray-700">跳过</div>
                    <div className="text-[10px] text-gray-400">有冲突的日期/时段不复制</div>
                  </div>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer p-2 rounded hover:bg-gray-50">
                  <input type="radio" name="conflict" checked={conflictMode === 'overwrite'} onChange={() => setConflictMode('overwrite')} />
                  <div>
                    <div className="font-medium text-gray-700">覆盖</div>
                    <div className="text-[10px] text-gray-400">用新任务替换冲突的原有任务</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={handleSubmit} disabled={loading || targetDates.length === 0}
                className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white text-sm rounded-lg transition-colors">
                {loading ? '复制中...' : `复制到 ${targetDates.length} 天`}
              </button>
              <button onClick={onClose} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-600 text-sm rounded-lg transition-colors">取消</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              复制完成
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <p>新增任务：{result.created} 个</p>
              {result.skipped > 0 && <p>跳过（冲突）：{result.skipped} 个</p>}
              {result.overwritten > 0 && <p>替换（旧任务）：{result.overwritten} 个</p>}
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
