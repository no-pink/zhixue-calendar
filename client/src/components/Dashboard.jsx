import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PlanList from './PlanList';
import CalendarView from './CalendarView';
import TaskPanel from './TaskPanel';
import BatchFillModal from './BatchFillModal';
import SettingsModal from './SettingsModal';
import { plans as plansApi } from '../api';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showBatch, setShowBatch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);

  const refresh = () => setRefreshKey(k => k + 1);

  const handlePlanDeleted = () => {
    if (selectedPlan) {
      setSelectedPlan(null);
      setSelectedDate(null);
    }
    refresh();
  };

  return (
    <div className="h-screen flex flex-col bg-[#f5f6f8]">
      {/* Header */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
        <h1 className="text-lg font-semibold text-gray-800">智学日程</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user?.username || user?.name}</span>
          <button onClick={() => setShowSettings(true)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">设置</button>
          <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">退出</button>
        </div>
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Plan list */}
        <div className="w-72 bg-white border-r border-gray-200 overflow-y-auto shrink-0">
          <PlanList
            onSelect={plan => {
              setSelectedPlan(plan);
              setSelectedDate(null);
              setSelectedDates([]);
            }}
            selectedPlanId={selectedPlan?.id}
            refreshTrigger={refreshKey}
            onPlanDeleted={handlePlanDeleted}
          />
        </div>

        {/* Right content area */}
        <div className="flex-1 flex overflow-hidden">
          {selectedPlan ? (
            <>
              {/* Calendar */}
              <div className="flex-1 overflow-y-auto p-6">
                <CalendarView
                  plan={selectedPlan}
                  onSelectDate={date => {
                    setSelectedDate(date);
                    if (date) {
                      setSelectedDates(prev => {
                        if (prev.includes(date)) return prev;
                        return [date];
                      });
                    } else {
                      setSelectedDates([]);
                    }
                  }}
                  selectedDate={selectedDate}
                  refreshTrigger={refreshKey}
                  onRefresh={refresh}
                  selectedDates={selectedDates}
                  setSelectedDates={setSelectedDates}
                  onBatch={() => setShowBatch(true)}
                />
              </div>

              {/* Task detail panel */}
              <div className="w-96 bg-white border-l border-gray-200 overflow-y-auto shrink-0">
                {selectedDate ? (
                  <TaskPanel
                    planId={selectedPlan.id}
                    date={selectedDate}
                    refreshTrigger={refreshKey}
                    onRefresh={refresh}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-gray-400">
                    请选择日期查看任务
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center flex-1 text-sm text-gray-400">
              请选择或创建一个计划
            </div>
          )}
        </div>
      </div>

      {showBatch && selectedPlan && (
        <BatchFillModal
          planId={selectedPlan.id}
          dates={selectedDates}
          onClose={() => setShowBatch(false)}
          onSuccess={() => { setShowBatch(false); refresh(); }}
        />
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
