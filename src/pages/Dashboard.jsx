import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Loading from '../components/Loading';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  LinearProgress,
  Typography,
  Box,
} from '@mui/material';
import {
  TrendingUp,
  ShoppingCart,
  AttachMoney,
  Warehouse,
  Inventory,
  People,
  AccountBalanceWallet,
  Schedule,
  BarChart,
  CreditCard,
  Warning,
  ArrowForward,
} from '@mui/icons-material';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    try {
      const res = await api.get('/dashboard');
      setData(res.data);
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Loading />;
  if (!data) return <div className="page-error">Erro ao carregar dados</div>;

  const safeData = {
    faturamento_dia: data?.faturamento_dia || 0,
    vendas_dia: data?.vendas_dia || 0,
    ticket_medio: data?.ticket_medio || 0,
    faturamento_mes: data?.faturamento_mes || 0,
    estoque_total_kg: data?.estoque_total_kg || 0,
    total_produtos: data?.total_produtos || 0,
    total_clientes: data?.total_clientes || 0,
    despesas_pendentes: data?.despesas_pendentes || 0,
    meta_diaria: data?.meta_diaria || 500,
    ultimas_vendas: data?.ultimas_vendas || [],
    top_produtos: data?.top_produtos || [],
    vendas_por_pagamento: data?.vendas_por_pagamento || [],
    alertas_estoque: data?.alertas_estoque || [],
  };

  const metaPercent = safeData.meta_diaria > 0
    ? Math.min(100, Math.round((safeData.faturamento_dia / safeData.meta_diaria) * 100))
    : 0;

  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function PayIcon({ forma }) {
    if (forma === 'pix') return <CreditCard sx={{ fontSize: 14, mr: 0.5 }} />;
    if (forma === 'cartao') return <CreditCard sx={{ fontSize: 14, mr: 0.5 }} />;
    return <AttachMoney sx={{ fontSize: 14, mr: 0.5 }} />;
  }

  const cardIcon = (Icon, bg, color) => (
    <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon sx={{ fontSize: 24 }} />
    </Box>
  );

  return (
    <div className="page page-wide">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <span className="page-date">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 2 }}>
        <Card sx={{ borderLeft: '4px solid', borderLeftColor: 'primary.main' }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {cardIcon(TrendingUp, '#fce8e8', '#B60100')}
            <Box><Typography variant="caption" color="text.secondary">Faturamento Hoje</Typography><Typography variant="h6">R$ {safeData.faturamento_dia.toFixed(2)}</Typography></Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {cardIcon(ShoppingCart, '#e3f2fd', '#1E88E5')}
            <Box><Typography variant="caption" color="text.secondary">Vendas Hoje</Typography><Typography variant="h6">{safeData.vendas_dia}</Typography></Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {cardIcon(AttachMoney, '#f3e5f5', '#7B1FA2')}
            <Box><Typography variant="caption" color="text.secondary">Ticket Medio</Typography><Typography variant="h6">R$ {safeData.ticket_medio.toFixed(2)}</Typography></Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {cardIcon(TrendingUp, '#fff3e0', '#EF6C00')}
            <Box><Typography variant="caption" color="text.secondary">Faturamento Mes</Typography><Typography variant="h6">R$ {safeData.faturamento_mes.toFixed(2)}</Typography></Box>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 2 }}>
        <Card>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {cardIcon(Warehouse, '#e8eaf6', '#5C6BC0')}
            <Box><Typography variant="caption" color="text.secondary">Estoque Total</Typography><Typography variant="h6">{safeData.estoque_total_kg.toFixed(0)} kg</Typography></Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {cardIcon(Inventory, '#e8f5e9', '#43A047')}
            <Box><Typography variant="caption" color="text.secondary">Produtos Ativos</Typography><Typography variant="h6">{safeData.total_produtos}</Typography></Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {cardIcon(People, '#e3f2fd', '#1E88E5')}
            <Box><Typography variant="caption" color="text.secondary">Clientes</Typography><Typography variant="h6">{safeData.total_clientes}</Typography></Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {cardIcon(AccountBalanceWallet, '#fff3e0', '#EF6C00')}
            <Box><Typography variant="caption" color="text.secondary">Despesas Pendentes</Typography><Typography variant="h6">R$ {safeData.despesas_pendentes.toFixed(2)}</Typography></Box>
          </CardContent>
        </Card>
      </Box>

      <Card sx={{ mb: 2, borderRadius: 3 }}>
        <CardHeader title={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><TrendingUp /> Meta Diaria</Box>} />
        <CardContent>
          <LinearProgress variant="determinate" value={metaPercent} sx={{ height: 10, borderRadius: 1, mb: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'text.secondary' }}>
            <span>R$ {safeData.faturamento_dia.toFixed(2)} / R$ {safeData.meta_diaria.toFixed(2)}</span>
            <Typography fontWeight={700} color="primary.main">{metaPercent}%</Typography>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <Card sx={{ borderRadius: 3 }}>
          <CardHeader title={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Schedule /> Ultimas Vendas</Box>} action={<Button size="small" endIcon={<ArrowForward />} onClick={() => navigate('/sales')}>Ver PDV</Button>} />
          <CardContent>
            {safeData.ultimas_vendas.length === 0 ? <Typography color="text.secondary">Nenhuma venda hoje</Typography> : (
              <div className="dash-list">
                {safeData.ultimas_vendas.map(v => (
                  <div key={v.id} className="dash-list-item">
                    <div className="dash-list-left"><span className="dash-list-id">#{v.id}</span><span className="dash-list-time">{formatTime(v.created_at)}</span></div>
                    <span className="dash-list-name">{v.client_nome || 'Avulso'}</span>
                    <span className="dash-list-badge"><PayIcon forma={v.forma_pagamento} /> {v.forma_pagamento}</span>
                    <span className="dash-list-value">R$ {v.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 3 }}>
          <CardHeader title={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><BarChart /> Top Produtos (30d)</Box>} action={<Button size="small" endIcon={<ArrowForward />} onClick={() => navigate('/products')}>Produtos</Button>} />
          <CardContent>
            {safeData.top_produtos.length === 0 ? <Typography color="text.secondary">Sem dados ainda</Typography> : (
              <div className="dash-list">
                {safeData.top_produtos.map((p, i) => (
                  <div key={i} className="dash-list-item">
                    <span className="dash-list-rank">#{i + 1}</span>
                    <span className="dash-list-name" style={{ flex: 1 }}>{p.nome} <small className="text-muted">({p.marca})</small></span>
                    <span className="dash-list-value">{p.total_kg.toFixed(1)} kg</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mt: 2 }}>
        <Card sx={{ borderRadius: 3 }}>
          <CardHeader title={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CreditCard /> Pagamentos Hoje</Box>} />
          <CardContent>
            {safeData.vendas_por_pagamento.length === 0 ? <Typography color="text.secondary">Sem vendas hoje</Typography> : (
              <div className="dash-list">
                {safeData.vendas_por_pagamento.map(p => (
                  <div key={p.forma_pagamento} className="dash-list-item">
                    <span className="dash-list-badge"><PayIcon forma={p.forma_pagamento} /> {p.forma_pagamento}</span>
                    <span className="dash-list-name">{p.qtd} vendas</span>
                    <span className="dash-list-value">R$ {p.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 3 }}>
          <CardHeader title={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Warning /> Alertas de Estoque</Box>} action={<Button size="small" endIcon={<ArrowForward />} onClick={() => navigate('/stock')}>Estoque</Button>} />
          <CardContent>
            {safeData.alertas_estoque.length === 0 ? <Typography color="success.main">Estoque OK!</Typography> : (
              <div className="alerts-list">
                {safeData.alertas_estoque.slice(0, 4).map(alert => (
                  <div key={alert.product_id} className="alert-item">
                    <Warning className="alert-icon" sx={{ fontSize: 18 }} />
                    <div className="alert-text"><strong>{alert.nome}</strong> ({alert.marca})<br />{alert.estoque_kg.toFixed(1)}kg restante — <strong>{alert.dias_restantes} dias</strong></div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </Box>
    </div>
  );
}
