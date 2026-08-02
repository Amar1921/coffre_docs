import { LogoutIcon } from '../icons.jsx';
import { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Avatar, Stack, Button, TextField, Divider, List, ListItem,
  ListItemText, Chip, Snackbar, Alert
} from '@mui/material';
import api from '../api.js';
import { useAuth } from '../auth.jsx';

export default function Profile() {
  const { user, logout, isOwner } = useAuth();
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [notifs, setNotifs] = useState([]);
  const [snack, setSnack] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { api.get('/notifications').then(r => setNotifs(r.data.notifications)).catch(() => {}); }, []);

  const changePw = async () => {
    setErr('');
    if (pw.next.length < 8) return setErr('Le nouveau mot de passe doit faire ≥ 8 caractères.');
    if (pw.next !== pw.confirm) return setErr('La confirmation ne correspond pas.');
    try {
      await api.post('/auth/change-password', { current: pw.current, next: pw.next });
      setPw({ current: '', next: '', confirm: '' }); setSnack('Mot de passe modifié.');
    } catch (e) { setErr(e.response?.data?.error || 'Erreur.'); }
  };
  const markRead = async () => { await api.post('/notifications/read-all'); setNotifs(n => n.map(x => ({ ...x, is_read: 1 }))); };

  return (
    <Box>
      <Paper sx={{ p: 2, borderRadius: 3, textAlign: 'center', mb: 2 }}>
        <Avatar sx={{ width: 64, height: 64, mx: 'auto', bgcolor: 'primary.main', fontSize: 28 }}>{user?.full_name?.[0]}</Avatar>
        <Typography variant="h6" sx={{ mt: 1 }}>{user?.full_name}</Typography>
        <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
        <Chip size="small" sx={{ mt: 1 }} color={isOwner ? 'secondary' : 'primary'} label={isOwner ? 'Propriétaire' : 'Membre'} />
      </Paper>

      <Paper sx={{ borderRadius: 3, mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
          <Typography fontWeight={700}>Notifications</Typography>
          <Button size="small" onClick={markRead}>Tout lire</Button>
        </Stack>
        <Divider />
        {notifs.length === 0 ? <Box sx={{ p: 2, color: 'text.secondary' }}>Aucune notification.</Box>
          : <List dense>{notifs.slice(0, 20).map(n => (
              <ListItem key={n.id}>
                <ListItemText primary={n.title} secondary={n.message}
                  primaryTypographyProps={{ fontWeight: n.is_read ? 400 : 700 }} />
              </ListItem>))}
            </List>}
      </Paper>

      <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
        <Typography fontWeight={700} gutterBottom>Changer le mot de passe</Typography>
        {err && <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>}
        <TextField label="Mot de passe actuel" type="password" fullWidth margin="dense" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        <TextField label="Nouveau mot de passe" type="password" fullWidth margin="dense" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
        <TextField label="Confirmer" type="password" fullWidth margin="dense" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
        <Button variant="contained" sx={{ mt: 1 }} onClick={changePw}>Mettre à jour</Button>
      </Paper>

      <Button variant="outlined" color="error" fullWidth startIcon={<LogoutIcon />} onClick={logout}>Se déconnecter</Button>
      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack} />
    </Box>
  );
}
