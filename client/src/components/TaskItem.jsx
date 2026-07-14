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
            <div className="text-[11px] text-blue-500 font-mono mb-0.5">
              {fmtHour(task.start_hour)} - {fmtHour(task.end_hour)}
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
