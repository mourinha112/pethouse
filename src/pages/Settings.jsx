import React, { useState, useEffect } from 'react';
import api from '../api';
import { useToast } from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import Loading from '../components/Loading';
import {
  Settings as SettingsIcon, Save, Database, Download, UserPlus, Trash2,
  X, Shield, HardDrive, RefreshCw
} from 'lucide-react';

export default function Settings({ currentUser }) {
  const toast = useToast();
  const [settings, setSettings] = useState({ taxa_maquininha: '2.5', meta_diaria: '500' });
  const [users, setUsers] = useState([]);
  const [backups, setBackups] = useState([]);
  const [dbInfo, setDbInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('geral');
  const [showAddUser, setShowAddUser] = useState(false);
  const [userForm, setUserForm] = useState({ nome: '', login: '', senha: '', role: 'operador' });
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [setRes, usersRes, backupsRes, infoRes] = await Promise.all([
        api.get('/costs/settings'),
        api.get('/auth/users'),
        api.get('/backup'),
        api.get('/backup/info'),
      ]);
      setSettings(setRes.data);
      setUsers(usersRes.data);
      setBackups(backupsRes.data);
      setDbInfo(infoRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function saveSettings(e) {
    e.preventDefault();
    try {
      await api.put('/costs/settings', {
        taxa_maquininha: parseFloat(settings.taxa_maquininha) || 2.5,
        meta_diaria: parseFloat(settings.meta_diaria) || 500,
      });
      toast.success('Configuracoes salvas!');
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
  }

  async function handleAddUser(e) {
    e.preventDefault();
    if (!userForm.nome || !userForm.login || !userForm.senha) { toast.error('Preencha todos os campos'); return; }
    try {
      await api.post('/auth/users', userForm);
      setShowAddUser(false);
      setUserForm({ nome: '', login: '', senha: '', role: 'operador' });
      toast.success('Usuario criado!');
      loadAll();
    } catch (err) { toast.error(err.response?.data?.error || err.message); }
  }

  async function deleteUser(id) {
    try {
      await api.delete(`/auth/users/${id}`);
      setConfirmDelete(null);
      toast.success('Usuario removido');
      loadAll();
    } catch (err) { toast.error(err.message); }
  }

  async function createBackup() {
    try {
      const res = await api.post('/backup/create');
      toast.success(`Backup criado: ${res.data.file}`);
      loadAll();
    } catch (err) { toast.error(err.message); }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  if (loading) return <Loading />;

  return (
    <div className="page page-wide">
      <div className="page-header">
        <h1 className="page-title"><SettingsIcon size={24} /> Configuracoes</h1>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'geral' ? 'active' : ''}`} onClick={() => setActiveTab('geral')}>Geral</button>
        <button className={`tab ${activeTab === 'usuarios' ? 'active' : ''}`} onClick={() => setActiveTab('usuarios')}>Usuarios</button>
        <button className={`tab ${activeTab === 'backup' ? 'active' : ''}`} onClick={() => setActiveTab('backup')}>Backup</button>
      </div>

      {/* GERAL */}
      {activeTab === 'geral' && (
        <div className="dashboard-section">
          <h2><SettingsIcon size={18} /> Configuracoes Gerais</h2>
          <form onSubmit={saveSettings}>
            <div className="form-row">
              <div className="form-group">
                <label>Taxa da Maquininha (%)</label>
                <input type="number" step="0.1" value={settings.taxa_maquininha}
                  onChange={e => setSettings({ ...settings, taxa_maquininha: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Meta Diaria (R$)</label>
                <input type="number" step="1" value={settings.meta_diaria}
                  onChange={e => setSettings({ ...settings, meta_diaria: e.target.value })} />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary"><Save size={16} /> Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* USUARIOS */}
      {activeTab === 'usuarios' && (
        <div>
          <div className="page-header" style={{ marginBottom: '1rem' }}>
            <h3><Shield size={18} /> Usuarios do Sistema</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddUser(true)}>
              <UserPlus size={16} /> Novo Usuario
            </button>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Nome</th><th>Login</th><th>Perfil</th><th>Criado em</th><th>Acoes</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.nome}</strong></td>
                    <td>{u.login}</td>
                    <td><span className="capitalize">{u.role}</span></td>
                    <td>{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                    <td>
                      {u.id !== currentUser?.id && (
                        <button className="btn-icon btn-delete" onClick={() => setConfirmDelete(u)}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showAddUser && (
            <div className="modal-overlay" onClick={() => setShowAddUser(false)}>
              <div className="modal modal-small" onClick={e => e.stopPropagation()}>
                <div className="modal-header"><h2>Novo Usuario</h2><button className="btn-icon" onClick={() => setShowAddUser(false)}><X size={20} /></button></div>
                <form onSubmit={handleAddUser}>
                  <div className="form-group"><label>Nome</label><input value={userForm.nome} onChange={e => setUserForm({ ...userForm, nome: e.target.value })} required autoFocus /></div>
                  <div className="form-group"><label>Login</label><input value={userForm.login} onChange={e => setUserForm({ ...userForm, login: e.target.value })} required /></div>
                  <div className="form-group"><label>Senha</label><input type="password" value={userForm.senha} onChange={e => setUserForm({ ...userForm, senha: e.target.value })} required /></div>
                  <div className="form-group">
                    <label>Perfil</label>
                    <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}>
                      <option value="operador">Operador</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddUser(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary">Criar</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {confirmDelete && (
            <ConfirmModal
              title="Excluir Usuario"
              message={`Deseja excluir o usuario "${confirmDelete.nome}"?`}
              onConfirm={() => deleteUser(confirmDelete.id)}
              onCancel={() => setConfirmDelete(null)}
              confirmText="Excluir"
              danger
            />
          )}
        </div>
      )}

      {/* BACKUP */}
      {activeTab === 'backup' && (
        <div>
          {dbInfo && (
            <div className="cards-grid cards-grid-3">
              <div className="card"><div className="card-icon" style={{ background: '#e3f2fd', color: '#1565C0' }}><Database size={24} /></div>
                <div className="card-info"><span className="card-label">Tamanho do Banco</span><span className="card-value">{formatSize(dbInfo.size)}</span></div>
              </div>
              <div className="card"><div className="card-icon" style={{ background: '#e8f5e9', color: '#2E7D32' }}><HardDrive size={24} /></div>
                <div className="card-info"><span className="card-label">Tabelas</span><span className="card-value">{Object.keys(dbInfo.tables).length}</span></div>
              </div>
              <div className="card"><div className="card-icon" style={{ background: '#fff3e0', color: '#EF6C00' }}><RefreshCw size={24} /></div>
                <div className="card-info"><span className="card-label">Backups Salvos</span><span className="card-value">{backups.length}</span></div>
              </div>
            </div>
          )}

          <div className="page-header" style={{ marginBottom: '1rem' }}>
            <h3><Database size={18} /> Backups</h3>
            <button className="btn btn-primary btn-sm" onClick={createBackup}><Download size={16} /> Criar Backup Agora</button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Arquivo</th><th>Tamanho</th><th>Data</th></tr></thead>
              <tbody>
                {backups.length === 0 ? (
                  <tr><td colSpan="3" className="table-empty">Nenhum backup realizado</td></tr>
                ) : (
                  backups.map(b => (
                    <tr key={b.file}>
                      <td><strong>{b.file}</strong></td>
                      <td>{formatSize(b.size)}</td>
                      <td>{new Date(b.created).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
