import { useEffect, useState } from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemText, Chip, Stack } from '@mui/material';
import api from '../api.js';

const LABELS = {
  LOGIN: 'Connexion', UPLOAD: 'Ajout', VIEW: 'Consultation', DOWNLOAD: 'Téléchargement',
  DELETE: 'Suppression', SHARE: 'Partage', REVOKE_SHARE: 'Révocation', UPDATE: 'Modification',
  MEMBER_CREATE: 'Membre créé', MEMBER_UPDATE: 'Membre modifié', MEMBER_DELETE: 'Membre supprimé',
  PASSWORD_CHANGE: 'Mot de passe',
};
const color = (a, ok) => !ok ? 'error' : ['DELETE', 'REVOKE_SHARE', 'MEMBER_DELETE'].includes(a) ? 'warning'
  : ['SHARE', 'UPLOAD', 'MEMBER_CREATE'].includes(a) ? 'success' : 'default';

export default function Audit() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { api.get('/audit?limit=200').then(r => setLogs(r.data.logs)).catch(() => {}); }, []);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>Journal d'audit</Typography>
      <Paper sx={{ borderRadius: 3 }}>
        <List dense>
          {logs.map(l => (
            <ListItem key={l.id} divider>
              <ListItemText
                primary={<Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" color={color(l.action, l.success)} label={LABELS[l.action] || l.action} />
                  <Typography variant="body2">{l.user_name || 'Système'}</Typography>
                </Stack>}
                secondary={`${new Date(l.created_at).toLocaleString('fr-FR')}${l.entity_type ? ' · ' + l.entity_type + ' #' + (l.entity_id ?? '') : ''}${l.ip ? ' · ' + l.ip : ''}`}
              />
            </ListItem>
          ))}
          {logs.length === 0 && <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>Aucune activité.</Box>}
        </List>
      </Paper>
    </Box>
  );
}
