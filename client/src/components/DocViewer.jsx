import { useEffect, useRef, useState } from 'react';
import { Dialog, AppBar, Toolbar, IconButton, Typography, Box, CircularProgress, Button, Icon } from '@mui/material';
import api from '../api.js';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Worker pdf.js servi localement (bundlé par Vite) — fiable sur mobile.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Visualiseur de documents plein écran.
 * - PDF : rendu page par page sur canvas (pdf.js), ajusté à la largeur.
 * - Images : affichage direct.
 * - Autres : message + bouton de téléchargement.
 * Le fichier est récupéré déchiffré via l'API (/documents/:id/view).
 */
export default function DocViewer({ open, onClose, docId, mime, name, canDownload, onDownload }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [pageInfo, setPageInfo] = useState('');
  const containerRef = useRef(null);
  const isPdf = mime?.includes('pdf');
  const isImage = mime?.startsWith('image/');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let objectUrl = '';
    setLoading(true); setError(''); setImgUrl(''); setPageInfo('');

    (async () => {
      try {
        const r = await api.get(`/documents/${docId}/view`, { responseType: 'blob' });
        if (cancelled) return;

        if (isImage) {
          objectUrl = URL.createObjectURL(r.data);
          setImgUrl(objectUrl);
          setLoading(false);
          return;
        }
        if (isPdf) {
          const data = await r.data.arrayBuffer();
          if (cancelled) return;
          // laisser le Dialog se dimensionner avant de mesurer la largeur
          await new Promise((res) => setTimeout(res, 60));
          const container = containerRef.current;
          if (!container) return;
          container.innerHTML = '';
          const pdf = await pdfjsLib.getDocument({ data }).promise;
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const targetWidth = Math.min(container.clientWidth || 360, 1000);
          for (let i = 1; i <= pdf.numPages; i++) {
            if (cancelled) return;
            const page = await pdf.getPage(i);
            const base = page.getViewport({ scale: 1 });
            const scale = targetWidth / base.width;
            const viewport = page.getViewport({ scale: scale * dpr });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = '100%';
            canvas.style.display = 'block';
            canvas.style.margin = '0 auto 10px';
            canvas.style.borderRadius = '8px';
            canvas.style.boxShadow = '0 1px 6px rgba(0,0,0,.15)';
            container.appendChild(canvas);
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          }
          setPageInfo(`${pdf.numPages} page(s)`);
          setLoading(false);
          return;
        }
        // Type non prévisualisable
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setError('Impossible d\'afficher ce document.'); setLoading(false); }
      }
    })();

    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [open, docId, mime]);

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <AppBar sx={{ position: 'sticky', bgcolor: 'primary.dark' }} elevation={0}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onClose}><Icon>close</Icon></IconButton>
          <Typography variant="subtitle1" sx={{ flexGrow: 1 }} noWrap>{name}</Typography>
          {pageInfo && <Typography variant="caption" sx={{ mr: 1, opacity: .8 }}>{pageInfo}</Typography>}
          {canDownload && <IconButton color="inherit" onClick={onDownload}><Icon>download</Icon></IconButton>}
        </Toolbar>
      </AppBar>

      <Box sx={{ bgcolor: '#334155', minHeight: '100%', p: { xs: 1, sm: 2 } }}>
        {loading && <Box sx={{ textAlign: 'center', py: 6, color: '#fff' }}><CircularProgress color="inherit" /></Box>}
        {error && (
          <Box sx={{ textAlign: 'center', py: 6, color: '#fff' }}>
            <Typography sx={{ mb: 2 }}>{error}</Typography>
            {canDownload && <Button variant="contained" onClick={onDownload}>Télécharger</Button>}
          </Box>
        )}
        {!loading && !error && isImage && (
          <Box sx={{ textAlign: 'center' }}>
            <img src={imgUrl} alt={name} style={{ maxWidth: '100%', borderRadius: 8 }} />
          </Box>
        )}
        {isPdf && <Box ref={containerRef} sx={{ maxWidth: 1000, mx: 'auto' }} />}
        {!loading && !error && !isPdf && !isImage && (
          <Box sx={{ textAlign: 'center', py: 6, color: '#fff' }}>
            <Typography sx={{ mb: 2 }}>Aperçu non disponible pour ce type de fichier.</Typography>
            {canDownload && <Button variant="contained" onClick={onDownload}>Télécharger</Button>}
          </Box>
        )}
      </Box>
    </Dialog>
  );
}
