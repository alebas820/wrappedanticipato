/* ============================================================
   Spotify Wrapped Anticipato — OAuth PKCE + Spotify Web API
   ============================================================
   1) Vai su https://developer.spotify.com/dashboard → Create app
   2) Redirect URI: il tuo sito (es. http://127.0.0.1:5500/index.html
      oppure https://tuosito.netlify.app)
   3) Incolla qui sotto il CLIENT ID generato.
   ============================================================ */
const CLIENT_ID = '914849546a7e4e9c98177c332c8d4196';

// ------------------------------------------------------------
// Utility PKCE
// ------------------------------------------------------------
const base64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64url(digest);
}

function randomString(len = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const arr = crypto.getRandomValues(new Uint8Array(len));
  return [...arr].map(b => chars[b % chars.length]).join('');
}

function showLoginError(message) {
  const error = document.getElementById('login-error');
  error.textContent = message;
  error.classList.remove('hidden');
}

// ------------------------------------------------------------
// Storage token (in memoria + sessionStorage)
// ------------------------------------------------------------
function saveToken(token, expiresIn) {
  sessionStorage.setItem('sp_token', token);
  sessionStorage.setItem('sp_token_exp', Date.now() + expiresIn * 1000);
}
function getToken() {
  const t = sessionStorage.getItem('sp_token');
  const exp = +sessionStorage.getItem('sp_token_exp');
  return (t && exp > Date.now()) ? t : null;
}

// ------------------------------------------------------------
// OAuth flow
// ------------------------------------------------------------
async function redirectToSpotifyLogin() {
  if (!window.isSecureContext || !crypto.subtle || !crypto.getRandomValues) {
    throw new Error('Per accedere, apri il sito con HTTPS (oppure in localhost).');
  }

  const redirectUri = location.origin + location.pathname;

  const verifier = randomString();
  const challenge = await generateCodeChallenge(verifier);
  sessionStorage.setItem('sp_verifier', verifier);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'user-top-read user-read-email user-read-private',
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  location.href = 'https://accounts.spotify.com/authorize?' + params;
}

async function exchangeCodeForToken(code) {
  const verifier = sessionStorage.getItem('sp_verifier');
  if (!verifier) {
    throw new Error('Verifica di accesso non disponibile. Riprova il login senza chiudere la scheda.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: location.origin + location.pathname,
    client_id: CLIENT_ID,
    code_verifier: verifier,
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Token error');
  saveToken(data.access_token, data.expires_in);

  // pulizia dell'URL
  history.replaceState(null, '', location.pathname);
}

// ------------------------------------------------------------
// Chiamate API
// ------------------------------------------------------------
async function api(path) {
  const res = await fetch('https://api.spotify.com/v1' + path, {
    headers: { Authorization: 'Bearer ' + getToken() },
  });
  if (res.status === 401) {
    sessionStorage.clear();
    showScreen('login');
    throw new Error('Sessione scaduta, rifai il login');
  }
  if (res.status === 403) throw new Error('Spotify ha negato l’accesso ai dati. Verifica che il tuo account sia autorizzato nell’app Spotify Developer e riprova.');
  if (res.status === 429) throw new Error('Troppe richieste a Spotify. Attendi qualche minuto e riprova.');
  if (!res.ok) throw new Error('Errore API: ' + res.status);
  return res.json();
}

async function fetchAllData() {
  const [profile, topArtistsShort, topArtistsMedium, topArtistsLong, topTracksShort, topTracksMedium] = await Promise.all([
    api('/me'),
    api('/me/top/artists?limit=50&time_range=short_term'),
    api('/me/top/artists?limit=50&time_range=medium_term'),
    api('/me/top/artists?limit=50&time_range=long_term'),
    api('/me/top/tracks?limit=50&time_range=short_term'),
    api('/me/top/tracks?limit=50&time_range=medium_term'),
  ]);

  const topList = [topArtistsShort, topArtistsMedium, topArtistsLong].find(l => l.items.length >= 5) || topArtistsLong;
  const artists = topList.items.slice(0, 5);
  const tracks = topTracksShort.items.length >= 10 ? topTracksShort.items : topTracksMedium.items;
  return { profile, artists, tracks, source: 'spotify' };
}

function firstValue(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '');
}

async function importSpotifyHistory(files) {
  if (!files.length) throw new Error('Seleziona almeno un file JSON della cronologia audio.');

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 6);
  const artistTotals = new Map();
  const trackTotals = new Map();
  const albumIds = new Set();
  let totalMsPlayed = 0;
  let playCount = 0;

  for (const file of files) {
    let rows;
    try {
      rows = JSON.parse(await file.text());
    } catch {
      throw new Error('Il file "' + file.name + '" non è un JSON valido.');
    }
    if (!Array.isArray(rows)) {
      throw new Error('Il file "' + file.name + '" non contiene una cronologia audio Spotify riconoscibile.');
    }

    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;

      const trackName = firstValue(
        row.master_metadata_track_name,
        row.trackName,
        row.track_name
      );
      const artistName = firstValue(
        row.master_metadata_album_artist_name,
        row.artistName,
        row.artist_name
      );
      const albumName = firstValue(
        row.master_metadata_album_album_name,
        row.albumName,
        row.album_name
      ) || 'Album sconosciuto';
      const playedAt = firstValue(row.ts, row.endTime, row.end_time, row.timestamp);
      const playedMs = Number(firstValue(row.ms_played, row.msPlayed, row.MsPlayed));
      const playedDate = playedAt ? new Date(playedAt) : null;

      if (
        !trackName ||
        !artistName ||
        row.episode_name ||
        row.episodeName ||
        !Number.isFinite(playedMs) ||
        playedMs <= 0 ||
        !playedDate ||
        Number.isNaN(playedDate.getTime()) ||
        playedDate < cutoff
      ) continue;

      const artistId = 'import-artist:' + artistName;
      const albumId = artistName + '\u0000' + albumName;
      const trackId = firstValue(row.spotify_track_uri, row.trackUri, row.track_uri) ||
        artistName + '\u0000' + trackName;

      let artist = artistTotals.get(artistId);
      if (!artist) {
        artist = { id: artistId, name: artistName, play_count: 0, total_ms_played: 0 };
        artistTotals.set(artistId, artist);
      }
      artist.play_count += 1;
      artist.total_ms_played += playedMs;

      let track = trackTotals.get(trackId);
      if (!track) {
        track = {
          id: trackId,
          name: trackName,
          artists: [{ id: artistId, name: artistName }],
          album: { id: albumId, name: albumName, images: [] },
          play_count: 0,
          total_ms_played: 0,
        };
        trackTotals.set(trackId, track);
      }
      track.play_count += 1;
      track.total_ms_played += playedMs;
      albumIds.add(albumId);
      totalMsPlayed += playedMs;
      playCount += 1;
    }
  }

  const artists = [...artistTotals.values()]
    .sort((a, b) => b.total_ms_played - a.total_ms_played)
    .slice(0, 5);
  const tracks = [...trackTotals.values()]
    .sort((a, b) => b.total_ms_played - a.total_ms_played)
    .slice(0, 50);

  if (!playCount || !artists.length || !tracks.length) {
    throw new Error('Non trovo ascolti musicali negli ultimi 6 mesi. Seleziona i file JSON della cronologia audio più recente.');
  }

  return {
    profile: { display_name: 'Ascoltatore', images: [] },
    artists,
    tracks,
    minutes: Math.round(totalMsPlayed / 60000),
    source: 'import',
    listenerMetrics: {
      playCount,
      artistCount: artistTotals.size,
      albumCount: albumIds.size,
      mainArtistPlayCount: artists[0].play_count,
    },
  };
}

// ------------------------------------------------------------
// Render risultati
// ------------------------------------------------------------
const fmt = n => n.toLocaleString('it-IT');

async function renderAll(data) {
  const { profile, artists, tracks } = data;
  const minutes = Number.isFinite(data.minutes) ? data.minutes : null;
  document.getElementById('hero-name').textContent = profile.display_name || 'utente';
  if (minutes === null) {
    document.getElementById('hero-minutes').textContent = '—';
  } else {
    animateNumber('hero-minutes', minutes);
  }
  document.querySelector('#slide-hero .kicker').textContent =
    'Ciao ' + (profile.display_name || 'utente') + ', ecco il tuo riepilogo';
  document.querySelector('#slide-hero .big-label').innerHTML = data.source === 'import'
    ? 'minuti ascoltati<br/>(cronologia degli ultimi 6 mesi)'
    : 'Spotify non fornisce i minuti reali<br/>con il login diretto';

  // Slide artista #1
  const a1 = artists[0];
  setImage('top-artist-img', a1?.images?.[0]?.url);
  document.getElementById('top-artist-name').textContent = a1?.name || '—';
  document.getElementById('top-artist-followers').textContent =
    a1 ? 'Il tuo artista più ascoltato' : '';
  document.getElementById('top-artist-genres').innerHTML =
    (a1?.genres || []).slice(0, 3).map(g => `<span>${esc(g)}</span>`).join('');

  // Lista artisti
  document.getElementById('artist-list').innerHTML = artists.map((a, i) => `
    <li>
      ${rankImage(a.images?.[2]?.url || a.images?.[0]?.url)}
      <div class="info">
        <div class="name">${esc(a.name)}</div>
        <div class="sub">${i === 0 ? 'Il tuo preferito' : '#' + (i + 1) + ' nella tua classifica'}</div>
      </div>
    </li>`).join('');

  // Brano #1
  const s1 = tracks[0];
  setImage('top-song-img', s1?.album?.images?.[0]?.url);
  document.getElementById('top-song-name').textContent = s1?.name || '—';
  document.getElementById('top-song-artist').textContent = s1
    ? s1.artists.map(a => a.name).join(', ') + ' · ' + (s1.album?.name || '')
    : '';

  // Lista brani
  document.getElementById('song-list').innerHTML = tracks.slice(0, 5).map(t => `
    <li>
      ${rankImage(t.album?.images?.[2]?.url || t.album?.images?.[0]?.url)}
      <div class="info">
        <div class="name">${esc(t.name)}</div>
        <div class="sub">${esc(t.artists.map(a => a.name).join(', '))}</div>
      </div>
    </li>`).join('');

  // Tipo di ascoltatore (dalle abitudini di ascolto)
  computeListenerType(artists, tracks, data.listenerMetrics, data.source === 'import');

  // Riepilogo
  const monthNames = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const listeningTime = minutes === null
    ? 'Spotify non fornisce i minuti di ascolto tramite il login diretto'
    : `Negli ultimi 6 mesi hai ascoltato <b>${fmt(minutes)} minuti</b> di musica`;
  document.getElementById('summary-text').innerHTML =
    `${listeningTime}, ` +
    `con <b>${esc(a1?.name || '?')}</b> come artista del momento ` +
    `e <b>${esc(s1?.name || '?')}</b> in loop infinito. ` +
    `Musica, sopra ogni cosa. — ${monthNames[new Date().getMonth()]} ${new Date().getFullYear()}`;

  // Profilo
  document.getElementById('user-name').textContent = profile.display_name || '';
  const img = profile.images?.[0]?.url;
  setImage('user-img', img);
}

function setImage(id, url) {
  const element = document.getElementById(id);
  if (url) {
    element.src = url;
    element.style.display = '';
  } else {
    element.removeAttribute('src');
    element.style.display = 'none';
  }
}

function rankImage(url) {
  return url
    ? `<img src="${url}" alt="" />`
    : '<span class="rank-placeholder" aria-hidden="true">♫</span>';
}

function animateNumber(id, target) {
  const el = document.getElementById(id);
  const dur = 1200;
  const start = performance.now();
  (function step(now) {
    const p = Math.min((now - start) / dur, 1);
    el.textContent = fmt(Math.round(target * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(step);
  })(start);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ------------------------------------------------------------
// UI navigazione slide
// ------------------------------------------------------------
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

let current = 0;
const slides = () => [...document.querySelectorAll('.slide')];

function goTo(i) {
  const list = slides();
  current = Math.max(0, Math.min(i, list.length - 1));
  list.forEach((s, idx) => s.classList.toggle('active', idx === current));
  document.getElementById('btn-prev').disabled = current === 0;
  document.getElementById('btn-next').disabled = current === list.length - 1;
  document.getElementById('dots').innerHTML =
    list.map((_, idx) => `<span class="${idx === current ? 'on' : ''}" data-i="${idx}"></span>`).join('');
}

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------
window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('btn-login').addEventListener('click', async () => {
    const error = document.getElementById('login-error');
    error.textContent = '';
    error.classList.add('hidden');

    if (!CLIENT_ID || CLIENT_ID.startsWith('INSERISCI')) {
      showLoginError('Configura prima il CLIENT_ID in app.js (vedi README).');
      return;
    }

    try {
      await redirectToSpotifyLogin();
    } catch (err) {
      showLoginError('Errore durante l’avvio del login: ' + err.message);
    }
  });

  document.getElementById('btn-import').addEventListener('click', async () => {
    const error = document.getElementById('login-error');
    const button = document.getElementById('btn-import');
    const files = Array.from(document.getElementById('history-files').files || []);
    error.textContent = '';
    error.classList.add('hidden');
    button.disabled = true;

    try {
      showScreen('loading');
      document.getElementById('loading-text').textContent = 'Leggo la cronologia sul tuo dispositivo…';
      const data = await importSpotifyHistory(files);
      lastData = data;
      await renderAll(data);
      showScreen('results');
      goTo(0);
    } catch (err) {
      console.error(err);
      showScreen('login');
      showLoginError('Impossibile creare il riepilogo: ' + err.message);
    } finally {
      button.disabled = false;
    }
  });

  document.getElementById('btn-next').addEventListener('click', () => goTo(current + 1));
  document.getElementById('btn-prev').addEventListener('click', () => goTo(current - 1));
  document.getElementById('dots').addEventListener('click', e => {
    if (e.target.dataset.i) goTo(+e.target.dataset.i);
  });
  document.getElementById('btn-replay').addEventListener('click', () => {
    sessionStorage.clear();
    showScreen('login');
  });

  document.getElementById('btn-download').addEventListener('click', downloadSummaryImage);

  // torna da Spotify con il codice?
  const code = new URLSearchParams(location.search).get('code');
  const oauthError = new URLSearchParams(location.search).get('error');
  let msgTimer;
  try {
    if (oauthError) {
      const messages = {
        access_denied: 'Hai annullato l’accesso a Spotify. Puoi riprovare quando vuoi.',
      };
      showLoginError(messages[oauthError] || 'Spotify non ha completato il login (' + oauthError + '). Riprova.');
      history.replaceState(null, '', location.pathname);
      showScreen('login');
      return;
    }

    if (code) {
      showScreen('loading');
      document.getElementById('loading-text').textContent = 'Collegamento all\u2019account…';
      await exchangeCodeForToken(code);
    }

    const token = getToken();
    if (!token) { showScreen('login'); return; }

    showScreen('loading');
    // messaggi di caricamento animati
    const msgs = ['Carico i tuoi artisti…', 'Conto i minuti…', 'Sfoglio i generi…', 'Quasi finito…'];
    let mi = 0;
    msgTimer = setInterval(() => {
      document.getElementById('loading-text').textContent = msgs[mi++ % msgs.length];
    }, 700);

    const data = await fetchAllData();
    clearInterval(msgTimer);

    lastData = data;
    await renderAll(data);
    showScreen('results');
    goTo(0);
  } catch (err) {
    clearInterval(msgTimer);
    console.error(err);
    showScreen('login');
    showLoginError('Errore: ' + err.message);
  }
});

// ------------------------------------------------------------
// Immagine riepilogo (canvas → PNG scaricabile)
// ------------------------------------------------------------
let lastData = null;

async function loadImage(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function downloadSummaryImage() {
  if (!lastData) return;
  const { profile, artists, tracks } = lastData;
  const minutes = Number.isFinite(lastData.minutes) ? fmt(lastData.minutes) : '—';
  const topArtist = artists[0];
  const topSong = tracks[0];

  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // sfondo
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#1DB954');
  grad.addColorStop(.45, '#191414');
  grad.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // titolo
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.font = '700 34px Montserrat, sans-serif';
  ctx.fillText('IL TUO WRAPPED IN ANTICIPO', W / 2, 110);

  // nome utente
  ctx.fillStyle = '#fff';
  ctx.font = '900 64px Montserrat, sans-serif';
  ctx.fillText(profile.display_name || 'Utente Spotify', W / 2, 190);

  // minuti
  ctx.fillStyle = '#1DB954';
  ctx.font = '900 130px Montserrat, sans-serif';
  ctx.fillText(minutes, W / 2, 350);
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.font = '600 36px Montserrat, sans-serif';
  ctx.fillText(Number.isFinite(lastData.minutes) ? 'minuti ascoltati' : 'minuti non disponibili da Spotify', W / 2, 405);

  // copertine artista e brano
  const pad = 90, cardW = 400, cardH = 400, gap = 60;
  const y0 = 480;
  const imgArtist = topArtist ? await loadImage(topArtist.images?.[0]?.url || '') : null;
  const imgSong = topSong ? await loadImage(topSong.album?.images?.[0]?.url || '') : null;
  const x1 = pad + cardW + gap, y1 = y0 + cardH + 60;

  const drawCard = (x, y, w, h, img, label, name, sub) => {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.6)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#1c1c1e';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 24);
    ctx.fill();
    ctx.restore();
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x + (w - 240) / 2, y + 40, 240, 240, 16);
      ctx.clip();
      ctx.drawImage(img, x + (w - 240) / 2, y + 40, 240, 240);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.beginPath();
      ctx.roundRect(x + (w - 240) / 2, y + 40, 240, 240, 16);
      ctx.fill();

    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1DB954';
    ctx.font = '800 26px Montserrat, sans-serif';
    ctx.fillText(label, x + w / 2, y + 325);
    ctx.fillStyle = '#fff';
    ctx.font = '900 34px Montserrat, sans-serif';
    ctx.fillText(truncate(name, 20), x + w / 2, y + 365);
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.font = '600 24px Montserrat, sans-serif';
    ctx.fillText(truncate(sub, 30), x + w / 2, y + 395);
  };

  drawCard(pad, y0, cardW, cardH, imgArtist, 'ARTISTA N.1', topArtist?.name || '—', 'Il tuo preferito');
  drawCard(x1, y0, cardW, cardH, imgSong, 'BRANO N.1', topSong?.name || '—',
    topSong ? topSong.artists.map(a => a.name).join(', ') : '');

  // top 3 artisti
  ctx.fillStyle = '#1DB954';
  ctx.font = '800 28px Montserrat, sans-serif';
  ctx.fillText('I TUOI TOP 3 ARTISTI', W / 2, y1 + 40);
  ctx.fillStyle = '#fff';
  ctx.font = '700 34px Montserrat, sans-serif';
  artists.slice(0, 3).forEach((a, i) => {
    ctx.fillText(`${i + 1}. ${truncate(a.name, 28)}`, W / 2, y1 + 95 + i * 55);
  });

  // tipo di ascoltatore (dalla penultima slide)
  if (window.listenerResult) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.font = '800 26px Montserrat, sans-serif';
    ctx.fillText(window.listenerResult.emoji + '  ' + window.listenerResult.title.toUpperCase(), W / 2, H - 120);
  }

  // firma
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.font = '600 22px Montserrat, sans-serif';
  ctx.fillText('Creato da Alessandro Basciano · alessandrobasciano1@gmail.com', W / 2, H - 60);

  canvas.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'wrapped-anticipato.png';
    a.click();
    URL.revokeObjectURL(a.href);
  }, 'image/png');
}

function truncate(s, n) {
  s = String(s);
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ------------------------------------------------------------
// Tipo di ascoltatore (basato su dati reali di ascolto)
// ------------------------------------------------------------
function computeListenerType(artists, tracks, metrics, imported) {
  const totalPlays = metrics?.playCount || tracks.reduce((sum, track) => sum + (track.play_count || 1), 0) || 1;
  const uniqArtists = metrics?.artistCount || new Set(tracks.flatMap(t => t.artists.map(a => a.id))).size;
  const uniqAlbums = metrics?.albumCount ?? new Set(tracks.map(t => t.album?.id)).size;
  const mainArtistPlays = metrics?.mainArtistPlayCount ??
    tracks.filter(t => t.artists.some(a => a.id === artists[0]?.id))
      .reduce((sum, track) => sum + (track.play_count || 1), 0);
  const loyalty = mainArtistPlays / totalPlays;         // quanto ascolti sempre lo stesso artista
  const variety = uniqArtists / totalPlays;             // quanto vari nel gusto
  const repeatRate = 1 - (uniqAlbums / totalPlays);     // quanto riascolti gli stessi album

  // popolarità media degli artisti ascoltati (0-100)
  const avgPop = artists.length
    ? artists.reduce((s, a) => s + (a.popularity || 0), 0) / artists.length
    : 50;

  let emoji, title, desc;

  if (loyalty >= 0.35) {
    emoji = '💔';
    title = 'Ascoltatore con il cuore spezzato';
    desc = `Hai ascoltato <b>${esc(artists[0]?.name || 'lo stesso artista')}</b> in ${Math.round(loyalty * 100)}% dei tuoi ascolti. Non sei riuscito/a a staccarti — che sia amore o una vendetta, questo è il tuo posto sicuro.`;
  } else if (repeatRate >= 0.55) {
    emoji = '🔁';
    title = 'Ascoltatore in loop infinito';
    desc = `Riascolti sempre le stesse cose: album ricorrenti nel ${Math.round(repeatRate * 100)}% dei casi. Perché cercare qualcosa di nuovo, quando il comfort esiste?`;
  } else if (variety >= 0.75) {
    emoji = '🌍';
    title = 'Esploratore infaticabile';
    desc = `Hai suonato <b>${uniqArtists} artisti diversi</b> in ${totalPlays} ascolti. Sei quello/a che scopre il brano prima che diventi famoso — e lo ricorda a tutti.`;
  } else if (!imported && avgPop < 45) {
    emoji = '🕵️';
    title = 'Cacciatore di gemme nascoste';
    desc = `I tuoi artisti hanno una popolarità media di soli <b>${Math.round(avgPop)}/100</b>. Mentre gli altri seguono le classifiche, tu scavi dove nessun altro guarda.`;
  } else if (!imported && avgPop >= 78) {
    emoji = '📈';
    title = 'Affidabile al servizio tendenze';
    desc = `Popolarità media <b>${Math.round(avgPop)}/100</b>: ascolti chi domina le classifiche. Zero ansia da FOMO — quando tutti parlano di qualcosa, tu lo conosci già.`;
  } else {
    emoji = '🎧';
    title = 'Ascoltatore equilibrato';
    desc = `${uniqArtists} artisti diversi, un tocco di fedeltà a <b>${esc(artists[0]?.name || 'qualcuno')}</b> e un orecchio sempre pronto al nuovo. Il giusto mix di abitudine e curiosità.`;
  }

  document.getElementById('listener-emoji').textContent = emoji;
  document.getElementById('listener-title').textContent = title;
  document.getElementById('listener-desc').innerHTML = desc;

  // salvato per l'immagine scaricabile
  window.listenerResult = { emoji, title };
}
