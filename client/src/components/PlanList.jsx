import { useState, useEffect } from 'react';
import { plans as plansApi } from '../api';

export default function PlanList({ onSelect, selectedPlanId, refreshTrigger, onPlanDeleted }) {
  const [list, setList] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingPlan, setEditingPlan] = useState(null);
  const [error, setError] = useState('');

  const fetchPlans = async () => {
    try {
      const data = await plansApi.list();
      setList(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchPlans(); }, [refreshTrigger]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const plan = await plansApi.create({ name, start_date: startDate, end_date: endDate });
      setShowCreate(false);
      setName(''); setStartDate(''); setEndDate('');
      await fetchPlans();
      onSelect(plan);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await plansApi.update(editingPlan.id, { name, start_date: startDate, end_date: endDate });
      setEditingPlan(null);
      setName(''); setStartDate(''); setEndDate('');
      await fetchPlans();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确定删除此计划？所有相关任务将被一并删除。')) return;
    try {
      await plansApi.delete(id);
      if (selectedPlanId === id) onPlanDeleted();
      await fetchPlans();
    } catch (err) {
      alert(err.message);
    }
  };

  const startEdit = (plan) => {
    setEditingPlan(plan);
    setName(plan.name);
    setStartDate(plan.start_date);
    setEndDate(plan.end_date);
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-gray-700">我的计划</h2>
        <button
          onClick={() => { setShowCreate(true); setEditingPlan(null); setName(''); setStartDate(''); setEndDate(''); }}
          className="text-xs px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          + 新建计划
        </button>
      </div>

      {/* Create / Edit form */}
      {(showCreate || editingPlan) && (
        <form onSubmit={editingPlan ? handleUpdate : handleCreate} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
          <h3 className="text-xs font-medium text-gray-600">{editingPlan ? '编辑计划' : '新建计划'}</h3>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">计划名称</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400" required />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-xs text-gray-500 mb-0.5">开始日期</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400" required />
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-xs text-gray-500 mb-0.5">结束日期</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400" required />
            </div>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors">
              {editingPlan ? '保存' : '创建'}
            </button>
            <button type="button" onClick={() => { setShowCreate(false); setEditingPlan(null); setError(''); }}
              className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-600 text-xs rounded-lg transition-colors">
              取消
            </button>
          </div>
        </form>
      )}

      {/* Plan list */}
      <div className="space-y-2">
        {list.map(plan => (
          <div
            key={plan.id}
            onClick={() => onSelect(plan)}
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedPlanId === plan.id ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-800 truncate">{plan.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {plan.start_date.replace(/-/g, '/').slice(5)} ~ {plan.end_date.replace(/-/g, '/').slice(5)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  进度 {plan.completed_tasks}/{plan.total_tasks}
                  {plan.total_tasks > 0 && (
                    <span className="ml-1 text-blue-500">
                      ({Math.round((plan.completed_tasks / plan.total_tasks) * 100)}%)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={(e) => { e.stopPropagation(); startEdit(plan); }}
                className="text-xs text-gray-400 hover:text-blue-500">编辑</button>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(plan.id); }}
                className="text-xs text-red-400 hover:text-red-500">删除</button>
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8">暂无计划，点击上方按钮创建</p>
        )}
      </div>
    </div>
  );
}
