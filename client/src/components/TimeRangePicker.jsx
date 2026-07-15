const HOURS = Array.from({ length: 24 }, (_, i) => i);
const fmtHour = (h) => String(h).padStart(2, '0') + ':00';

export default function TimeRangePicker({ startHour, endHour, onStartChange, onEndChange, compact = false }) {
  return (
    <div className={`flex gap-2 items-center ${compact ? '' : ''}`}>
      <div className="flex-1">
        <label className="block text-[10px] text-gray-500 mb-0.5">开始</label>
        <select value={startHour} onChange={e => onStartChange(Number(e.target.value))}
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white">
          {HOURS.map(h => <option key={h} value={h}>{fmtHour(h)}</option>)}
        </select>
      </div>
      <span className="text-xs text-gray-400 mt-5">至</span>
      <div className="flex-1">
        <label className="block text-[10px] text-gray-500 mb-0.5">结束</label>
        <select value={endHour} onChange={e => onEndChange(Number(e.target.value))}
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white">
          {HOURS.map(h => <option key={h} value={h + 1}>{fmtHour(h + 1)}</option>)}
        </select>
      </div>
    </div>
  );
}
