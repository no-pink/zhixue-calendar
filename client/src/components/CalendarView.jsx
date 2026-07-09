import { useState, useEffect } from 'react';
import { plans as plansApi } from '../api';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function CalendarView({
  plan, onSelectDate, selectedDate, refreshTrigger, selectedDates, setSelectedDates, onBatch
}) {
  const [year, setYear] = useState(0);
  const [month, setMonth] = useState(0);
  const [tasksByDate, setTasksByDate] = useState({});

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

  const toggleDate = (dateStr, e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      setSelectedDates(prev => {
        if (prev.includes(dateStr)) return prev.filter(d => d !== dateStr);
        return [...prev, dateStr];
      });
    } else {
      onSelectDate(dateStr);
      if (!selectedDates.includes(dateStr)) {
        setSelectedDates([dateStr]);
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-medium text-gray-800">{plan?.name}</h2>
          <p className="text-xs text-gray-400">{plan?.start_date} ~ {plan?.end_date}</p>
        </div>
        {selectedDates.length > 1 && (
          <button onClick={onBatch}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
          >
            批量填充 ({selectedDates.length}天)
          </button>
        )}
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">&lt;</button>
        <span className="text-sm font-medium text-gray-700">{year}年{month}月</span>
        <button onClick={nextMonth} className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">&gt;</button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-center text-xs text-gray-400 py-1">{w}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells */}
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-20" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = formatDate(year, month, day);
          const inRange = isInPlanRange(year, month, day);
          const taskInfo = tasksByDate[dateStr];
          const isSelected = selectedDate === dateStr || selectedDates.includes(dateStr);
          const isToday = new Date().toISOString().slice(0, 10) === dateStr;

          return (
            <div
              key={day}
              onClick={(e) => inRange && toggleDate(dateStr, e)}
              className={`h-20 p-1.5 rounded-lg border text-sm relative transition-colors cursor-pointer
                ${!inRange ? 'bg-gray-50 text-gray-300 cursor-default border-gray-50' : ''}
                ${inRange && isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-100'}
                ${inRange && !isSelected ? 'hover:border-gray-200 hover:bg-gray-50' : ''}
                ${isToday && !isSelected ? 'border-blue-200' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-600'}`}>
                  {day}
                </span>
                {selectedDates.includes(dateStr) && (
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                )}
              </div>

              {inRange && taskInfo && (
                <div className="mt-1 space-y-0.5">
                  {taskInfo.total > 0 && (
                    <div className="flex items-center gap-1">
                      <div className="flex gap-0.5">
                        {Array.from({ length: Math.min(taskInfo.total, 5) }).map((_, j) => (
                          <div key={j}
                            className={`w-1.5 h-1.5 rounded-full ${j < taskInfo.completed ? 'bg-green-400' : 'bg-gray-300'}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400">
                    {taskInfo.completed}/{taskInfo.total}
                  </p>
                </div>
              )}
              {inRange && !taskInfo && (
                <div className="mt-2">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 1 }).map((_, j) => (
                      <div key={j} className="w-1.5 h-1.5 rounded-full bg-gray-100" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
