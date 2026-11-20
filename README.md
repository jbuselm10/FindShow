# FindShow

Find which streaming service a TV show or movie is on (US). Documentaries indexed as movies are included in search.

## What you can do

- Site nav on every page: **Home**, **Currently Watching**, **Movies and Shows to watch**.
- **Home** has two entry boxes: **Find a Show or Movie**, then **Enter email** with optional **First name**.
- **Currently Watching** — TV shows with the streaming services you pick.
- **Movies and Shows to watch** — movies and TV titles you want to watch later.
- From search, **Add to list** prompts for email (and optional first name) if needed.
- Saves default to **Private**. Choose **Public** when saving so others can find that title under **Search Other Shows** on Home (by email/name, or **Search all**).
- Lists are tied to your email with **no password** in v1. From a list page you can **Remove email & lists** (with confirmation) to permanently delete that email’s saved data.
- Floating **Site help** answers questions from indexed public site content using OpenAI (not live title lookups).

## Setup

1. Get a free API key from [TMDB](https://www.themoviedb.org/settings/api).
2. Get an [OpenAI API key](https://platform.openai.com/api-keys) (billing required for Chat Completions).
3. Copy `.env.example` to `.env` and set your keys:

```bash
cp .env.example .env
```

```bash
TMDB_API_KEY=...
OPENAI_API_KEY=...
# optional
OPENAI_MODEL=gpt-4o-mini
```

4. Install and run:

```bash
npm install
npm run dev
```

`predev` / `prebuild` generate `api/site-knowledge.json` from site text. You can also run `npm run build:knowledge` manually. That file is gitignored and created during deploy builds.

Local watch lists are stored in `data/lists.json` (gitignored) — a plain JSON file, no database.

Streaming availability is powered by JustWatch via TMDB.

## Production (GreenGeeks)

Deploy already copies `api/` into `dist/api/` (including the generated knowledge index).

Add credentials next to your TMDB key in `tmdb-config.php` (account home) or `api/config.local.php` on the server:

```php
return [
  'TMDB_API_KEY' => '...',
  'OPENAI_API_KEY' => '...',
  'OPENAI_MODEL' => 'gpt-4o-mini', // optional
  // Absolute path outside the web root; directory must be writable
  'LIST_DATA_PATH' => '/home/USERNAME/findshow-lists.json',
];
```

No SQLite extension is required. Create the parent directory if needed and ensure PHP can write the JSON file.

### API notes

- Chat: `POST /api/chat` with `{ "messages": [{ "role": "user"|"assistant", "content": "..." }] }`.
- Lists: `POST /api/lists/load`, `/api/lists/watching`, `/api/lists/to-watch` with an `email` field (see app client).
