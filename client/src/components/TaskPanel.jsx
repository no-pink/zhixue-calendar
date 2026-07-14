import { useState, useEffect } from 'react';
import { tasks as tasksApi } from '../api';
import { useToast } from '../context/ToastContext';
import TaskForm from './TaskForm';
import TaskItem from './TaskItem';
import TaskConflictDialog from './TaskConflictDialog';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function TaskPanel({ planId, date, refreshTrigger, onRefresh, selectedDates, onShowBatch, onShowCopy, selectedCopyTasks, setSelectedCopyTasks }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState(null);
  const [editDesc, setEditDesc] = useState('');
  const [editStart, setEditStart] = useState(0);
  const [editEnd, setEditEnd] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [conflictInfo, setConflictInfo] = useState(null);
  const [conflictType, setConflictType] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [copyMode, setCopyMode] = useState(false);
  const toast = useToast();

  const isMulti = selectedDates && selectedDates.length > 1;

  const load = async () => {
    setLoading(true);
    try { setTasks(await tasksApi.list(planId, date)); }
    catch (e) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [planId, date, refreshTrigger]);

  const resolveConflict = async (mode) => {
    if (!pendingAction) return;
    const { type, params } = pendingAction;
    setConflictInfo(null);
    setConflictType(null);
    setPendingAction(null);
    if (mode === 'cancel') return;
    try {
      if (type === 'add') {
        await tasksApi.create({ ...params, force: mode === 'overwrite', skip_conflict_check: mode === 'keep_both' });
      } else if (type === 'edit') {
        await tasksApi.update(editingTask.id, { ...params, force: mode === 'overwrite' });
        setEditingTask(null);
      }
      await load();
      onRefresh();
    } catch (e) { toast.error(e.message); }
    setShowForm(false);
  };

  const handleAdd = async (start, end, desc) => {
    if (!desc.trim()) return;
    const params = { plan_id: planId, date, start_hour: start, end_hour: end, description: desc.trim() };
    try {
      const res = await tasksApi.create(params);
      if (res.code === 'CONFLICT_SAME_NAME' || res.code === 'CONFLICT_OVERLAP') {
        setConflictInfo(res.details?.overlapping);
        setConflictType(res.details?.conflictType);
        setPendingAction({ type: 'add', params });
        return;
      }
      setShowForm(false);
      await load();
      onRefresh();
    } catch (e) { toast.error(e.message); }
  };

  const handleToggle = async (id) => {
    try { await tasksApi.toggle(id); await load(); onRefresh(); }
    catch (e) { toast.error(e.message); }
  };

  const handleUpdate = async () => {
    if (!editDesc.trim()) return;
    const params = { description: editDesc.trim(), start_hour: editStart, end_hour: editEnd };
    try {
      const res = await tasksApi.update(editingTask.id, params);
      if (res.code === 'CONFLICT_SAME_NAME' || res.code === 'CONFLICT_OVERLAP') {
        setConflictInfo(res.details?.overlapping);
        setConflictType(res.details?.conflictType);
        setPendingAction({ type: 'edit', params });
        return;
      }
      setEditingTask(null);
      await load();
    } catch (e) { toast.error(e.message); }
  };

  const startEdit = (task) => {
    setEditingTask(task);
    setEditDesc(task.description);
    setEditStart(task.start_hour);
    setEditEnd(task.end_hour);
  };

  const fmtHour = (h) => String(h).padStart(2, '0') + ':00';

  if (loading) return (
    <div className="p-4 flex flex-col items-center justify-center py-12 text-gray-400">
      <svg className="w-8 h-8 animate-pulse mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
      <span className="text-sm">加载中...</span>
    </div>
  );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-gray-700">任务详情</h3>
        {isMulti && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">已选 {selectedDates.length} 天</span>}
      </div>
      <p className="text-xs text-gray-400 mb-3">{isMulti ? `${date} 等 ${selectedDates.length} 天` : date}</p>

      {/* Copy mode toggle */}
      {!isMulti && !showForm && tasks.length > 0 && (
        <div className="mb-3">
          {!copyMode ? (
            <button onClick={() => setCopyMode(true)}
              className="w-full py-2 border border-dashed border-purple-200 rounded-lg text-xs text-purple-400 hover:text-purple-500 hover:border-purple-300 transition-colors">
              选择任务复制到其他日期
            </button>
          ) : (
            <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between">
              <span className="text-xs text-purple-600">已选 {selectedCopyTasks.length} 个任务</span>
              <div className="flex gap-1">
                <button onClick={onShowCopy}
                  className="px-3 py-1 text-xs bg-purple-500 hover:bg-purple-600 text-white rounded transition-colors"
                  disabled={selectedCopyTasks.length === 0}>复制到其他日期</button>
                <button onClick={() => { setCopyMode(false); setSelectedCopyTasks([]); }}
                  className="px-3 py-1 text-xs text-purple-400 hover:text-purple-600 transition-colors">取消</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Multi-date: batch add button */}
      {isMulti && (
        <button onClick={onShowBatch}
          className="w-full py-3 mb-3 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg shadow-sm">
          批量添加任务 ({selectedDates.length} 天)
        </button>
      )}

      {/* Single-date: add button/form */}
      {!isMulti && !showForm && (
        <button onClick={() => { setShowForm(true); }}
          className="w-full py-2 mb-3 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors">
          + 添加任务
        </button>
      )}
      {!isMulti && showForm && (
        <TaskForm onAdd={handleAdd} onCancel={() => setShowForm(false)} />
      )}

      {/* Edit form inline */}
      {editingTask && (
        <div className="p-3 mb-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <label className="block text-[10px] text-gray-500 mb-0.5">开始</label>
              <select value={editStart} onChange={e => setEditStart(Number(e.target.value))}
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white">
                {HOURS.map(h => <option key={h} value={h}>{fmtHour(h)}</option>)}
              </select>
            </div>
            <span className="text-xs text-gray-400 mt-5">至</span>
            <div className="flex-1">
              <label className="block text-[10px] text-gray-500 mb-0.5">结束</label>
              <select value={editEnd} onChange={e => setEditEnd(Number(e.target.value))}
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white">
                {HOURS.map(h => <option key={h} value={h + 1}>{fmtHour(h + 1)}</option>)}
              </select>
            </div>
          </div>
          <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleUpdate(); if (e.key === 'Escape') setEditingTask(null); }} />
          <div className="flex gap-1">
            <button onClick={handleUpdate} className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">确定</button>
            <button onClick={() => setEditingTask(null)} className="px-3 py-1 text-xs text-gray-400 hover:text-gray-600">取消</button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="space-y-2">
        {tasks.length === 0 && !showForm && !isMulti && (
          <p className="text-xs text-gray-400 text-center py-8">当天暂无任务</p>
        )}
        {tasks.map(task => (
          <TaskItem key={task.id} task={task} copyMode={copyMode}
            selectedCopyTasks={selectedCopyTasks} setSelectedCopyTasks={setSelectedCopyTasks}
            onRefresh={() => { load(); onRefresh(); }}
            onToggle={handleToggle} onEdit={startEdit} />
        ))}
      </div>

      <TaskConflictDialog conflictInfo={conflictInfo} conflictType={conflictType}
        pendingAction={pendingAction} onResolve={resolveConflict}
        onCancel={() => { setConflictInfo(null); setConflictType(null); setPendingAction(null); setShowForm(false); }} />
    </div>
  );
}
