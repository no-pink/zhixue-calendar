import { useState, useEffect } from 'react';
import { tasks as tasksApi } from '../api';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function TaskPanel({ planId, date, refreshTrigger, onRefresh, selectedDates }) {
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
  const [conflictInfo, setConflictInfo] = useState(null);  // { resolve: fn } awaiting user choice
  const [pendingAction, setPendingAction] = useState(null); // { type, params }

  const isMulti = selectedDates && selectedDates.length > 1;
  const activeDates = isMulti ? selectedDates : [date];

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
    setPendingAction(null);

    if (mode === 'cancel') return;

    try {
      if (type === 'add') {
        if (isMulti) {
          const res = await tasksApi.batchSimple({ ...params, conflict_mode: mode });
          if (res.conflict && mode === 'skip') {
            // If there are still conflicts in skip mode, it means some dates had no conflict
            // and batch-simple already handled it. Just refresh.
          }
        } else {
          if (mode === 'overwrite') {
            await tasksApi.create({ ...params, force: true });
          }
          // skip = don't create
        }
      } else if (type === 'edit') {
        await tasksApi.update(editingTask.id, {
          description: params.description,
          start_hour: params.start_hour,
          end_hour: params.end_hour,
          force: mode === 'overwrite',
        });
        setEditingTask(null);
      }
      await fetchTasks();
      onRefresh();
    } catch (e) { alert(e.message); }
    setShowForm(false);
  };

  const handleAdd = async () => {
    if (!newDesc.trim()) return;
    const params = {
      plan_id: planId, date, start_hour: newStart, end_hour: newEnd,
      description: newDesc.trim(),
    };

    try {
      if (isMulti) {
        const res = await tasksApi.batchSimple({ ...params, dates: activeDates });
        if (res.conflict) {
          setConflictInfo(res.overlapping);
          setPendingAction({ type: 'add', params: { ...params, dates: activeDates } });
          return;
        }
      } else {
        const res = await tasksApi.create(params);
        if (res.conflict) {
          setConflictInfo(res.overlapping);
          setPendingAction({ type: 'add', params });
          return;
        }
      }
      setNewDesc('');
      setShowForm(false);
      await fetchTasks();
      onRefresh();
    } catch (e) { alert(e.message); }
  };

  const handleToggle = async (id) => {
    try {
      await tasksApi.toggle(id);
      await fetchTasks();
      onRefresh();
    } catch (e) { alert(e.message); }
  };

  const handleUpdate = async () => {
    if (!editDesc.trim()) return;
    const params = { description: editDesc.trim(), start_hour: editStart, end_hour: editEnd };
    try {
      const res = await tasksApi.update(editingTask.id, params);
      if (res.conflict) {
        setConflictInfo(res.overlapping);
        setPendingAction({ type: 'edit', params });
        return;
      }
      setEditingTask(null);
      await fetchTasks();
    } catch (e) { alert(e.message); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确定删除此任务？')) return;
    try {
      await tasksApi.delete(id);
      await fetchTasks();
      onRefresh();
    } catch (e) { alert(e.message); }
  };

  const handleFileUpload = async (taskId, file) => {
    try {
      const data = await tasksApi.upload(file);
      const task = tasks.find(t => t.id === taskId);
      const subs = [...(task?.submissions || []), { type: file.type.startsWith('image/') ? 'image' : 'file', content: file.name, file_path: data.file_path }];
      await tasksApi.update(taskId, { submissions: subs });
      await fetchTasks();
    } catch (e) { alert(e.message); }
  };

  const handleTextSub = async (taskId) => {
    const text = prompt('请输入提交物文本：');
    if (!text) return;
    try {
      const task = tasks.find(t => t.id === taskId);
      const subs = [...(task?.submissions || []), { type: 'text', content: text }];
      await tasksApi.update(taskId, { submissions: subs });
      await fetchTasks();
    } catch (e) { alert(e.message); }
  };

  const fmtHour = (h) => String(h).padStart(2, '0') + ':00';
  const conflictText = conflictInfo
    ? conflictInfo.map(o => `${o.date ? o.date + ' ' : ''}${fmtHour(o.start_hour)}-${fmtHour(o.end_hour)} ${o.description}`).join('\n')
    : '';

  if (loading) return <div className="p-4 text-sm text-gray-400">加载中...</div>;

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

      {/* Add task button */}
      {!showForm && (
        <button onClick={() => { setShowForm(true); setNewStart(8); setNewEnd(10); setNewDesc(''); }}
          className="w-full py-2 mb-3 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors">
          {isMulti ? '+ 添加到所有选中日期' : '+ 添加任务'}
        </button>
      )}

      {/* Add task form */}
      {showForm && (
        <div className="p-3 mb-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
          {isMulti && (
            <p className="text-[10px] text-blue-500">将添加到 {selectedDates.length} 天</p>
          )}
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
        {tasks.length === 0 && !showForm && (
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
                      <input type="checkbox" checked={!!task.completed} onChange={() => handleToggle(task.id)}
                        className="mt-1 shrink-0 cursor-pointer" />
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
                        className="text-[10px] text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">编辑</button>
                      <button onClick={() => handleDelete(task.id)}
                        className="text-[10px] text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">删除</button>
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
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setConflictInfo(null); setPendingAction(null); }}>
          <div className="bg-white rounded-xl shadow-lg p-5 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h4 className="text-sm font-medium text-gray-800 mb-2">时段冲突</h4>
            <p className="text-xs text-gray-500 mb-3">以下任务时间有重叠：</p>
            <div className="text-xs text-gray-600 bg-gray-50 rounded p-2 mb-4 whitespace-pre-line font-mono">
              {conflictText}
            </div>
            <div className="flex gap-2">
              <button onClick={() => resolveConflict('keep_both')}
                className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg transition-colors">
                全都要 — 新旧并行
              </button>
              <button onClick={() => resolveConflict('skip')}
                className="flex-1 py-2 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50 transition-colors">
                跳过 — 不加新的
              </button>
              <button onClick={() => resolveConflict('overwrite')}
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg transition-colors">
                替换 — 新的覆盖旧的
              </button>
            </div>
            <div className="text-center pt-1">
              <button onClick={() => resolveConflict('cancel')}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                取消操作
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
