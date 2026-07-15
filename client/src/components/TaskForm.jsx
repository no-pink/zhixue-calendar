import { useState } from 'react';
import TimeRangePicker from './TimeRangePicker';

export default function TaskForm({ onAdd, onCancel }) {
  const [start, setStart] = useState(8);
  const [end, setEnd] = useState(10);
  const [desc, setDesc] = useState('');

  const handleSubmit = () => { onAdd(start, end, desc); };
  return (
    <div className="p-3 mb-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
      <TimeRangePicker startHour={start} endHour={end} onStartChange={setStart} onEndChange={setEnd} />
      <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
        className="w-full px-2 py-1 text-sm border border-blue-200 rounded focus:outline-none focus:border-blue-400"
        placeholder="任务描述" autoFocus
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onCancel(); }} />
      <div className="flex gap-1">
        <button onClick={handleSubmit} className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600">添加</button>
        <button onClick={onCancel} className="px-3 py-1 text-xs text-gray-400 hover:text-gray-600">取消</button>
      </div>
    </div>
  );
}
