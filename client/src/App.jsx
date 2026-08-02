import { DashboardIcon, FolderIcon, GroupIcon, HistoryIcon, PersonIcon, LockIcon } from './icons.jsx';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, AppBar, Toolbar, Typography, IconButton, Paper,
  BottomNavigation, BottomNavigationAction, Badge } from '@mui/material';
import { useEffect, useState } from 'react';
import { useAuth } from './auth.jsx';
import api from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Documents from './pages/Documents.jsx';
import DocumentDetail from './pages/DocumentDetail.jsx';
import Members from './pages/Members.jsx';
import Audit from './pages/Audit.jsx';
import Profile from './pages/Profile.jsx';

function Shell({ children }) {
  const { user, isOwner } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    api.get('/notifications').then(r => setUnread(r.data.unread)).catch(() => {});
  }, [loc.pathname]);

  const tabs = isOwner
    ? [['/', 'Accueil', <DashboardIcon />], ['/documents', 'Docs', <FolderIcon />],
       ['/membres', 'Famille', <GroupIcon />], ['/audit', 'Journal', <HistoryIcon />],
       ['/profil', 'Profil', <PersonIcon />]]
    : [['/', 'Accueil', <DashboardIcon />], ['/documents', 'Mes docs', <FolderIcon />],
       ['/profil', 'Profil', <PersonIcon />]];

  const current = '/' + (loc.pathname.split('/')[1] || '');
  return (
    <Box sx={{ minHeight: '100%', pb: 9, maxWidth: 640, mx: 'auto' }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'primary.dark' }}>
        <Toolbar sx={{ gap: 1 }}>
          <LockIcon />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Coffre Familial</Typography>
          <IconButton color="inherit" onClick={() => nav('/profil')}>
            <Badge badgeContent={unread} color="error"><PersonIcon /></Badge>
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: 2 }}>{children}</Box>
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 640, mx: 'auto', zIndex: 10 }} elevation={8}>
        <BottomNavigation showLabels value={current} onChange={(e, v) => nav(v)}>
          {tabs.map(([to, label, icon]) => (
            <BottomNavigationAction key={to} label={label} value={to} icon={icon} />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Box sx={{ display: 'grid', placeItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
  if (!user) return <Navigate to="/login" replace />;
  return <Shell>{children}</Shell>;
}

function OwnerOnly({ children }) {
  const { isOwner } = useAuth();
  return isOwner ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/documents" element={<Protected><Documents /></Protected>} />
      <Route path="/documents/:id" element={<Protected><DocumentDetail /></Protected>} />
      <Route path="/membres" element={<Protected><OwnerOnly><Members /></OwnerOnly></Protected>} />
      <Route path="/audit" element={<Protected><OwnerOnly><Audit /></OwnerOnly></Protected>} />
      <Route path="/profil" element={<Protected><Profile /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
