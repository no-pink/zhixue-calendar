export default function ConflictModeSelector({ conflictMode, onChange }) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">已有任务处理方式</label>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer p-2 rounded hover:bg-gray-50">
          <input type="radio" name="conflict" checked={conflictMode === 'keep_both'} onChange={() => onChange('keep_both')} />
          <div>
            <div className="font-medium text-gray-700">保留新旧</div>
            <div className="text-[10px] text-gray-400">保留原有任务，同时添加新的</div>
          </div>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer p-2 rounded hover:bg-gray-50">
          <input type="radio" name="conflict" checked={conflictMode === 'skip'} onChange={() => onChange('skip')} />
          <div>
            <div className="font-medium text-gray-700">跳过</div>
            <div className="text-[10px] text-gray-400">有冲突的日期/时段不添加</div>
          </div>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer p-2 rounded hover:bg-gray-50">
          <input type="radio" name="conflict" checked={conflictMode === 'overwrite'} onChange={() => onChange('overwrite')} />
          <div>
            <div className="font-medium text-gray-700">覆盖</div>
            <div className="text-[10px] text-gray-400">用新任务替换冲突的原有任务</div>
          </div>
        </label>
      </div>
    </div>
  );
}
