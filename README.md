# FindShow

Find which streaming service a TV show or movie is on (US), with a previously viewed list. Documentaries indexed as movies are included in search.

## Setup

1. Get a free API key from [TMDB](https://www.themoviedb.org/settings/api).
2. Copy `.env.example` to `.env` and set your key:

```bash
cp .env.example .env
```

3. Install and run:

```bash
npm install
npm run dev
```

Streaming availability is powered by JustWatch via TMDB.
