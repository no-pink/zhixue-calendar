import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { backup as backupApi } from '../api';
import JSZip from 'jszip';

export default function SettingsModal({ onClose }) {
  const { changePassword } = useAuth();
  const [tab, setTab] = useState('password');
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [msg, setMsg] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef();

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMsg('');
    if (newPw !== confirmPw) { setMsg('两次密码不一致'); return; }
    try {
      await changePassword(oldPw, newPw);
      setMsg('密码修改成功');
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      setMsg(err.message);
    }
  };

  const handleExport = () => {
    backupApi.exportData();
  };

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setImportMsg('');
    try {
      let jsonStr;
      if (file.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        const dataFile = zip.file('data.json');
        if (!dataFile) {
          setImportMsg('导入失败：ZIP 包中未找到 data.json 文件');
          return;
        }
        jsonStr = await dataFile.async('string');
      } else {
        jsonStr = await file.text();
      }
      const parsed = JSON.parse(jsonStr);
      if (!window.confirm('导入将完全替换当前所有数据，确认继续？')) return;
      const result = await backupApi.restore(jsonStr);
      setImportMsg(result.message);
      alert('数据恢复成功！页面将重新加载。');
      window.location.reload();
    } catch (e) {
      setImportMsg('导入失败：' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm mx-4 animate-fade-scale" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-medium text-gray-800 mb-4">设置</h3>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-100 mb-4">
          <button onClick={() => setTab('password')}
            className={`pb-2 text-sm ${tab === 'password' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-400'}`}>修改密码</button>
          <button onClick={() => setTab('backup')}
            className={`pb-2 text-sm ${tab === 'backup' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-400'}`}>数据备份</button>
        </div>

        {tab === 'password' && (
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">旧密码</label>
              <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" required />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">新密码</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" required />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">确认新密码</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" required
                onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.form?.requestSubmit?.() || handleChangePassword(e); } }} />
            </div>
            {msg && <p className={`text-xs ${msg.includes('成功') ? 'text-green-500' : 'text-red-500'}`}>{msg}</p>}
            <button type="submit" className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors">
              修改密码
            </button>
          </form>
        )}

        {tab === 'backup' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">导出所有数据（含提交物文件），用于手动备份。</p>
              <button onClick={handleExport}
                className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors">
                导出数据
              </button>
            </div>
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500 mb-2">导入之前导出的备份数据（将完全替换当前数据）。</p>
              <input type="file" ref={fileRef} accept=".zip,.json" className="text-xs mb-2" />
              <button onClick={handleImport}
                className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg transition-colors">
                导入数据
              </button>
              {importMsg && <p className={`text-xs mt-1 ${importMsg.includes('成功') ? 'text-green-500' : 'text-red-500'}`}>{importMsg}</p>}
            </div>
          </div>
        )}

        <button onClick={onClose} className="mt-4 w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-600 text-sm rounded-lg transition-colors">
          关闭
        </button>
      </div>
    </div>
  );
}
