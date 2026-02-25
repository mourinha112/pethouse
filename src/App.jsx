import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Sales from './pages/Sales';
import Clients from './pages/Clients';
import Reports from './pages/Reports';
import Stock from './pages/Stock';
import Expenses from './pages/Expenses';
import Cashier from './pages/Cashier';
import Settings from './pages/Settings';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('petshop_user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch (e) { localStorage.removeItem('petshop_user'); }
    }
    setChecking(false);
  }, []);

  function handleLogin(userData) { setUser(userData); }

  function handleLogout() {
    localStorage.removeItem('petshop_token');
    localStorage.removeItem('petshop_user');
    setUser(null);
  }

  if (checking) return null;

  if (!user) {
    return (
      <ToastProvider>
        <Login onLogin={handleLogin} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="app-layout">
        <Sidebar user={user} onLogout={handleLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/stock" element={<Stock />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/cashier" element={<Cashier />} />
            <Route path="/settings" element={<Settings currentUser={user} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </ToastProvider>
  );
}
