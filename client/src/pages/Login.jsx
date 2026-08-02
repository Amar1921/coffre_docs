import { LockIcon, Visibility, VisibilityOff } from '../icons.jsx';
import { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, Alert, InputAdornment, IconButton } from '@mui/material';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try { await login(email.trim().toLowerCase(), password); }
    catch (err) { setError(err.response?.data?.error || 'Connexion impossible.'); }
    finally { setBusy(false); }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2,
      background: 'linear-gradient(160deg,#0f766e,#0b1533)' }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 380, borderRadius: 4 }} elevation={10}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box sx={{ width: 60, height: 60, borderRadius: 3, bgcolor: 'primary.main', color: '#fff',
            display: 'grid', placeItems: 'center', mx: 'auto', mb: 1.5 }}>
            <LockIcon fontSize="large" />
          </Box>
          <Typography variant="h6">Coffre Familial</Typography>
          <Typography variant="body2" color="text.secondary">Vos documents, en sécurité.</Typography>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form onSubmit={submit}>
          <TextField label="Email" type="email" fullWidth required margin="normal"
            value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          <TextField label="Mot de passe" type={show ? 'text' : 'password'} fullWidth required margin="normal"
            value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
            InputProps={{ endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShow(s => !s)} edge="end">{show ? <VisibilityOff /> : <Visibility />}</IconButton>
              </InputAdornment>) }} />
          <Button type="submit" variant="contained" fullWidth size="large" disabled={busy} sx={{ mt: 2, py: 1.3 }}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </Button>
        </form>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 3 }}>
          Accès réservé aux membres de la famille.
        </Typography>
      </Paper>
    </Box>
  );
}
