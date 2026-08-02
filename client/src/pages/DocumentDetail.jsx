import { ArrowBackIcon, VisibilityIcon, DownloadIcon, DeleteIcon, ShareIcon } from '../icons.jsx';
import { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Stack, Button, Chip, Divider, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, MenuItem, TextField, List, ListItem, ListItemText, CircularProgress,
  Snackbar, Alert, Icon
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../auth.jsx';
import DocViewer from '../components/DocViewer.jsx';

export default function DocumentDetail() {
  const { id } = useParams();
  const { isOwner } = useAuth();
  const nav = useNavigate();
  const [doc, setDoc] = useState(null);
  const [perm, setPerm] = useState('view');
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [shares, setShares] = useState([]);
  const [members, setMembers] = useState([]);
  const [cats, setCats] = useState([]);
  const [snack, setSnack] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const canManage = perm === 'download';

  const load = () => {
    setLoading(true);
    api.get(`/documents/${id}`).then(r => { setDoc(r.data.document); setPerm(r.data.permission); })
        .catch(() => nav('/documents')).finally(() => setLoading(false));
  };
  useEffect(load, [id]);
  useEffect(() => { api.get('/categories').then(r => setCats(r.data.categories)).catch(() => {}); }, []);

  const openBlob = async (mode) => {
    try {
      const r = await api.get(`/documents/${id}/${mode}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      if (mode === 'download') {
        const a = document.createElement('a');
        a.href = url; a.download = doc.original_name; a.click();
      } else {
        window.open(url, '_blank');
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setSnack('Action impossible.'); }
  };

  const remove = async () => {
    if (!confirm('Supprimer définitivement ce document ?')) return;
    await api.delete(`/documents/${id}`);
    nav('/documents');
  };

  const loadShares = () => {
    api.get(`/shares/document/${id}`).then(r => setShares(r.data.shares)).catch(() => {});
    if (isOwner) api.get('/members/options').then(r => setMembers(r.data.members.filter(m => m.id !== doc?.owner_user_id))).catch(() => {});
  };
  const openShare = () => { loadShares(); setShareOpen(true); };

  // --- Partage du lien (externe) ---
  const shareText = () =>
      `${doc.title} — Coffre Familial\n${window.location.origin}/documents/${doc.id}\n(Connexion requise pour consulter le document.)`;
  const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(shareText())}`, '_blank');
  const shareEmail = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent('Document : ' + doc.title)}&body=${encodeURIComponent(shareText())}`;
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/documents/${doc.id}`); setSnack('Lien copié.'); }
    catch { setSnack('Copie impossible.'); }
  };

  if (loading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>;
  if (!doc) return null;

  return (
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <IconButton onClick={() => nav('/documents')}><ArrowBackIcon /></IconButton>
          <Typography variant="h6" noWrap>{doc.title}</Typography>
        </Stack>

        <Paper sx={{ p: 2, borderRadius: 3, mb: 2 }}>
          {doc.description && <Typography variant="body2" sx={{ mb: 1 }}>{doc.description}</Typography>}
          <Stack spacing={0.5} sx={{ color: 'text.secondary', fontSize: 14 }}>
            <div><b>Catégorie :</b> {doc.category_name || '—'}</div>
            {isOwner && doc.owner_name && <div><b>Appartient à :</b> {doc.owner_name}</div>}
            <div><b>Fichier :</b> {doc.original_name}</div>
            {doc.issue_date && <div><b>Émission :</b> {new Date(doc.issue_date).toLocaleDateString('fr-FR')}</div>}
            {doc.expiry_date && <div><b>Expiration :</b> {new Date(doc.expiry_date).toLocaleDateString('fr-FR')}</div>}
          </Stack>
          {doc.expiry_date && (
              <Chip sx={{ mt: 1 }} size="small" color={new Date(doc.expiry_date) < new Date() ? 'error' : 'warning'}
                    label={new Date(doc.expiry_date) < new Date() ? 'Document expiré' : 'Expire le ' + new Date(doc.expiry_date).toLocaleDateString('fr-FR')} />
          )}
        </Paper>

        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <Button variant="outlined" startIcon={<VisibilityIcon />} fullWidth onClick={() => setViewerOpen(true)}>Voir</Button>
          {canManage && <Button variant="contained" startIcon={<DownloadIcon />} fullWidth onClick={() => openBlob('download')}>Télécharger</Button>}
        </Stack>

        {canManage && (
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Button variant="outlined" startIcon={<Icon>edit</Icon>} fullWidth onClick={() => setEditOpen(true)}>Modifier</Button>
              <Button variant="outlined" color="secondary" startIcon={<ShareIcon />} fullWidth onClick={openShare}>Partager à un membre</Button>
            </Stack>
        )}

        {/* Partage du lien via applications externes */}
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3, mb: 1 }}>
          <Typography variant="caption" color="text.secondary">Envoyer le lien du document</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button fullWidth variant="contained" onClick={shareWhatsApp}
                    startIcon={<Icon>chat</Icon>} sx={{ bgcolor: '#25D366', '&:hover': { bgcolor: '#1da851' } }}>WhatsApp</Button>
            <Button fullWidth variant="outlined" onClick={shareEmail} startIcon={<Icon>email</Icon>}>Email</Button>
            <IconButton onClick={copyLink} title="Copier le lien"><Icon>content_copy</Icon></IconButton>
          </Stack>
        </Paper>

        {canManage && (
            <Button variant="outlined" color="error" fullWidth startIcon={<DeleteIcon />} onClick={remove}>Supprimer</Button>
        )}
        {!canManage && <Alert severity="info" sx={{ mt: 1 }}>Document partagé avec vous en lecture seule.</Alert>}

        <DocViewer open={viewerOpen} onClose={() => setViewerOpen(false)} docId={id}
                   mime={doc.mime_type} name={doc.original_name} canDownload={canManage}
                   onDownload={() => openBlob('download')} />

        <EditDialog open={editOpen} onClose={() => setEditOpen(false)} doc={doc} cats={cats}
                    onSaved={() => { setEditOpen(false); load(); }} notify={setSnack} />

        <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} docId={id} shares={shares} members={members}
                     reload={loadShares} notify={setSnack} />
        <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
                  message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
      </Box>
  );
}

function EditDialog({ open, onClose, doc, cats, onSaved, notify }) {
  const [form, setForm] = useState({ title: '', description: '', category_id: '', issue_date: '', expiry_date: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      title: doc.title || '',
      description: doc.description || '',
      category_id: doc.category_id || '',
      issue_date: doc.issue_date ? String(doc.issue_date).slice(0, 10) : '',
      expiry_date: doc.expiry_date ? String(doc.expiry_date).slice(0, 10) : '',
    });
  }, [open, doc]);

  const save = async () => {
    if (!form.title.trim()) { notify('Le titre est requis.'); return; }
    setBusy(true);
    try {
      await api.put(`/documents/${doc.id}`, {
        title: form.title,
        description: form.description || null,
        category_id: form.category_id || null,
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date || null,
      });
      onSaved(); notify('Document mis à jour.');
    } catch (e) { notify(e.response?.data?.error || 'Échec de la modification.'); }
    finally { setBusy(false); }
  };

  return (
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={window.innerWidth < 600}>
        <DialogTitle>Modifier le document</DialogTitle>
        <DialogContent>
          <TextField label="Titre" fullWidth margin="dense" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField label="Description" fullWidth margin="dense" multiline minRows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <TextField select label="Type / catégorie" fullWidth margin="dense" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <MenuItem value="">—</MenuItem>
            {cats.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </TextField>
          <Stack direction="row" spacing={1}>
            <TextField type="date" label="Émission" InputLabelProps={{ shrink: true }} fullWidth margin="dense" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
            <TextField type="date" label="Expiration" InputLabelProps={{ shrink: true }} fullWidth margin="dense" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="contained" onClick={save} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </DialogActions>
      </Dialog>
  );
}

function ShareDialog({ open, onClose, docId, shares, members, reload, notify }) {
  const [userId, setUserId] = useState('');
  const [permission, setPermission] = useState('view');
  const [expires, setExpires] = useState('');

  const add = async () => {
    if (!userId) return;
    try {
      await api.post('/shares', { document_id: Number(docId), user_id: Number(userId), permission, expires_at: expires || null });
      setUserId(''); setExpires(''); reload(); notify('Partage créé.');
    } catch (e) { notify(e.response?.data?.error || 'Échec du partage.'); }
  };
  const revoke = async (sid) => { await api.delete(`/shares/${sid}`); reload(); notify('Partage révoqué.'); };

  const active = shares.filter(s => !s.revoked);
  return (
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>Partager à un membre</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" sx={{ mt: 1 }}>Nouveau partage</Typography>
          <TextField select label="Avec" fullWidth margin="dense" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <MenuItem value="">Choisir un membre…</MenuItem>
            {members.map(m => <MenuItem key={m.id} value={m.id}>{m.full_name}{m.relationship ? ` (${m.relationship})` : ''}</MenuItem>)}
          </TextField>
          <Stack direction="row" spacing={1}>
            <TextField select label="Droit" fullWidth margin="dense" value={permission} onChange={(e) => setPermission(e.target.value)}>
              <MenuItem value="view">Lecture seule</MenuItem>
              <MenuItem value="download">Lecture + téléchargement</MenuItem>
            </TextField>
            <TextField type="date" label="Expire le (option)" InputLabelProps={{ shrink: true }} fullWidth margin="dense"
                       value={expires} onChange={(e) => setExpires(e.target.value)} />
          </Stack>
          <Button variant="contained" sx={{ mt: 1 }} onClick={add} disabled={!userId}>Ajouter le partage</Button>

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2">Partages actifs</Typography>
          {active.length === 0 ? <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>Aucun partage.</Typography>
              : <List dense>
                {active.map(s => (
                    <ListItem key={s.id} secondaryAction={<Button size="small" color="error" onClick={() => revoke(s.id)}>Révoquer</Button>}>
                      <ListItemText primary={`${s.full_name}${s.relationship ? ' (' + s.relationship + ')' : ''}`}
                                    secondary={`${s.permission === 'download' ? 'Téléchargement' : 'Lecture'}${s.expires_at ? ' · expire le ' + new Date(s.expires_at).toLocaleDateString('fr-FR') : ''}`} />
                    </ListItem>
                ))}
              </List>}
        </DialogContent>
        <DialogActions><Button onClick={onClose}>Fermer</Button></DialogActions>
      </Dialog>
  );
}