# FindShow

Find which streaming service a TV show or movie is on (US), with a previously viewed list. Documentaries indexed as movies are included in search.

The floating **Site help** chat answers questions from indexed public site content (README + UI copy) using OpenAI. It does not look up live streaming availability for arbitrary titles.

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

Streaming availability is powered by JustWatch via TMDB.

## Production (GreenGeeks)

Deploy already copies `api/` into `dist/api/` (including the generated knowledge index).

Add OpenAI credentials next to your TMDB key in `tmdb-config.php` (account home) or `api/config.local.php` on the server:

```php
return [
  'TMDB_API_KEY' => '...',
  'OPENAI_API_KEY' => '...',
  'OPENAI_MODEL' => 'gpt-4o-mini', // optional
];
```

The chat endpoint is `POST /api/chat` with JSON body `{ "messages": [{ "role": "user"|"assistant", "content": "..." }] }`.
