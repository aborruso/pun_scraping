"""# Scraper Piattaforma Unica Nazionale (PUN)

Questo repository contiene uno script Python per interrogare l'API della Piattaforma Unica Nazionale (PUN) e raccogliere dettagli sulle stazioni di ricarica.

## `scraper_signed.py`

Questo script legge un elenco di ID di stazioni di ricarica, recupera i dettagli in batch e li salva in un file.

### Funzionamento

1.  **Lettura degli ID**: Lo script legge gli `evse_id` dal file `pun_pdr.ndjson`.
2.  **Ottenimento Credenziali**: Per ogni batch di 100 ID, esegue lo script Node.js `get_credentials.js` per ottenere credenziali AWS temporanee necessarie per l'autenticazione.
3.  **Richiesta API**: Effettua una richiesta POST autenticata all'endpoint `https://api.pun.piattaformaunicanazionale.it/v1/chargepoints/group`.
4.  **Salvataggio Dati**: I dettagli delle stazioni ricevuti vengono aggiunti in append al file `station_details.jsonl`.

### Utilizzo

1.  Assicurarsi che il file `pun_pdr.ndjson` sia presente nella root del progetto e contenga gli ID delle stazioni da interrogare.
2.  Installare le dipendenze Python e Node.js come descritto sotto.
3.  Eseguire lo script:
    ```bash
    python scraper_signed.py
    ```
    Per eseguire lo script in modalità debug (solo i primi 3 cicli), usare:
    ```bash
    python scraper_signed.py --debug
    ```

## `get_credentials.js`

Questo script è **richiesto da `scraper_signed.py`** per ottenere le credenziali di autenticazione temporanee.

### Funzionamento

Utilizza `playwright` per avviare un browser headless, navigare sulla pagina della Piattaforma Unica Nazionale e intercettare la risposta di rete che contiene le credenziali AWS Cognito. Le credenziali vengono quindi salvate nel file `aws_creds.json`.

### Dipendenze

**Node.js**:
-   `playwright`

È possibile installarle con npm:
```bash
npm install playwright
```

## `scripts/lista.sh`

Questo script elabora il file `pun_pdr.ndjson` per creare delle versioni semplificate e datate in formato JSONL and CSV.

### Funzionamento

1.  **Estrae la data**: Ricava la data di ultima modifica del file `pun_pdr.ndjson`.
2.  **Crea il file JSONL**: Utilizza `jq` per estrarre i campi `status`, `latitude`, `longitude`, e `evse_id` da `pun_pdr.ndjson` e li salva in un nuovo file `data/<data>_pun_pdr.jsonl`.
3.  **Converte in CSV**: Utilizza `mlr` (Miller) per convertire il file JSONL appena creato in un file CSV (`data/<data>_pun_pdr.csv`).

### Dipendenze

-   `jq`
-   `mlr` (Miller)
""
