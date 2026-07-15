import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import PlanList from './PlanList';
import CalendarView from './CalendarView';
import TaskPanel from './TaskPanel';
import BatchFillModal from './BatchFillModal';
import CopyTasksModal from './CopyTasksModal';
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
  const [showTaskPanel, setShowTaskPanel] = useState(false);
  const [selectedCopyTasks, setSelectedCopyTasks] = useState([]);
  const [showCopy, setShowCopy] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const dashboardRef = useRef(null);

  // Mobile: swipe from left edge to open sidebar
  useEffect(() => {
    const el = dashboardRef.current;
    if (!el || window.innerWidth >= 640) return;
    let touchStart = 0;
    const onTouchStart = (e) => { touchStart = e.touches[0].clientX; };
    const onTouchEnd = (e) => {
      if (touchStart < 30 && e.changedTouches[0].clientX - touchStart > 60) {
        setShowSidebar(true);
      }
    };
    el.addEventListener('touchstart', onTouchStart);
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const refresh = () => setRefreshKey(k => k + 1);

  const handlePlanDeleted = () => {
    if (selectedPlan) {
      setSelectedPlan(null);
      setSelectedDate(null);
    }
    refresh();
  };

  return (
    <div ref={dashboardRef} className="h-screen flex flex-col bg-[#f5f6f8]">
      {/* Header */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 shrink-0">
        <div className="flex items-center gap-2">
          {/* Mobile hamburger */}
          <button onClick={() => setShowSidebar(true)}
            className="sm:hidden p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-800">智学日程</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user?.username || user?.name}</span>
          <button onClick={() => setShowSettings(true)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">设置</button>
          <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">退出</button>
        </div>
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Plan list (desktop always visible) */}
        <div className="w-60 md:w-72 bg-white border-r border-gray-200 overflow-y-auto shrink-0 hidden sm:block">
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

        {/* Mobile sidebar drawer */}
        {showSidebar && (
          <div className="fixed inset-0 z-50 sm:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowSidebar(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl animate-slide-right">
              <div className="flex items-center justify-between p-3 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-700">计划列表</span>
                <button onClick={() => setShowSidebar(false)} className="text-xs text-gray-400 hover:text-gray-600">&times;</button>
              </div>
              <PlanList
                onSelect={plan => {
                  setSelectedPlan(plan);
                  setSelectedDate(null);
                  setSelectedDates([]);
                  setShowSidebar(false);
                }}
                selectedPlanId={selectedPlan?.id}
                refreshTrigger={refreshKey}
                onPlanDeleted={handlePlanDeleted}
              />
            </div>
          </div>
        )}

        {/* Right content area */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {selectedPlan ? (
            <>
              {/* Calendar */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <CalendarView
                  plan={selectedPlan}
                  onSelectDate={date => {
                    setSelectedDate(date);
                    setShowTaskPanel(!!date);
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

              {/* Task detail panel — collapsible on mobile */}
              {selectedDate && (
                <>
                  {/* Mobile toggle button */}
                  <button
                    onClick={() => setShowTaskPanel(!showTaskPanel)}
                    className="md:hidden fixed bottom-4 right-4 z-40 px-4 py-2 bg-blue-500 text-white text-sm rounded-full shadow-lg"
                  >
                    {showTaskPanel ? '关闭任务' : '查看任务'}
                  </button>

                  {/* Panel */}
                  <div className={`
                    ${showTaskPanel ? 'fixed inset-0 z-30 md:static' : 'hidden md:block'}
                    md:w-80 lg:w-96 md:relative
                    bg-white border-l border-gray-200 shrink-0 flex flex-col
                    overflow-hidden
                  `}>
                    {showTaskPanel && (
                      <div className="md:hidden flex items-center justify-between p-3 border-b border-gray-100 shrink-0">
                        <span className="text-sm font-medium text-gray-700">任务详情</span>
                        <button onClick={() => setShowTaskPanel(false)} className="text-xs text-gray-400 hover:text-gray-600">关闭</button>
                      </div>
                    )}
                    <TaskPanel
                      planId={selectedPlan.id}
                      date={selectedDate}
                      refreshTrigger={refreshKey}
                      onRefresh={refresh}
                      selectedDates={selectedDates}
                      onShowBatch={() => setShowBatch(true)}
                      onShowCopy={() => setShowCopy(true)}
                      selectedCopyTasks={selectedCopyTasks}
                      setSelectedCopyTasks={setSelectedCopyTasks}
                    />
                  </div>
                </>
              )}
              {!selectedDate && (
                <div className="hidden md:flex w-80 lg:w-96 flex-col items-center justify-center bg-white border-l border-gray-200 text-sm text-gray-400 shrink-0 gap-2">
                  <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>请选择日期查看任务</span>
                </div>
              )}
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

      {showCopy && (
        <CopyTasksModal
          planId={selectedPlan.id}
          selectedTasks={selectedCopyTasks}
          onClose={() => { setShowCopy(false); setSelectedCopyTasks([]); }}
          onSuccess={() => { setShowCopy(false); setSelectedCopyTasks([]); refresh(); }}
        />
      )}

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
