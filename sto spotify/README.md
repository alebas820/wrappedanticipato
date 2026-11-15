# Spotify Wrapped Anticipato 🎧

Sito statico che collega l'account Spotify dell'utente (OAuth 2.0 con PKCE) e mostra
un "Wrapped" anticipato: minuti ascoltati, artista n.1, top 5 artisti, brano e top 5
brani, generi preferiti e riepilogo finale — il tutto in slide in stile Wrapped.

Nessun backend necessario: tutto avviene nel browser e nessun dato viene salvato.

## Configurazione (2 minuti)

1. Vai su [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) → **Create app**
2. Compila:
   - **App name**: a piacere (es. "Wrapped Anticipato")
   - **Redirect URI**: l'URL dove girerà il sito, ad esempio:
     - in locale: `http://127.0.0.1:5500/index.html`
     - in produzione: `https://tuosito.netlify.app` (o dove lo pubblichi)
   - **APIs used**: Web API
3. Copia il **Client ID** e incollalo in `app.js` alla riga:
   ```js
   const CLIENT_ID = '914849546a7e4e9c98177c332c8d4196';
   ```
4. Assicurati che l'account che farà il login sia aggiunto in
   **User Management** dell'app (fino a 25 utenti gratis in Development Mode).

## Avvio in locale

Servire i file con qualsiasi server statico, ad esempio con VS Code "Live Server"
(sulla porta `:5500`) oppure:

```powershell
python -m http.server 5500
```

poi apri `http://127.0.0.1:5500/index.html` (il redirect URI nel dashboard deve combaciare **esattamente**).

## Pubblicazione

Carica i 3 file su GitHub Pages, Netlify, Vercel o Cloudflare Pages e aggiungi
l'URL pubblico tra i Redirect URI dell'app Spotify.

## Note

- Lo Spotify Wrapped ufficiale arriva a dicembre; questo sito usa gli endpoint
  `top artists/tracks` (`short_term` ≈ ultime 4 settimane, con fallback su
  `medium_term` ≈ 6 mesi), quindi offre un'anteprima continua tutto l'anno.
- Scope richiesti (solo lettura): `user-top-read`, `user-read-email`, `user-read-private`.
