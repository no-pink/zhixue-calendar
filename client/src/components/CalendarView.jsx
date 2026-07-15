import { useState, useEffect, useRef } from 'react';
import { plans as plansApi } from '../api';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function CalendarView({
  plan, onSelectDate, selectedDate, refreshTrigger, selectedDates, setSelectedDates, onBatch
}) {
  const [year, setYear] = useState(0);
  const [month, setMonth] = useState(0);
  const [tasksByDate, setTasksByDate] = useState({});
  const [multiMode, setMultiMode] = useState(false);
  const touchStartX = useRef(null);
  const calendarRef = useRef(null);

  useEffect(() => {
    if (plan) {
      const s = new Date(plan.start_date);
      setYear(s.getFullYear());
      setMonth(s.getMonth() + 1);
    }
  }, [plan]);

  useEffect(() => {
    if (!plan) return;
    const load = async () => {
      try {
        const data = await plansApi.calendar(plan.id);
        const map = {};
        data.tasks.forEach(t => { map[t.date] = t; });
        setTasksByDate(map);
      } catch (e) { console.error(e); }
    };
    load();
  }, [plan, refreshTrigger]);

  // Keyboard navigation for months
  useEffect(() => {
    const el = calendarRef.current;
    if (!el) return;
    const handler = (e) => {
      if (e.key === 'ArrowLeft') prevMonth();
      else if (e.key === 'ArrowRight') nextMonth();
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [year, month]); // re-attach when year/month changes so closure captures latest prev/next

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(diff) > 50) {
      if (diff > 0) prevMonth();
      else nextMonth();
    }
  };

  const [startYear, startMonth, startDay] = (plan?.start_date || '').split('-').map(Number);
  const [endYear, endMonth, endDay] = (plan?.end_date || '').split('-').map(Number);

  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0);
  const startDayOfWeek = startOfMonth.getDay();
  const daysInMonth = endOfMonth.getDate();

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const isInPlanRange = (y, m, d) => {
    const date = new Date(y, m - 1, d);
    if (startYear && endYear) {
      const start = new Date(startYear, startMonth - 1, startDay);
      const end = new Date(endYear, endMonth - 1, endDay);
      return date >= start && date <= end;
    }
    return true;
  };

  const formatDate = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const toggleMultiSelect = (deselectedDate) => {
    setSelectedDates(prev => {
      const next = prev.includes(deselectedDate)
        ? prev.filter(d => d !== deselectedDate)
        : [...prev, deselectedDate];
      if (next.length === 0) onSelectDate(null);
      else if (prev.includes(deselectedDate) && prev.length > 1) onSelectDate(next[0]);
      return next;
    });
  };

  const selectDate = (dateStr, e) => {
    if (multiMode) {
      toggleMultiSelect(dateStr);
    } else if (e.ctrlKey || e.metaKey || e.shiftKey) {
      toggleMultiSelect(dateStr);
    } else {
      if (selectedDate === dateStr && selectedDates.length <= 1) {
        onSelectDate(null);
        setSelectedDates([]);
      } else {
        onSelectDate(dateStr);
        setSelectedDates([dateStr]);
      }
    }
  };

  const exitMultiMode = () => {
    setMultiMode(false);
    setSelectedDates([]);
    onSelectDate(null);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-medium text-gray-800">{plan?.name}</h2>
          <p className="text-xs text-gray-400">{plan?.start_date} ~ {plan?.end_date}</p>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">&lt;</button>
        <span className="text-sm font-medium text-gray-700">{year}年{month}月</span>
        <button onClick={nextMonth} className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">&gt;</button>
      </div>

      {/* Multi-select toggle */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { if (multiMode) exitMultiMode(); else setMultiMode(true); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              multiMode
                ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                : 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
            }`}
          >
            {multiMode ? '✓ 多选模式已开启' : '☐ 多选模式'}
          </button>
        </div>
        {selectedDates.length > 0 && (
          <button onClick={() => exitMultiMode()}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors">
            清除选中 ({selectedDates.length})
          </button>
        )}
      </div>

      {/* Status hint */}
      {!multiMode && selectedDates.length <= 1 && (
        <p className="text-xs text-gray-400 mb-2">
          <svg className="w-3.5 h-3.5 inline mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
          点击日期查看任务，<span className="text-blue-500 font-medium">多选</span>可批量操作
        </p>
      )}
      {multiMode && (
        <p className="text-xs text-blue-500 mb-2">多选模式 — 点击日期切换选中，操作完成后自动退出</p>
      )}

      {/* Batch fill bar — appears when 2+ dates selected */}
      {selectedDates.length > 1 && (
        <div className="mb-3 p-3 bg-blue-500 rounded-lg flex items-center justify-between shadow-sm">
          <span className="text-sm font-medium text-white">已选 {selectedDates.length} 天</span>
          <div className="flex gap-2">
            <button onClick={() => exitMultiMode()}
              className="px-3 py-1.5 text-xs text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
              取消
            </button>
            <button onClick={onBatch}
              className="px-4 py-1.5 bg-white text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-50 transition-colors shadow">
              批量填充
            </button>
          </div>
        </div>
      )}

      {/* Calendar wrapper — touch + keyboard zone */}
      <div
        ref={calendarRef}
        tabIndex={0}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="-mx-4 sm:-mx-6 px-4 sm:px-6 outline-none"
      >
        {/* Mobile: single-row scrollable list */}
        <div className="md:hidden mb-2 overflow-y-auto max-h-[400px]">
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = formatDate(year, month, day);
            const inRange = isInPlanRange(year, month, day);
            const taskInfo = tasksByDate[dateStr];
            const isMultiSelected = selectedDates.includes(dateStr);
            const isSingleSelected = selectedDate === dateStr && selectedDates.length <= 1;
            const isSelected = isSingleSelected || isMultiSelected;
            const isToday = new Date().toISOString().slice(0, 10) === dateStr;
            if (!inRange) return null;
            return (
              <div key={day} onClick={(e) => selectDate(dateStr, e)}
                className={`flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium shrink-0 ${isToday ? 'bg-blue-500 text-white' : isSelected ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}>
                  {day}
                </div>
                <div className="flex-1 min-w-0">
                  {taskInfo ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full" style={{ width: taskInfo.total > 0 ? `${(taskInfo.completed / taskInfo.total) * 100}%` : '0%' }} />
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">{taskInfo.completed}/{taskInfo.total}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">无任务</span>
                  )}
                </div>
                {isMultiSelected && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
              </div>
            );
          })}
        </div>

        {/* Desktop: grid calendar */}
        <div className="hidden md:block min-w-[490px]">
      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-center text-xs text-gray-400 py-1">{w}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 auto-rows-fr">
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = formatDate(year, month, day);
          const inRange = isInPlanRange(year, month, day);
          const taskInfo = tasksByDate[dateStr];
          const isMultiSelected = selectedDates.includes(dateStr);
          const isSingleSelected = selectedDate === dateStr && selectedDates.length <= 1;
          const isSelected = isSingleSelected || isMultiSelected;
          const isToday = new Date().toISOString().slice(0, 10) === dateStr;

          return (
            <div
              key={day}
              onClick={(e) => inRange && selectDate(dateStr, e)}
              className={`min-h-[72px] sm:min-h-[88px] p-1.5 rounded-lg border text-sm relative transition-colors cursor-pointer
                ${!inRange ? 'bg-gray-50 text-gray-300 cursor-default border-gray-50' : ''}
                ${inRange && isMultiSelected ? 'border-blue-400 bg-blue-50' : ''}
                ${inRange && isSingleSelected ? 'border-blue-400 bg-blue-50' : ''}
                ${inRange && !isSelected ? 'border-gray-100 hover:border-gray-200 hover:bg-gray-50' : ''}
                ${isToday && !isSelected ? 'border-blue-200' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-600'}`}>
                  {day}
                </span>
                {isMultiSelected && (
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                )}
              </div>

              {inRange && taskInfo && (
                <div className="mt-1.5 space-y-1">
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full transition-all duration-300"
                        style={{ width: taskInfo.total > 0 ? `${(taskInfo.completed / taskInfo.total) * 100}%` : '0%' }} />
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    {taskInfo.completed}/{taskInfo.total}
                  </p>
                </div>
              )}
              {inRange && !taskInfo && (
                <div className="mt-2">
                  <div className="flex gap-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-100" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
        </div>{/* end md:block grid */}
      </div>{/* end calendar wrapper */}
    </div>
  );
}
