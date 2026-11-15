# Spotify Wrapped Anticipato 🎧

Sito statico che mostra un riepilogo dei tuoi ascolti Spotify. Puoi collegare
l'account con OAuth 2.0 + PKCE oppure importare i file JSON della cronologia,
senza login.

Nessun backend necessario: i dati e i file importati vengono elaborati nel
browser e non sono inviati o salvati dal sito.

## Usare l'importazione (senza login)

1. Vai su [Privacy account Spotify](https://www.spotify.com/account/privacy/) e
   richiedi il download dei tuoi dati. Spotify include la cronologia streaming
   dell'ultimo anno nei dati dell'account; puoi anche richiedere la cronologia
   streaming estesa. Per i dettagli, consulta la guida Spotify
   [Comprendere i tuoi dati](https://support.spotify.com/it/article/understanding-your-data/).
2. Quando Spotify ti rende disponibile l'archivio, scaricalo ed estrai il file
   ZIP.
3. Nel sito seleziona uno o più file JSON della cronologia audio (spesso chiamati
   `Streaming_History_Audio_...json`) e premi **Crea il riepilogo dall'archivio**.

L'importazione usa gli ascolti musicali degli ultimi 6 mesi presenti nei file,
calcola i minuti dai millisecondi riprodotti e ordina artisti e brani in base
al tempo totale di ascolto. File, nomi e cronologia restano sul dispositivo:
non vengono caricati su un server. Questa modalità non include immagini,
generi o popolarità Spotify, perché questi dati non sono contenuti nella
cronologia esportata.

## Configurazione Spotify

Il login diretto richiede comunque la configurazione OAuth descritta qui sotto
ed è soggetto alle regole di accesso Spotify. Per usare il sito senza essere
nella allowlist, scegli l'importazione qui sopra. Spotify non restituisce i
minuti realmente ascoltati tramite gli endpoint top tracks: il login diretto
mostra artisti e brani ma non un conteggio dei minuti.

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
