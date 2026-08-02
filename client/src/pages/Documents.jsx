import { SearchIcon, AddIcon, DescriptionIcon, ImageIcon, PictureAsPdfIcon, UploadFileIcon } from '../icons.jsx';
import { useEffect, useState, useCallback } from 'react';
import {
  Box, TextField, InputAdornment, Chip, Stack, Paper, Typography, Fab, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, MenuItem, IconButton, Avatar, CircularProgress
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../auth.jsx';

function iconFor(mime) {
  if (mime?.includes('pdf')) return <PictureAsPdfIcon />;
  if (mime?.startsWith('image/')) return <ImageIcon />;
  return <DescriptionIcon />;
}
const fmtSize = (b) => b < 1024 ? b + ' o' : b < 1048576 ? (b / 1024).toFixed(0) + ' Ko' : (b / 1048576).toFixed(1) + ' Mo';

function UploadDialog({ open, onClose, onDone, categories, members, isOwner }) {
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ title: '', category_id: '', owner_user_id: '', issue_date: '', expiry_date: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!file) { setErr('Choisissez un fichier.'); return; }
    setBusy(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', form.title || file.name);
      if (form.category_id) fd.append('category_id', form.category_id);
      if (isOwner && form.owner_user_id) fd.append('owner_user_id', form.owner_user_id);
      if (form.issue_date) fd.append('issue_date', form.issue_date);
      if (form.expiry_date) fd.append('expiry_date', form.expiry_date);
      await api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setFile(null); setForm({ title: '', category_id: '', owner_user_id: '', issue_date: '', expiry_date: '' });
      onDone();
    } catch (e) { setErr(e.response?.data?.error || 'Échec du téléversement.'); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={window.innerWidth < 600}>
      <DialogTitle>Ajouter un document</DialogTitle>
      <DialogContent>
        {err && <Typography color="error" variant="body2" sx={{ mb: 1 }}>{err}</Typography>}
        <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} fullWidth sx={{ my: 1, py: 1.3 }}>
          {file ? file.name : 'Choisir un fichier (PDF, image…)'}
          <input hidden type="file" accept=".pdf,image/*,.doc,.docx,.txt"
            onChange={(e) => { setFile(e.target.files[0]); if (!form.title && e.target.files[0]) setForm(f => ({ ...f, title: e.target.files[0].name.replace(/\.[^.]+$/, '') })); }} />
        </Button>
        <TextField label="Titre" fullWidth margin="dense" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <TextField select label="Catégorie" fullWidth margin="dense" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
          <MenuItem value="">—</MenuItem>
          {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
        </TextField>
        {isOwner && (
          <TextField select label="Appartient à" fullWidth margin="dense" value={form.owner_user_id} onChange={(e) => setForm({ ...form, owner_user_id: e.target.value })} helperText="Laisser vide = vous">
            <MenuItem value="">Moi</MenuItem>
            {members.map(m => <MenuItem key={m.id} value={m.id}>{m.full_name}{m.relationship ? ` (${m.relationship})` : ''}</MenuItem>)}
          </TextField>
        )}
        <Stack direction="row" spacing={1}>
          <TextField type="date" label="Émission" InputLabelProps={{ shrink: true }} fullWidth margin="dense" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
          <TextField type="date" label="Expiration" InputLabelProps={{ shrink: true }} fullWidth margin="dense" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={submit} disabled={busy}>{busy ? 'Chiffrement…' : 'Enregistrer'}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Documents() {
  const { isOwner } = useAuth();
  const [docs, setDocs] = useState([]);
  const [cats, setCats] = useState([]);
  const [members, setMembers] = useState([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [member, setMember] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    if (cat) params.category = cat;
    if (member) params.member = member;
    api.get('/documents', { params }).then(r => setDocs(r.data.documents)).finally(() => setLoading(false));
  }, [q, cat, member]);

  useEffect(() => {
    api.get('/categories').then(r => setCats(r.data.categories)).catch(() => {});
    if (isOwner) api.get('/members/options').then(r => setMembers(r.data.members)).catch(() => {});
  }, [isOwner]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  return (
    <Box>
      <TextField placeholder="Rechercher un document…" fullWidth size="small" value={q} onChange={(e) => setQ(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} sx={{ mb: 1.5 }} />
      <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1, mb: 1 }}>
        <Chip label="Toutes" color={cat === '' ? 'primary' : 'default'} onClick={() => setCat('')} />
        {cats.map(c => <Chip key={c.id} label={c.name} color={cat === c.id ? 'primary' : 'default'} onClick={() => setCat(c.id)} />)}
      </Stack>
      {isOwner && members.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1, mb: 1 }}>
          <Chip size="small" variant="outlined" label="Tout le monde" color={member === '' ? 'secondary' : 'default'} onClick={() => setMember('')} />
          {members.map(m => <Chip key={m.id} size="small" variant="outlined" label={m.full_name} color={member === m.id ? 'secondary' : 'default'} onClick={() => setMember(m.id)} />)}
        </Stack>
      )}

      {loading ? <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={28} /></Box>
        : docs.length === 0 ? <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary', borderRadius: 3 }}>Aucun document.</Paper>
        : <Stack spacing={1}>
            {docs.map(d => (
              <Paper key={d.id} onClick={() => nav(`/documents/${d.id}`)}
                sx={{ p: 1.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}>
                <Avatar sx={{ bgcolor: 'primary.light', color: 'primary.dark' }}>{iconFor(d.mime_type)}</Avatar>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography noWrap fontWeight={600}>{d.title}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {d.category_name || 'Sans catégorie'} · {fmtSize(d.size_bytes)}
                    {isOwner && d.owner_name ? ` · ${d.owner_name}` : ''}
                  </Typography>
                </Box>
                <Stack alignItems="flex-end" spacing={0.5}>
                  {Number(d.is_shared) === 1 && <Chip size="small" label="Partagé" color="info" />}
                  {d.expiry_date && <Chip size="small" variant="outlined"
                    label={new Date(d.expiry_date).toLocaleDateString('fr-FR')}
                    color={new Date(d.expiry_date) < new Date() ? 'error' : 'default'} />}
                </Stack>
              </Paper>
            ))}
          </Stack>}

      <Fab color="primary" sx={{ position: 'fixed', bottom: 80, right: 16, maxWidth: 640 }} onClick={() => setOpen(true)}><AddIcon /></Fab>
      <UploadDialog open={open} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }}
        categories={cats} members={members} isOwner={isOwner} />
    </Box>
  );
}
