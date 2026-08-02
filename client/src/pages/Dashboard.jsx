import { DescriptionIcon, GroupIcon, EventBusyIcon, ShareIcon } from '../icons.jsx';
import { useEffect, useState } from 'react';
import { Grid, Paper, Typography, Box, List, ListItem, ListItemText, Chip, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../auth.jsx';

function Stat({ icon, label, value, color }) {
  return (
    <Paper sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 1.5, height: '100%' }}>
      <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: color, color: '#fff', display: 'grid', placeItems: 'center' }}>{icon}</Box>
      <Box>
        <Typography variant="h5" fontWeight={800}>{value ?? '—'}</Typography>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
      </Box>
    </Paper>
  );
}

export default function Dashboard() {
  const { user, isOwner } = useAuth();
  const [stats, setStats] = useState(null);
  const [expiring, setExpiring] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    api.get('/stats').then(r => setStats(r.data)).catch(() => {});
    api.get('/documents/expiring').then(r => setExpiring(r.data.documents)).catch(() => {});
  }, []);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Bonjour {user?.full_name?.split(' ')[0]} 👋</Typography>
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={6}><Stat icon={<DescriptionIcon />} label="Documents" value={stats?.documents} color="#0f766e" /></Grid>
        {isOwner ? (
          <>
            <Grid item xs={6}><Stat icon={<GroupIcon />} label="Membres" value={stats?.members} color="#7c3aed" /></Grid>
            <Grid item xs={6}><Stat icon={<ShareIcon />} label="Partages actifs" value={stats?.active_shares} color="#2563eb" /></Grid>
          </>
        ) : (
          <Grid item xs={6}><Stat icon={<ShareIcon />} label="Partagés avec moi" value={stats?.shared_with_me} color="#2563eb" /></Grid>
        )}
        <Grid item xs={6}><Stat icon={<EventBusyIcon />} label="À renouveler (30j)" value={stats?.expiring} color="#d97706" /></Grid>
      </Grid>

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ px: 2, py: 1.5, bgcolor: '#fff7ed' }}>
          <Typography fontWeight={700} color="warning.dark">⏰ Échéances à venir</Typography>
        </Box>
        <Divider />
        {expiring.length === 0
          ? <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>Aucune échéance proche.</Box>
          : <List dense>
              {expiring.map((d) => (
                <ListItem key={d.id} button onClick={() => nav(`/documents/${d.id}`)}
                  secondaryAction={<Chip size="small" color={d.days_left < 0 ? 'error' : d.days_left <= 30 ? 'warning' : 'default'}
                    label={d.days_left < 0 ? 'Expiré' : `${d.days_left} j`} />}>
                  <ListItemText primary={d.title}
                    secondary={`${isOwner && d.owner_name ? d.owner_name + ' · ' : ''}${new Date(d.expiry_date).toLocaleDateString('fr-FR')}`} />
                </ListItem>
              ))}
            </List>}
      </Paper>
    </Box>
  );
}
