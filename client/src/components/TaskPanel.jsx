import { useState, useEffect } from 'react';
import { tasks as tasksApi } from '../api';

export default function TaskPanel({ planId, date, refreshTrigger, onRefresh }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTask, setEditingTask] = useState(null);
  const [editDesc, setEditDesc] = useState('');
  const [showAddAt, setShowAddAt] = useState(null);
  const [newDesc, setNewDesc] = useState('');
  const [showSubmissions, setShowSubmissions] = useState(null);

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

  const taskMap = {};
  for (let h = 0; h < 24; h++) taskMap[h] = null;
  tasks.forEach(t => { taskMap[t.hour] = t; });

  const handleAdd = async (hour) => {
    if (!newDesc.trim()) return;
    try {
      await tasksApi.create({ plan_id: planId, date, hour, description: newDesc.trim() });
      setNewDesc('');
      setShowAddAt(null);
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

  const handleUpdate = async (id) => {
    if (!editDesc.trim()) return;
    try {
      await tasksApi.update(id, { description: editDesc.trim() });
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

  // File upload handler
  const handleFileUpload = async (taskId, file) => {
    try {
      const data = await tasksApi.upload(file);
      const task = tasks.find(t => t.id === taskId);
      const subs = [...(task?.submissions || []), { type: file.type.startsWith('image/') ? 'image' : 'file', content: file.name, file_path: data.file_path }];
      await tasksApi.update(taskId, { submissions: subs });
      await fetchTasks();
    } catch (e) { alert(e.message); }
  };

  // Text submission
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

  if (loading) return <div className="p-4 text-sm text-gray-400">加载中...</div>;

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-1">任务详情</h3>
      <p className="text-xs text-gray-400 mb-4">{date}</p>

      <div className="space-y-1">
        {Array.from({ length: 24 }).map((_, hour) => {
          const task = taskMap[hour];
          const isEditing = editingTask === task?.id;

          return (
            <div key={hour} className="group flex items-start gap-2">
              {/* Time label */}
              <div className="w-12 shrink-0 text-right pt-1.5">
                <span className="text-xs text-gray-400 font-mono">{String(hour).padStart(2, '0')}:00</span>
              </div>

              {/* Slot content */}
              <div className="flex-1 min-w-0">
                {task ? (
                  <div className={`p-2 rounded-lg border ${task.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                    {isEditing ? (
                      <div className="flex gap-1">
                        <input
                          type="text" value={editDesc}
                          onChange={e => setEditDesc(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') handleUpdate(task.id); if (e.key === 'Escape') setEditingTask(null); }}
                        />
                        <button onClick={() => handleUpdate(task.id)} className="px-2 py-1 text-xs bg-blue-500 text-white rounded">确定</button>
                        <button onClick={() => setEditingTask(null)} className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600">取消</button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={!!task.completed}
                              onChange={() => handleToggle(task.id)}
                              className="mt-1 shrink-0 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm ${task.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                {task.description}
                              </span>
                              {/* Submission indicators */}
                              {task.submissions && task.submissions.length > 0 && (
                                <button
                                  onClick={() => setShowSubmissions(showSubmissions === task.id ? null : task.id)}
                                  className="block text-[10px] text-blue-500 hover:text-blue-600 mt-0.5"
                                >
                                  {task.submissions.length} 个提交物
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => { setEditingTask(task.id); setEditDesc(task.description); }}
                              className="text-[10px] text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">编辑</button>
                            <button onClick={() => handleDelete(task.id)}
                              className="text-[10px] text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">删除</button>
                          </div>
                        </div>

                        {/* Submissions panel */}
                        {showSubmissions === task.id && (
                          <div className="mt-2 pl-6 space-y-1">
                            {task.submissions.map((sub, idx) => (
                              <div key={idx} className="text-xs text-gray-500 flex items-center gap-1">
                                {sub.type === 'text' && <span>📝 {sub.content}</span>}
                                {sub.type === 'image' && sub.file_path && (
                                  <a href={`/api${sub.file_path.startsWith('/') ? '' : '/uploads/'}${sub.file_path}`} target="_blank" rel="noreferrer">
                                    <img src={`/api/uploads/${sub.file_path}`} alt={sub.content} className="max-w-[120px] max-h-[80px] rounded border cursor-pointer hover:opacity-80" />
                                  </a>
                                )}
                                {sub.type === 'link' && <span>🔗 <a href={sub.content} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">{sub.content}</a></span>}
                                {sub.type === 'file' && sub.file_path && (
                                  <a href={`/api/uploads/${sub.file_path}`} target="_blank" rel="noreferrer"
                                    className="text-blue-500 hover:underline flex items-center gap-1">
                                    📎 {sub.content || sub.file_path}
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add submission buttons */}
                        <div className="mt-1.5 flex gap-1.5 pl-6">
                          <button onClick={() => handleTextSub(task.id)}
                            className="text-[10px] px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded transition-colors">
                            +文本
                          </button>
                          <label className="text-[10px] px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded cursor-pointer transition-colors">
                            +文件
                            <input type="file" className="hidden" onChange={(e) => { if (e.target.files[0]) handleFileUpload(task.id, e.target.files[0]); }} />
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => { setShowAddAt(hour); setNewDesc(''); }}
                    className="h-9 border border-dashed border-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <span className="text-[10px] text-gray-300">点击添加任务</span>
                  </div>
                )}

                {/* New task form inline */}
                {showAddAt === hour && !task && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex gap-1">
                      <input
                        type="text" value={newDesc}
                        onChange={e => setNewDesc(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-blue-200 rounded focus:outline-none focus:border-blue-400"
                        placeholder="任务描述"
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleAdd(hour); if (e.key === 'Escape') setShowAddAt(null); }}
                      />
                      <button onClick={() => handleAdd(hour)} className="px-2 py-1 text-xs bg-blue-500 text-white rounded">添加</button>
                      <button onClick={() => setShowAddAt(null)} className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600">取消</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
