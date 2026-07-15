import { useState } from 'react';
import { tasks as tasksApi } from '../api';
import { useToast } from '../context/ToastContext';

const fmtHour = (h) => String(h).padStart(2, '0') + ':00';

export default function TaskItem({ task, copyMode, selectedCopyTasks, setSelectedCopyTasks, onRefresh, onToggle, onEdit }) {
  const [showSubs, setShowSubs] = useState(false);
  const toast = useToast();

  const handleDelete = async () => {
    if (!window.confirm('确定删除此任务？')) return;
    try {
      await tasksApi.delete(task.id);
      onRefresh();
    } catch (e) { toast.error(e.message); }
  };

  const handleFileUpload = async (file) => {
    try {
      const data = await tasksApi.upload(file);
      const subs = [...(task.submissions || []), { type: file.type.startsWith('image/') ? 'image' : 'file', content: file.name, file_path: data.file_path }];
      await tasksApi.update(task.id, { submissions: subs });
      onRefresh();
    } catch (e) { toast.error(e.message); }
  };

  const handleTextSub = async () => {
    const text = prompt('请输入提交物文本：');
    if (!text) return;
    try {
      const subs = [...(task.submissions || []), { type: 'text', content: text }];
      await tasksApi.update(task.id, { submissions: subs });
      onRefresh();
    } catch (e) { toast.error(e.message); }
  };

  const adjustHour = async (delta) => {
    const newStart = Math.max(0, Math.min(23, task.start_hour + delta));
    const newEnd = Math.max(1, Math.min(24, task.end_hour + delta));
    if (newStart === task.start_hour && newEnd === task.end_hour) return;
    try {
      await tasksApi.update(task.id, { start_hour: newStart, end_hour: newEnd, force: true });
      onRefresh();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className={`group p-3 rounded-lg border ${task.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
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
            <input type="checkbox" checked={!!task.completed} onChange={() => onToggle(task.id)}
              className="mt-1 shrink-0 cursor-pointer" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-blue-500 font-mono mb-0.5 flex items-center gap-1">
              <button onClick={() => adjustHour(-1)} title="提前1小时"
                className="text-[10px] px-1 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-colors leading-none">&minus;</button>
              <span>{fmtHour(task.start_hour)} - {fmtHour(task.end_hour)}</span>
              <button onClick={() => adjustHour(1)} title="延后1小时"
                className="text-[10px] px-1 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-colors leading-none">+</button>
            </div>
            <span className={`text-sm ${task.completed ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
              {task.description}
            </span>
            {task.submissions && task.submissions.length > 0 && (
              <button onClick={() => setShowSubs(!showSubs)}
                className="block text-[10px] text-blue-500 hover:text-blue-600 mt-0.5">
                {task.submissions.length} 个提交物
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEdit(task)}
            className="text-[10px] text-gray-400 hover:text-blue-500 md:opacity-0 md:group-hover:opacity-100 transition-opacity">编辑</button>
          <button onClick={handleDelete}
            className="text-[10px] text-gray-400 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100 transition-opacity">删除</button>
        </div>
      </div>

      {showSubs && (
        <div className="mt-2 pl-6 space-y-1">
          {task.submissions.map((sub, idx) => (
            <div key={idx} className="text-xs text-gray-500 flex items-center gap-1">
              {sub.type === 'text' && <span><svg className="w-4 h-4 inline mr-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> {sub.content}</span>}
              {sub.type === 'image' && sub.file_path && (
                <a href={`/api/uploads/${sub.file_path}`} target="_blank" rel="noreferrer">
                  <img src={`/api/uploads/${sub.file_path}`} alt={sub.content} className="max-w-[120px] max-h-[80px] rounded border cursor-pointer hover:opacity-80" />
                </a>
              )}
              {sub.type === 'link' && <span><svg className="w-4 h-4 inline mr-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg> <a href={sub.content} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">{sub.content}</a></span>}
              {sub.type === 'file' && sub.file_path && (
                <a href={`/api/uploads/${sub.file_path}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                  <svg className="w-4 h-4 inline shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg> {sub.content || sub.file_path}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-1.5 flex gap-1.5 pl-6">
        <button onClick={handleTextSub}
          className="text-[10px] px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded transition-colors">+文本</button>
        <label className="text-[10px] px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded cursor-pointer transition-colors">
          +文件
          <input type="file" className="hidden" onChange={(e) => { if (e.target.files[0]) handleFileUpload(e.target.files[0]); }} />
        </label>
      </div>
    </div>
  );
}
