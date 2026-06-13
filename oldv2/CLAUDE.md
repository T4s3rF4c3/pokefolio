# PokéPreis / PokéCapital

WebApp für Pokémon-Kartenpreise und Sammlungsverwaltung, ausgerichtet auf deutsche/europäische Sammler. Preise kommen live von der öffentlichen TCGdex API (Cardmarket EUR); Sammlung, Preis-Historie und Einstellungen liegen lokal in SQLite (Prisma) hinter einem Express-Server.

## Stack

| Layer | Technologie |
|---|---|
| Frontend | React 19 + Vite 8 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite` Plugin) |
| Charts | Recharts 3 (lazy geladen, eigener Chunk) |
| Routing | React Router 7 |
| Backend | Express 5 (`server/index.js`, Port 3001, Proxy via `/api`) |
| Datenbank | SQLite via Prisma (`prisma/dev.db`) |
| Datenquelle | TCGdex API `https://api.tcgdex.net/v2` (+ pokemontcg.io & manuelle Karten als Fallback) |

## Entwicklung

```bash
npm run dev      # Vite (5173) + API-Server (3001) parallel via concurrently
npm run build    # Produktions-Build
npm run server   # Nur API-Server
npx prisma generate  # Nach Schema-Änderungen (Dev-Server vorher stoppen – DLL-Lock!)
```

## Projektstruktur

```
pokeprice/
├── server/
│   ├── index.js                # Express-API: Collection, Snapshots, Backup, Settings
│   └── snapshot.js             # Täglicher Preis-Snapshot (12:00 + Start-Nachholer)
├── shared/
│   └── pricing.js              # Gemeinsame Preis-Logik (Frontend + Server!)
├── prisma/schema.prisma        # CollectionEntry, CardSnapshot, PortfolioSnapshot, …
├── src/
│   ├── api/
│   │   ├── tcgdex.js           # TCGdex-Calls, Suche, cardmarketUrl(); re-exportiert shared/pricing
│   │   └── pokemontcg.js       # pokemontcg.io Fallback
│   ├── data/
│   │   ├── collection.js       # REST-Wrapper für /api/collection etc.
│   │   └── manualCards.js      # Manuell gepflegte Karten
│   ├── components/
│   │   ├── SearchBar.jsx       # Intelligente Suche mit Autocomplete
│   │   ├── CollectionModal.jsx # Karte+Variante zur Sammlung (je Variante eigener Eintrag)
│   │   ├── PriceChart.jsx      # Echte Tages-Snapshots, Fallback avg30/avg7/avg1-Pseudoachse
│   │   └── PriceTable.jsx      # Alle Cardmarket-Preisfelder tabellarisch
│   └── pages/
│       ├── Home.jsx            # Startseite + Suchergebnisse (/suche?q=)
│       ├── CardDetail.jsx      # Detail mit Chart, Sammlung-Button, Cardmarket-Link
│       ├── Portfolio.jsx       # Sammlung mit Wert, Tagesveränderung, Verlauf (lazy)
│       ├── Analytics.jsx       # Auswertungen (lazy)
│       └── Admin.jsx           # Backup/Restore, Wartung (lazy)
└── vite.config.js
```

## Sammlung & Preis-Logik (wichtig!)

- **Ein Eintrag pro Karte+Variante**: `CollectionEntry.id = "{cardId}:{variant}"` (normal/holo/reverse/firstEdition). Eine Karte kann gleichzeitig in mehreren Varianten in der Sammlung sein. API: `PUT/DELETE /api/collection/:cardId/:variant`, `GET /api/collection/:cardId` → Array.
- **Cardmarket liefert `0` statt `null`** für nicht existierende Varianten-Preise (z.B. `trend-holo: 0` bei Holo-only-Karten, deren echte Preise in den Normal-Feldern stehen). `shared/pricing.js#extractPrices` normalisiert alle Werte ≤ 0 zu `null` – niemals rohe `pricing.cardmarket`-Felder mit `??` verketten!
- **`priceForEntry(entry, prices)`** ist die einzige Quelle für den Preis eines Sammlungs-Eintrags (Holo → Holo-Felder mit Normal-Fallback). Wird von Portfolio UND Server-Snapshot genutzt.
- **Tages-Snapshots**: `server/snapshot.js` läuft beim Serverstart (Nachholer) und täglich 12:00; schreibt `CardSnapshot` (trend/avg7/avg30 je Karte) und `PortfolioSnapshot` (Gesamtwert). Manuell: `POST /api/snapshot/run`. Die Portfolio-Seite upsertet zusätzlich beim Öffnen.
- **Cardmarket-Link**: `cardmarketUrl(card)` nutzt `pricing.cardmarket.idProduct` (Deeplink), sonst Namens-Suche.

## TCGdex API

Basis-URL: `https://api.tcgdex.net/v2/{lang}/`

Wichtige Endpoints:
- `GET /de/cards?name={query}` – Suche nach Name
- `GET /de/cards?localId={number}` – Suche nach Kartennummer (Substring-Match!)
- `GET /de/cards/{id}` – Einzelkarte mit vollem Pricing-Objekt
- `GET /de/sets` – Alle Sets (Brief-Daten, kein `abbreviation`)
- `GET /de/sets/{id}` – Set-Detail inkl. `abbreviation.official` und Kartenliste

**Sprachen:** `de` (Primär), `en` (Fallback). Suchen laufen immer parallel in beiden Sprachen.

**Cardmarket EUR Preisfelder** (im `pricing.cardmarket`-Objekt einer Karte):
- `trend`, `avg1`, `avg7`, `avg30` – Trend und Durchschnitte
- `avg` = Marktpreis, `low` = Niedrigster Preis
- Holo-Varianten: `trend-holo`, `avg1-holo`, `avg7-holo`, `avg30-holo`, `avg-holo`, `low-holo`

## Intelligente Suche

Die Suchlogik in `src/api/tcgdex.js` erkennt drei Eingabeformate:

| Format | Beispiel | Erkennung |
|---|---|---|
| Kartenname | `Pikachu`, `Charizard ex` | freier Text |
| Cardmarket-Kürzel + Nummer | `POR 121`, `ASC269`, `SWSH12 185` | `[A-Za-z]{2,7}\d{0,3} \d{1,4}` |
| TCGdex Karten-ID | `sv1-1`, `swsh12-185` | `[letters][digits]-[digits]` |

### Kürzel + Nummer (3-Pass-Strategie)

Das kritische Problem: `?localId=121` liefert kein `set`-Objekt zurück, und Cardmarket-Kürzel (`POR`) entsprechen nicht dem TCGdex-Set-Namen (`Optimale Ordnung`).

**Pass 1** – Heuristik: Set-ID aus Card-ID extrahieren (`me03-121` → `me03`), mit Kürzel vergleichen. Schnell, keine Extra-Requests.

**Pass 2** – Offizielle Abkürzung: `abbreviation.official` aus Set-Detail-Calls abgleichen. Trifft alle Cardmarket-Kürzel zuverlässig. Anzahl der Set-Calls = Anzahl unique Sets in den localId-Ergebnissen.

**Pass 3** – Fallback: Alle Karten mit dieser Nummer zurückgeben, User kann auswählen.

**Wichtig:** TCGdex `?localId=1` macht Substring-Match und liefert auch 10, 11, 100 usw. → Exakter Zahlenvergleich via `parseInt` nach dem API-Call nötig.

## Preisverlauf-Chart

TCGdex speichert keine historischen Preise. Der Chart in `PriceChart.jsx` nutzt die vier Cardmarket-Durchschnittspunkte als Zeitachse:

```
avg30  →  avg7  →  avg1  →  Trend (Referenzlinie)
(vor 30T)  (vor 7T)  (gestern)
```

Daten kommen aus `priceChartData()` in `tcgdex.js`. Wenn weniger als 2 Punkte vorhanden sind, zeigt der Chart eine Meldung statt leerer Grafik.

## Design-System

Dark Theme, Pokemon-Farbpalette via Tailwind Custom Properties in `index.css`:
- `--color-poke-red: #cc0000`
- `--color-poke-yellow: #ffcb05`
- `--color-surface / surface-2 / surface-3`: Geschachtelte Hintergrundflächen
- `--color-border: #2a2a4a`

Klassen: `fade-in` (Einblend-Animation), `card-shine` (Glanz-Effekt auf Kacheln), `price-up/down/neutral` (Preisrichtung-Farben).
