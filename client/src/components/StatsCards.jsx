import { useState, useEffect } from 'react';
import { plans as plansApi } from '../api';

export default function StatsCards({ planId, refreshTrigger }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!planId) return;
    setLoading(true);
    plansApi.stats(planId)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [planId, refreshTrigger]);

  if (loading) return null;
  if (!stats || !stats.completion) return null;

  const { completion, trend, streak, hours } = stats;
  const total = completion.total || 0;
  const done = completion.completed || 0;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {/* 总体完成率 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col items-center">
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e5e7eb" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#3b82f6" strokeWidth="3" strokeDasharray={`${rate} 100`} strokeLinecap="round" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-600">{rate}%</span>
        </div>
        <span className="text-[10px] text-gray-400 mt-1">完成率</span>
        <span className="text-[10px] text-gray-300">{done}/{total}</span>
      </div>

      {/* 近 7 天趋势 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col">
        <span className="text-[10px] text-gray-400 mb-1">近 7 天趋势</span>
        {trend.some(d => d.total > 0) ? (
          <svg className="w-full h-10" viewBox={`0 0 ${Math.max(trend.length - 1, 1) * 30} 40`} preserveAspectRatio="none">
            <polyline
              fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              points={trend.map((d, i) => {
                const max = Math.max(...trend.map(t => t.total), 1);
                const x = i * (trend.length > 1 ? 30 : 15);
                const y = 40 - (d.total / max) * 36;
                return `${x},${y}`;
              }).join(' ')}
            />
          </svg>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[10px] text-gray-300">近 7 天无任务</div>
        )}
      </div>

      {/* 连续学习天数 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-green-500">{streak}</span>
        <span className="text-[10px] text-gray-400">连续学习天</span>
      </div>

      {/* 最活跃时段 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col">
        <span className="text-[10px] text-gray-400 mb-1">最活跃时段</span>
        {hours?.[0]?.count > 0 ? (
          <div className="flex gap-1 mt-1 items-end h-8">
            {hours.slice(0, 6).map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <span className="text-[9px] text-gray-500">{h.count}</span>
                <div className="w-full bg-blue-100 rounded-t" style={{ height: `${Math.max((h.count / hours[0].count) * 28, 6)}px` }}>
                  <div className="bg-blue-400 rounded-t w-full h-full" style={{ height: `${(h.count / hours[0].count) * 100}%` }} />
                </div>
                <span className="text-[9px] text-gray-400">{String(h.start_hour).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[10px] text-gray-300">暂无数据</div>
        )}
      </div>
    </div>
  );
}
