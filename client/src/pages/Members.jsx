import { AddIcon, MoreVertIcon } from '../icons.jsx';
import { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Stack, Avatar, Chip, Fab, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, TextField, IconButton, Menu, MenuItem, Alert, Snackbar, CircularProgress
} from '@mui/material';
import api from '../api.js';

export default function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({});
  const [anchor, setAnchor] = useState(null);
  const [sel, setSel] = useState(null);
  const [snack, setSnack] = useState('');
  const [tempPass, setTempPass] = useState('');

  const load = () => {
    setLoading(true); setLoadError('');
    api.get('/members')
        .then(r => setMembers(r.data.members || []))
        .catch(e => setLoadError(e.response?.data?.error || "Impossible de charger les membres. Vérifiez que l'API est démarrée et que vous êtes connecté en tant que propriétaire."))
        .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openNew = () => { setEdit(null); setForm({ email: '', full_name: '', relationship: '', phone: '', password: '' }); setOpen(true); };
  const openEdit = (m) => { setEdit(m); setForm({ full_name: m.full_name, relationship: m.relationship || '', phone: m.phone || '', password: '', is_active: m.is_active }); setOpen(true); setAnchor(null); };

  const save = async () => {
    try {
      if (edit) { await api.put(`/members/${edit.id}`, form); setSnack('Membre mis à jour.'); }
      else {
        const { data } = await api.post('/members', form);
        if (data.temporaryPassword) setTempPass(data.temporaryPassword);
        setSnack('Membre créé.');
      }
      setOpen(false); load();
    } catch (e) { setSnack(e.response?.data?.error || 'Erreur.'); }
  };
  const toggleActive = async (m) => { await api.put(`/members/${m.id}`, { is_active: !m.is_active }); setAnchor(null); load(); };
  const del = async (m) => { if (confirm(`Supprimer ${m.full_name} et tous ses documents ?`)) { await api.delete(`/members/${m.id}`); setAnchor(null); load(); } };

  return (
      <Box>
        <Typography variant="h6" gutterBottom>Famille</Typography>

        {loading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={28} /></Box>}
        {!loading && loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}
        {!loading && !loadError && members.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary', borderRadius: 3 }}>
              Aucun membre pour le moment. Appuyez sur + pour en ajouter.
            </Paper>
        )}

        <Stack spacing={1}>
          {members.map(m => (
              <Paper key={m.id} sx={{ p: 1.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: m.role === 'owner' ? 'secondary.main' : 'primary.main' }}>
                  {m.full_name?.[0]?.toUpperCase()}
                </Avatar>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography noWrap fontWeight={600}>{m.full_name}
                    {m.role === 'owner' && <Chip size="small" label="Propriétaire" color="secondary" sx={{ ml: 1 }} />}
                    {!m.is_active && <Chip size="small" label="Inactif" sx={{ ml: 1 }} />}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {m.relationship ? m.relationship + ' · ' : ''}{m.email} · {m.documents_count} doc(s)
                  </Typography>
                </Box>
                {m.role !== 'owner' && (
                    <IconButton onClick={(e) => { setAnchor(e.currentTarget); setSel(m); }}><MoreVertIcon /></IconButton>
                )}
              </Paper>
          ))}
        </Stack>

        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
          <MenuItem onClick={() => openEdit(sel)}>Modifier</MenuItem>
          <MenuItem onClick={() => toggleActive(sel)}>{sel?.is_active ? 'Désactiver' : 'Réactiver'}</MenuItem>
          <MenuItem onClick={() => del(sel)} sx={{ color: 'error.main' }}>Supprimer</MenuItem>
        </Menu>

        <Fab color="primary" sx={{ position: 'fixed', bottom: 80, right: 16 }} onClick={openNew}><AddIcon /></Fab>

        <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle>{edit ? 'Modifier le membre' : 'Ajouter un membre'}</DialogTitle>
          <DialogContent>
            {!edit && <TextField label="Email" type="email" fullWidth margin="dense" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
            <TextField label="Nom complet" fullWidth margin="dense" value={form.full_name || ''} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <TextField label="Lien de parenté" fullWidth margin="dense" placeholder="Épouse, Fils, Mère…" value={form.relationship || ''} onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
            <TextField label="Téléphone" fullWidth margin="dense" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <TextField label={edit ? 'Nouveau mot de passe (option)' : 'Mot de passe (option)'} type="text" fullWidth margin="dense"
                       helperText={edit ? '≥ 8 caractères, laisser vide pour ne pas changer' : 'Laisser vide = mot de passe généré automatiquement'}
                       value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Annuler</Button>
            <Button variant="contained" onClick={save}>Enregistrer</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={!!tempPass} onClose={() => setTempPass('')}>
          <DialogTitle>Mot de passe temporaire</DialogTitle>
          <DialogContent>
            <Alert severity="warning">Communiquez ce mot de passe au membre. Il ne sera plus affiché.</Alert>
            <Typography variant="h5" sx={{ textAlign: 'center', my: 2, fontFamily: 'monospace' }}>{tempPass}</Typography>
          </DialogContent>
          <DialogActions><Button onClick={() => setTempPass('')}>J'ai noté</Button></DialogActions>
        </Dialog>

        <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')} message={snack} />
      </Box>
  );
}