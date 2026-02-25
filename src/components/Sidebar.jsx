import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import api from '../api';
import {
  Dashboard as DashboardIcon,
  ShoppingCart,
  AccountBalanceWallet,
  Inventory,
  Storage,
  People,
  AttachMoney,
  BarChart,
  Settings,
  Star,
  Warning,
  Person,
  Logout,
} from '@mui/icons-material';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: DashboardIcon },
  { path: '/sales', label: 'Vendas (PDV)', icon: ShoppingCart },
  { path: '/cashier', label: 'Caixa', icon: AccountBalanceWallet },
  { path: '/products', label: 'Produtos', icon: Inventory },
  { path: '/stock', label: 'Estoque', icon: Storage },
  { path: '/clients', label: 'Clientes', icon: People },
  { path: '/expenses', label: 'Financeiro', icon: AttachMoney },
  { path: '/reports', label: 'Relatorios', icon: BarChart },
  { path: '/settings', label: 'Configuracoes', icon: Settings },
];

export default function Sidebar({ user, onLogout }) {
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 300000);
    return () => clearInterval(interval);
  }, []);

  function fetchAlerts() {
    api.get('/dashboard/alerts').then(res => setAlertCount(res.data.length)).catch(() => {});
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon"><Star sx={{ fontSize: 26 }} /></div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">PetShop</span>
          <span className="sidebar-brand-sub">Sistema de Gestao</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map(item => (
          <NavLink key={item.path} to={item.path}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            end={item.path === '/'}>
            <div className="sidebar-link-icon"><item.icon sx={{ fontSize: 20 }} /></div>
            <span className="sidebar-link-text">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {alertCount > 0 && (
        <div className="sidebar-alert-box">
          <Warning sx={{ fontSize: 18 }} /><span>{alertCount} alerta{alertCount > 1 ? 's' : ''}</span>
        </div>
      )}

      <div className="sidebar-user">
        <div className="sidebar-user-info">
          <div className="sidebar-user-avatar"><Person sx={{ fontSize: 18 }} /></div>
          <div className="sidebar-user-text">
            <span className="sidebar-user-name">{user?.nome || 'Usuario'}</span>
            <span className="sidebar-user-role">{user?.role || 'operador'}</span>
          </div>
        </div>
        <button className="sidebar-logout" onClick={onLogout} title="Sair">
          <Logout sx={{ fontSize: 18 }} />
        </button>
      </div>
    </aside>
  );
}
