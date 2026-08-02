import { ArrowBackIcon, VisibilityIcon, DownloadIcon, DeleteIcon, ShareIcon } from '../icons.jsx';
import { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Stack, Button, Chip, Divider, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, MenuItem, TextField, List, ListItem, ListItemText, CircularProgress, Snackbar, Alert
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
  const [shares, setShares] = useState([]);
  const [members, setMembers] = useState([]);
  const [snack, setSnack] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const canManage = perm === 'download';

  const load = () => {
    setLoading(true);
    api.get(`/documents/${id}`).then(r => { setDoc(r.data.document); setPerm(r.data.permission); })
      .catch(() => nav('/documents')).finally(() => setLoading(false));
  };
  useEffect(load, [id]);

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
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="secondary" startIcon={<ShareIcon />} fullWidth onClick={openShare}>Partager</Button>
          <Button variant="outlined" color="error" startIcon={<DeleteIcon />} fullWidth onClick={remove}>Supprimer</Button>
        </Stack>
      )}
      {!canManage && <Alert severity="info" sx={{ mt: 1 }}>Document partagé avec vous en lecture seule.</Alert>}

      <DocViewer open={viewerOpen} onClose={() => setViewerOpen(false)} docId={id}
        mime={doc.mime_type} name={doc.original_name} canDownload={canManage}
        onDownload={() => openBlob('download')} />

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} docId={id} shares={shares} members={members}
        reload={loadShares} notify={setSnack} />
      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
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
      <DialogTitle>Partager le document</DialogTitle>
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
