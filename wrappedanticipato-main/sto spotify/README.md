# Spotify Wrapped Anticipato 🎧

Sito statico che collega l'account Spotify dell'utente (OAuth 2.0 con PKCE) e mostra
un "Wrapped" anticipato: minuti ascoltati, artista n.1, top 5 artisti, brano e top 5
brani, generi preferiti e riepilogo finale — il tutto in slide in stile Wrapped.

Nessun backend necessario: tutto avviene nel browser. Il profilo non viene
salvato dal sito; il Client ID e il token restano nella sessione del browser.

## Configurazione Spotify

1. Vai su [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   e crea un'app.
2. Aggiungi come **Redirect URI** l'indirizzo esatto della pagina, ad esempio
   `https://tuosito.netlify.app/index.html` (in locale:
   `http://127.0.0.1:5500/index.html`).
3. Abilita la **Web API** e copia il **Client ID** in `app.js`, nella costante
   `CLIENT_ID`.
4. In **Development Mode**, aggiungi in **User Management** ogni account che
   deve poter usare l'app. Le regole attuali consentono fino a 5 utenti
   autorizzati; il proprietario dell'app deve avere Spotify Premium.

Lo username Spotify non è un metodo di autenticazione e non permette di leggere
minuti ascoltati, top artisti o top brani. Per creare il Wrapped serve che ogni
utente colleghi il proprio account e autorizzi l'app tramite Spotify OAuth.

Per consentire l'accesso senza allowlist servirebbe l'approvazione Spotify per
**Extended Quota Mode**. Dal 15 maggio 2025 Spotify accetta richieste di accesso
esteso solo da organizzazioni e pubblica requisiti tra cui un servizio già
lanciato e almeno 250.000 utenti attivi mensili; non è una soluzione disponibile
per un progetto personale.

Il redirect URI registrato deve corrispondere esattamente all'indirizzo usato
dall'utente, inclusi `https://` (obbligatorio fuori da localhost), eventuale `www`
e percorso (`/` o `/index.html`): per esempio, `https://example.com` e
`https://www.example.com` sono indirizzi diversi per Spotify.

Consulta le [regole ufficiali sulle modalità quota](https://developer.spotify.com/documentation/web-api/concepts/quota-modes)
e i [criteri per l'accesso esteso](https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access).

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
