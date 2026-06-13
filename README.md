# Pokéfolio

Schlanker, self-hosted Pokémon-TCG-Portfolio-Manager. Sammlung, Sets, Binder,
Wishlist und Cardmarket-Preise — gestützt auf [TCGdex](https://tcgdex.dev/),
mit voller Unterstützung für **Custom Cards**, die TCGdex nicht kennt (z.B.
Promos wie `sv2a 183` Mewtwo V2).

Komplette Neufassung. Statt der früheren Python/FastAPI/PostgreSQL-Basis
nutzt diese Version:

- **Next.js 14 (App Router) + TypeScript**
- **Prisma + SQLite** (Datei-DB, kein Docker nötig)
- **Tailwind + Pokémon-Energy-Theme** (Holo-Shimmer auf Hover, Type-Farben)

## Quick Start

```bash
cd pokefolio
npm install
npm run db:push      # Prisma → SQLite (./dev.db)
npm run dev          # http://localhost:3000
```

Beim ersten Start:
1. `/sets` → „Sets synchronisieren" (TCGdex-Sets + Bilder, ~25 s)
2. `/settings` → „Cardmarket Bulk-Daten holen" (~70 k Produkte + Preise, ~5 s)
3. `/search` → Karten suchen, hinzufügen, im Detail mit „Cardmarket-Produkt verknüpfen" einen Bulk-Preis zuweisen.

## Features

- **Dashboard** mit Portfolio-Wert, P&L vs. Einkaufswert, Karten-Count.
- **Suche** über lokale DB + live TCGdex-Fallback.
- **Sammlung** mit Variante, Zustand, Sprache, EK-Preis.
- **Sets**: alle Erweiterungen, Karten lazy gezogen.
- **Binder**: virtuelle 3×3 / 2×2 / 3×4 Albums in 5 Theme-Farben.
- **Wishlist** mit Max-Preis-Markierung.
- **Custom Cards** für Promos & Sonderkarten:
  - Cardmarket-URL einfügen → Set-Code & Nummer werden automatisch erkannt
  - Manueller Preis, optionales Bild, Notizen
  - überall im Portfolio gleichberechtigt mit TCGdex-Karten

## Custom Card anlegen (Beispiel)

`sv2a 183` Mewtwo V2 ist ein Promo, das nicht in TCGdex steht. So gehst du vor:

1. `/cards/new` öffnen.
2. Cardmarket-URL einfügen:
   `https://www.cardmarket.com/de/Pokemon/Products/Singles/Pokemon-Card-151/Mewtwo-V2-sv2a183`
3. Set-Code (`sv2a`), Nummer (`183`) und Name (`Mewtwo V2`) werden vorausgefüllt.
4. Manuellen Preis (z.B. `39.90`) eintragen.
5. Speichern — die Karte erscheint in Suche, Sammlung, Binder, Wishlist mit
   einem dezenten `custom`-Marker.

## Stack

| Schicht | Technologie |
|---------|-------------|
| Frontend & API | Next.js 14, React 18, TanStack Query |
| Datenbank | Prisma + SQLite (`./dev.db`) — optional auf Postgres umstellbar |
| Kartendaten | TCGdex `api.tcgdex.net/v2` (Bilder, Sets, Metadaten, TCGplayer-USD) |
| Preise EUR | Cardmarket Bulk-Drops `downloads.s3.cardmarket.com` (Katalog + Price-Guide, ~28 MB / Tag) |
| Styling | Tailwind v3, eigenes Pokémon-Energy-Theme |

## Skripte

```bash
npm run dev        # Dev-Server (Hot Reload)
npm run build      # Produktions-Build
npm run start      # Produktions-Server
npm run db:push    # Schema → SQLite synchronisieren
npm run db:studio  # Prisma Studio im Browser
```

## Konfiguration

`.env.example` zeigt alle Variablen:

```env
DATABASE_URL="file:./dev.db"
TCGDEX_BASE_URL="https://api.tcgdex.net/v2"
TCGDEX_LANG="de"
DEFAULT_CURRENCY="EUR"
```

Auf Postgres umsteigen? In `prisma/schema.prisma` `provider` auf `postgresql`
ändern, `DATABASE_URL` setzen, `npm run db:push`.

## Docker / Unraid

Die App läuft als einzelner Container mit zwei persistenten Volumes
(`/app/data` für die SQLite-DB, `/app/public/uploads` für eigene Bilder).

```bash
# lokales Build + Start
docker compose up -d --build
# erreichbar auf http://localhost:3000
```

Beim ersten Start wendet das Entrypoint-Script `prisma db push` an, legt
also automatisch das Schema in `/app/data/pokefolio.db` an. Schema-Updates
beim Container-Upgrade laufen genauso (idempotent, additiv — destruktive
Änderungen werden bewusst verweigert).

**Unraid:** das Template liegt in [`docker/pokefolio.xml`](./docker/pokefolio.xml).
Vorher `YOUR_GH_USER` durch den eigenen GitHub-Account ersetzen und das
Image nach `ghcr.io/<user>/pokefolio:latest` pushen. Standard-Volumes:

| Container Path        | Host Path (Default)                   | Zweck                  |
|-----------------------|---------------------------------------|------------------------|
| `/app/data`           | `/mnt/user/appdata/pokefolio/data`    | SQLite-DB              |
| `/app/public/uploads` | `/mnt/user/appdata/pokefolio/uploads` | Custom-Card-Bilder     |

Backups laufen über die UI (Einstellungen → „Backup herunterladen") oder
durch direktes Sichern von `/mnt/user/appdata/pokefolio/data/pokefolio.db`.

## Was bewusst draußen ist

Aus dem alten Projekt verzichten wir hier auf Multi-User, Gemini-Scanner,
Telegram-Alerts, Achievements, i18n, Sealed-Product-Tracking. Falls etwas davon
zurück soll, ist das Schema flexibel genug — einfach Bescheid sagen.

## Lizenz

GNU AGPLv3.
