import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import api from '../api';
import {
  Dashboard as DashboardIcon,
  ShoppingCart,
  ReceiptLong,
  AccountBalanceWallet,
  Inventory,
  PhotoCamera,
  Storage,
  People,
  AttachMoney,
  BarChart,
  Settings,
  Warning,
  Person,
  Logout,
  Menu,
  Close,
} from '@mui/icons-material';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: DashboardIcon },
  { path: '/sales', label: 'Vendas (PDV)', icon: ShoppingCart },
  { path: '/orders', label: 'Pedidos online', icon: ReceiptLong },
  { path: '/cashier', label: 'Caixa', icon: AccountBalanceWallet },
  { path: '/products', label: 'Produtos', icon: Inventory },
  { path: '/photos', label: 'Fotos da loja', icon: PhotoCamera },
  { path: '/stock', label: 'Estoque', icon: Storage },
  { path: '/clients', label: 'Clientes', icon: People },
  { path: '/expenses', label: 'Financeiro', icon: AttachMoney },
  { path: '/reports', label: 'Relatorios', icon: BarChart },
  { path: '/settings', label: 'Configuracoes', icon: Settings },
];

export default function Sidebar({ user, onLogout }) {
  const [alertCount, setAlertCount] = useState(0);
  const [pedidosNovos, setPedidosNovos] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 300000);
    return () => clearInterval(interval);
  }, []);

  // Pedido novo da loja online aparece como bolinha no menu.
  useEffect(() => {
    fetchPedidos();
    const interval = setInterval(fetchPedidos, 60000);
    return () => clearInterval(interval);
  }, []);

  function fetchPedidos() {
    api.get('/orders?status=novo')
      .then(res => setPedidosNovos(Array.isArray(res.data) ? res.data.length : 0))
      .catch(() => {});
  }

  useEffect(() => {
    if (mobileMenuOpen && window.matchMedia('(max-width: 768px)').matches) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [mobileMenuOpen]);

  function fetchAlerts() {
    api.get('/dashboard/alerts').then(res => setAlertCount(res.data.length)).catch(() => {});
  }

  return (
    <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-mobile-open' : ''}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon"><img src="/logo.png" alt="Logo" style={{ width: 28, height: 28, objectFit: 'contain' }} /></div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">PetShop</span>
          <span className="sidebar-brand-sub">Sistema de Gestao</span>
        </div>
        <button type="button" className="sidebar-mobile-toggle" aria-label="Abrir menu" onClick={() => setMobileMenuOpen(true)}>
          <Menu sx={{ fontSize: 28 }} />
        </button>
      </div>

      <div className="sidebar-drawer">
        <button type="button" className="sidebar-drawer-close" aria-label="Fechar menu" onClick={closeMobileMenu}>
          <Close sx={{ fontSize: 26 }} />
        </button>
        <nav className="sidebar-nav" onClick={closeMobileMenu}>
          {menuItems.map(item => (
            <NavLink key={item.path} to={item.path}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              end={item.path === '/'}>
              <div className="sidebar-link-icon"><item.icon sx={{ fontSize: 20 }} /></div>
              <span className="sidebar-link-text">{item.label}</span>
              {item.path === '/orders' && pedidosNovos > 0 && (
                <span className="sidebar-link-badge">{pedidosNovos}</span>
              )}
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
          <button className="sidebar-logout" onClick={() => { closeMobileMenu(); onLogout(); }} title="Sair">
            <Logout sx={{ fontSize: 18 }} />
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="sidebar-backdrop" aria-hidden onClick={closeMobileMenu} />
      )}
    </aside>
  );
}
