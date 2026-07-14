import { useState, useEffect } from 'react';
import { tasks as tasksApi } from '../api';
import { useToast } from '../context/ToastContext';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function TaskPanel({ planId, date, refreshTrigger, onRefresh, selectedDates, onShowBatch, onShowCopy, selectedCopyTasks, setSelectedCopyTasks }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState(null);
  const [editDesc, setEditDesc] = useState('');
  const [editStart, setEditStart] = useState(0);
  const [editEnd, setEditEnd] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [newStart, setNewStart] = useState(8);
  const [newEnd, setNewEnd] = useState(10);
  const [newDesc, setNewDesc] = useState('');
  const [showSubmissions, setShowSubmissions] = useState(null);
  const [conflictInfo, setConflictInfo] = useState(null);
  const [conflictType, setConflictType] = useState(null); // 'overlap' | 'same_name'
  const [pendingAction, setPendingAction] = useState(null);
  const [copyMode, setCopyMode] = useState(false);
  const toast = useToast();

  const isMulti = selectedDates && selectedDates.length > 1;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await tasksApi.list(planId, date);
        setTasks(data);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [planId, date, refreshTrigger]);

  const fetchTasks = async () => {
    try {
      const data = await tasksApi.list(planId, date);
      setTasks(data);
    } catch (e) { console.error(e); }
  };

  const resolveConflict = async (mode) => {
    if (!pendingAction) return;
    const { type, params } = pendingAction;
    setConflictInfo(null);
    setConflictType(null);
    setPendingAction(null);

    if (mode === 'cancel') return;

    try {
      if (type === 'add') {
        if (mode === 'overwrite') {
          await tasksApi.create({ ...params, force: true });
        } else if (mode === 'keep_both') {
          await tasksApi.create({ ...params, skip_conflict_check: true });
        }
        // skip = don't create
      } else if (type === 'edit') {
        await tasksApi.update(editingTask.id, { ...params, force: mode === 'overwrite' });
        setEditingTask(null);
      }
      await fetchTasks();
      onRefresh();
    } catch (e) { toast.error(e.message); }
    setShowForm(false);
  };

  const handleAdd = async () => {
    if (!newDesc.trim()) return;
    const params = { plan_id: planId, date, start_hour: newStart, end_hour: newEnd, description: newDesc.trim() };
    try {
      const res = await tasksApi.create(params);
      if (res.conflict) {
        setConflictInfo(res.overlapping);
        setConflictType(res.conflictType);
        setPendingAction({ type: 'add', params });
        return;
      }
      setNewDesc('');
      setShowForm(false);
      await fetchTasks();
      onRefresh();
    } catch (e) { toast.error(e.message); }
  };

  const handleToggle = async (id) => {
    try {
      await tasksApi.toggle(id);
      await fetchTasks();
      onRefresh();
    } catch (e) { toast.error(e.message); }
  };

  const handleUpdate = async () => {
    if (!editDesc.trim()) return;
    const params = { description: editDesc.trim(), start_hour: editStart, end_hour: editEnd };
    try {
      const res = await tasksApi.update(editingTask.id, params);
      if (res.conflict) {
        setConflictInfo(res.overlapping);
        setConflictType(res.conflictType);
        setPendingAction({ type: 'edit', params });
        return;
      }
      setEditingTask(null);
      await fetchTasks();
    } catch (e) { toast.error(e.message); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确定删除此任务？')) return;
    try {
      await tasksApi.delete(id);
      await fetchTasks();
      onRefresh();
    } catch (e) { toast.error(e.message); }
  };

  const handleFileUpload = async (taskId, file) => {
    try {
      const data = await tasksApi.upload(file);
      const task = tasks.find(t => t.id === taskId);
      const subs = [...(task?.submissions || []), { type: file.type.startsWith('image/') ? 'image' : 'file', content: file.name, file_path: data.file_path }];
      await tasksApi.update(taskId, { submissions: subs });
      await fetchTasks();
    } catch (e) { toast.error(e.message); }
  };

  const handleTextSub = async (taskId) => {
    const text = prompt('请输入提交物文本：');
    if (!text) return;
    try {
      const task = tasks.find(t => t.id === taskId);
      const subs = [...(task?.submissions || []), { type: 'text', content: text }];
      await tasksApi.update(taskId, { submissions: subs });
      await fetchTasks();
    } catch (e) { toast.error(e.message); }
  };

  const fmtHour = (h) => String(h).padStart(2, '0') + ':00';
  const conflictText = conflictInfo
    ? conflictInfo.map(o => `${o.date ? o.date + ' ' : ''}${fmtHour(o.start_hour)}-${fmtHour(o.end_hour)} ${o.description}`).join('\n')
    : '';

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
        {isMulti && (
          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
            已选 {selectedDates.length} 天
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-3">{isMulti ? `${date} 等 ${selectedDates.length} 天` : date}</p>

      {/* Copy mode toggle */}
      {!isMulti && !showForm && tasks.length > 0 && (
        <div className="mb-3">
          {!copyMode ? (
            <button onClick={() => setCopyMode(true)}
              className="w-full py-2 border border-dashed border-purple-200 rounded-lg text-xs text-purple-400 hover:text-purple-500 hover:border-purple-300 transition-colors">
              📋 选择任务复制到其他日期
            </button>
          ) : (
            <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between">
              <span className="text-xs text-purple-600">
                已选 {selectedCopyTasks.length} 个任务
              </span>
              <div className="flex gap-1">
                <button onClick={onShowCopy}
                  className="px-3 py-1 text-xs bg-purple-500 hover:bg-purple-600 text-white rounded transition-colors"
                  disabled={selectedCopyTasks.length === 0}>
                  复制到其他日期
                </button>
                <button onClick={() => { setCopyMode(false); setSelectedCopyTasks([]); }}
                  className="px-3 py-1 text-xs text-purple-400 hover:text-purple-600 transition-colors">
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Multi-date mode: show a button that opens BatchFillModal */}
      {isMulti && (
        <button onClick={onShowBatch}
          className="w-full py-3 mb-3 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
          批量添加任务 ({selectedDates.length} 天)
        </button>
      )}

      {/* Single-date mode: inline add form */}
      {!isMulti && !showForm && (
        <button onClick={() => { setShowForm(true); setNewStart(8); setNewEnd(10); setNewDesc(''); }}
          className="w-full py-2 mb-3 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors">
          + 添加任务
        </button>
      )}
      {!isMulti && showForm && (
        <div className="p-3 mb-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <label className="block text-[10px] text-gray-500 mb-0.5">开始</label>
              <select value={newStart} onChange={e => setNewStart(Number(e.target.value))}
                className="w-full px-2 py-1 text-xs border border-blue-200 rounded focus:outline-none focus:border-blue-400 bg-white">
                {HOURS.map(h => <option key={h} value={h}>{fmtHour(h)}</option>)}
              </select>
            </div>
            <span className="text-xs text-gray-400 mt-5">至</span>
            <div className="flex-1">
              <label className="block text-[10px] text-gray-500 mb-0.5">结束</label>
              <select value={newEnd} onChange={e => setNewEnd(Number(e.target.value))}
                className="w-full px-2 py-1 text-xs border border-blue-200 rounded focus:outline-none focus:border-blue-400 bg-white">
                {HOURS.map(h => <option key={h} value={h + 1}>{fmtHour(h + 1)}</option>)}
              </select>
            </div>
          </div>
          <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)}
            className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:outline-none focus:border-blue-400"
            placeholder="任务描述" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowForm(false); }} />
          <div className="flex gap-1">
            <button onClick={handleAdd} className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">添加</button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1 text-xs text-gray-400 hover:text-gray-600">取消</button>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="space-y-2">
        {tasks.length === 0 && !showForm && !isMulti && (
          <p className="text-xs text-gray-400 text-center py-8">当天暂无任务</p>
        )}
        {tasks.map(task => {
          const isEditing = editingTask?.id === task.id;
          return (
            <div key={task.id}
              className={`group p-3 rounded-lg border ${task.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:border-gray-200'}`}>

              {isEditing ? (
                <div className="space-y-2">
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
              ) : (
                <>
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {copyMode ? (
                        <input type="checkbox"
                          checked={selectedCopyTasks.some(t => t.id === task.id)}
                          onChange={() => {
                            setSelectedCopyTasks(prev =>
                              prev.some(t => t.id === task.id)
                                ? prev.filter(t => t.id !== task.id)
                                : [...prev, { id: task.id, start_hour: task.start_hour, end_hour: task.end_hour, description: task.description }]
                            );
                          }}
                          className="mt-1 shrink-0 cursor-pointer accent-purple-500" />
                      ) : (
                        <input type="checkbox" checked={!!task.completed} onChange={() => handleToggle(task.id)}
                          className="mt-1 shrink-0 cursor-pointer" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-blue-500 font-mono mb-0.5">
                          {fmtHour(task.start_hour)} - {fmtHour(task.end_hour)}
                        </div>
                        <span className={`text-sm ${task.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                          {task.description}
                        </span>
                        {task.submissions && task.submissions.length > 0 && (
                          <button onClick={() => setShowSubmissions(showSubmissions === task.id ? null : task.id)}
                            className="block text-[10px] text-blue-500 hover:text-blue-600 mt-0.5">
                            {task.submissions.length} 个提交物
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setEditingTask(task); setEditDesc(task.description); setEditStart(task.start_hour); setEditEnd(task.end_hour); }}
                        className="text-[10px] text-gray-400 hover:text-blue-500 md:opacity-0 md:group-hover:opacity-100 transition-opacity">编辑</button>
                      <button onClick={() => handleDelete(task.id)}
                        className="text-[10px] text-gray-400 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100 transition-opacity">删除</button>
                    </div>
                  </div>

                  {showSubmissions === task.id && (
                    <div className="mt-2 pl-6 space-y-1">
                      {task.submissions.map((sub, idx) => (
                        <div key={idx} className="text-xs text-gray-500 flex items-center gap-1">
                          {sub.type === 'text' && <span>📝 {sub.content}</span>}
                          {sub.type === 'image' && sub.file_path && (
                            <a href={`/api/uploads/${sub.file_path}`} target="_blank" rel="noreferrer">
                              <img src={`/api/uploads/${sub.file_path}`} alt={sub.content} className="max-w-[120px] max-h-[80px] rounded border cursor-pointer hover:opacity-80" />
                            </a>
                          )}
                          {sub.type === 'link' && <span>🔗 <a href={sub.content} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">{sub.content}</a></span>}
                          {sub.type === 'file' && sub.file_path && (
                            <a href={`/api/uploads/${sub.file_path}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                              📎 {sub.content || sub.file_path}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-1.5 flex gap-1.5 pl-6">
                    <button onClick={() => handleTextSub(task.id)}
                      className="text-[10px] px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded transition-colors">+文本</button>
                    <label className="text-[10px] px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded cursor-pointer transition-colors">
                      +文件
                      <input type="file" className="hidden" onChange={(e) => { if (e.target.files[0]) handleFileUpload(task.id, e.target.files[0]); }} />
                    </label>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Conflict dialog */}
      {conflictInfo && pendingAction && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setConflictInfo(null); setConflictType(null); setPendingAction(null); }}>
          <div className={`bg-white rounded-xl shadow-lg p-5 w-full max-w-sm mx-4 border-t-4 ${conflictType === 'same_name' ? 'border-yellow-400' : 'border-red-400'}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2">
              {conflictType === 'same_name' ? (
                <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              ) : (
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              )}
              <h4 className={`text-sm font-medium ${conflictType === 'same_name' ? 'text-yellow-700' : 'text-red-700'}`}>
                {conflictType === 'same_name' ? '同名任务' : '时段冲突'}
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
              <button onClick={() => resolveConflict('keep_both')}
                className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg transition-colors">
                {conflictType === 'same_name' ? '仍添加 — 保留新旧' : '全都要 — 新旧并行'}
              </button>
              <button onClick={() => resolveConflict('skip')}
                className="flex-1 py-2 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50 transition-colors">
                {conflictType === 'same_name' ? '取消添加' : '跳过 — 不加新的'}
              </button>
              <button onClick={() => resolveConflict('overwrite')}
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg transition-colors">
                替换 — 新的覆盖旧的
              </button>
            </div>
            {conflictType === 'same_name' && (
              <div className="text-center pt-1">
                <button onClick={() => resolveConflict('skip')}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  取消添加
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
