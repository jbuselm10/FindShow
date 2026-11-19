<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';

function send_json(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

function request_path(): string
{
    if (isset($_GET['__route']) && is_string($_GET['__route'])) {
        $route = trim(rawurldecode($_GET['__route']), '/');
        if ($route !== '') {
            return '/api/' . $route;
        }
    }

    $uri = $_SERVER['REDIRECT_URL'] ?? $_SERVER['REQUEST_URI'] ?? '/';
    $path = parse_url($uri, PHP_URL_PATH) ?: '/';
    $path = rawurldecode($path);
    $path = rtrim($path, '/') ?: '/';

    if (preg_match(
        '#(/api/(?:chat|search|lists/(?:load|watching|to-watch|public-search|delete)|title/(?:movie|tv)/[^/]+/providers|show/[^/]+/providers))$#',
        $path,
        $matches
    )) {
        return $matches[1];
    }

    return $path;
}

require_once __DIR__ . '/lists.php';

function load_config(): array
{
    $candidates = [
        __DIR__ . '/config.local.php',
        dirname(__DIR__, 3) . '/tmdb-config.php',
        dirname(__DIR__, 2) . '/tmdb-config.php',
        (getenv('HOME') ?: ($_SERVER['HOME'] ?? '')) . '/tmdb-config.php',
    ];

    foreach ($candidates as $path) {
        if ($path === '/tmdb-config.php' || $path === '') {
            continue;
        }
        if (!is_readable($path)) {
            continue;
        }
        $config = require $path;
        if (is_array($config)) {
            return $config;
        }
    }

    return [];
}

function load_api_key(): string
{
    $config = load_config();
    return !empty($config['TMDB_API_KEY']) ? (string) $config['TMDB_API_KEY'] : '';
}

function load_openai_key(): string
{
    $config = load_config();
    return !empty($config['OPENAI_API_KEY']) ? (string) $config['OPENAI_API_KEY'] : '';
}

function load_openai_model(): string
{
    $config = load_config();
    if (!empty($config['OPENAI_MODEL'])) {
        return (string) $config['OPENAI_MODEL'];
    }
    return 'gpt-4o-mini';
}

function tmdb_fetch(string $apiKey, string $path, array $params = []): array
{
    $query = array_merge(['api_key' => $apiKey], $params);
    $url = TMDB_BASE . $path . '?' . http_build_query($query);

    $ch = curl_init($url);
    if ($ch === false) {
        throw new RuntimeException('Unable to initialize HTTP client');
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_FOLLOWLOCATION => true,
    ]);

    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        throw new RuntimeException($error !== '' ? $error : 'TMDB request failed');
    }

    if ($status < 200 || $status >= 300) {
        throw new RuntimeException("TMDB {$status}: {$raw}");
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        throw new RuntimeException('Invalid TMDB response');
    }

    return $data;
}

function map_provider(array $provider): array
{
    $logoPath = $provider['logo_path'] ?? null;

    return [
        'id' => $provider['provider_id'],
        'name' => $provider['provider_name'],
        'logoUrl' => $logoPath ? IMAGE_BASE . '/original' . $logoPath : null,
        'displayPriority' => $provider['display_priority'] ?? 999,
    ];
}

function sort_providers(array $providers): array
{
    usort($providers, static function (array $a, array $b): int {
        return ($a['displayPriority'] ?? 999) <=> ($b['displayPriority'] ?? 999);
    });

    return $providers;
}

function map_provider_list(?array $list): array
{
    if (!$list) {
        return [];
    }

    return sort_providers(array_map('map_provider', $list));
}

function handle_search(string $apiKey): void
{
    $q = trim((string) ($_GET['q'] ?? ''));
    if ($q === '') {
        send_json(400, ['error' => 'Missing search query']);
    }

    $data = tmdb_fetch($apiKey, '/search/multi', [
        'query' => $q,
        'include_adult' => 'false',
        'language' => 'en-US',
    ]);

    $results = [];
    foreach ($data['results'] ?? [] as $item) {
        $mediaType = $item['media_type'] ?? '';
        if ($mediaType !== 'movie' && $mediaType !== 'tv') {
            continue;
        }
        if (count($results) >= 20) {
            break;
        }

        $date = $mediaType === 'movie'
            ? ($item['release_date'] ?? null)
            : ($item['first_air_date'] ?? null);
        $name = $mediaType === 'movie'
            ? (string) ($item['title'] ?? '')
            : (string) ($item['name'] ?? '');
        $poster = $item['poster_path'] ?? null;
        $results[] = [
            'id' => $item['id'],
            'mediaType' => $mediaType,
            'name' => $name,
            'firstAirDate' => $date,
            'year' => $date ? substr((string) $date, 0, 4) : null,
            'overview' => $item['overview'] ?? '',
            'posterUrl' => $poster ? IMAGE_BASE . '/w185' . $poster : null,
        ];
    }

    send_json(200, ['results' => $results]);
}

function handle_title_providers(string $apiKey, string $mediaType, string $id): void
{
    if ($mediaType !== 'movie' && $mediaType !== 'tv') {
        send_json(400, ['error' => 'Invalid media type']);
    }

    if (!preg_match('/^\d+$/', $id)) {
        send_json(400, ['error' => 'Invalid title id']);
    }

    $detailsPath = $mediaType === 'movie' ? "/movie/{$id}" : "/tv/{$id}";
    $details = tmdb_fetch($apiKey, $detailsPath, ['language' => 'en-US']);
    $providersPayload = tmdb_fetch($apiKey, "{$detailsPath}/watch/providers");

    $us = $providersPayload['results']['US'] ?? null;
    $date = $mediaType === 'movie'
        ? ($details['release_date'] ?? null)
        : ($details['first_air_date'] ?? null);
    $name = $mediaType === 'movie'
        ? (string) ($details['title'] ?? '')
        : (string) ($details['name'] ?? '');
    $poster = $details['poster_path'] ?? null;
    $tmdbPath = $mediaType === 'movie' ? 'movie' : 'tv';

    send_json(200, [
        'id' => $details['id'],
        'mediaType' => $mediaType,
        'name' => $name,
        'firstAirDate' => $date,
        'year' => $date ? substr((string) $date, 0, 4) : null,
        'overview' => $details['overview'] ?? '',
        'posterUrl' => $poster ? IMAGE_BASE . '/w342' . $poster : null,
        'tmdbUrl' => $us['link'] ?? ('https://www.themoviedb.org/' . $tmdbPath . '/' . $details['id']),
        'providers' => [
            'flatrate' => map_provider_list($us['flatrate'] ?? null),
            'ads' => map_provider_list($us['ads'] ?? null),
            'free' => map_provider_list($us['free'] ?? null),
            'rent' => map_provider_list($us['rent'] ?? null),
            'buy' => map_provider_list($us['buy'] ?? null),
        ],
    ]);
}

const CHAT_MAX_MESSAGES = 20;
const CHAT_MAX_CONTENT = 2000;
const CHAT_TOP_CHUNKS = 8;

function chat_tokenize(string $text): array
{
    $text = strtolower($text);
    $text = preg_replace('/[^a-z0-9\s]/', ' ', $text) ?? '';
    $parts = preg_split('/\s+/', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    return array_values(array_filter($parts, static fn(string $w): bool => strlen($w) > 2));
}

function chat_score_chunk(array $tokens, string $chunkText): int
{
    if ($tokens === []) {
        return 0;
    }
    $hay = strtolower($chunkText);
    $score = 0;
    foreach ($tokens as $token) {
        if (str_contains($hay, $token)) {
            $score++;
        }
    }
    return $score;
}

function chat_retrieve_chunks(array $chunks, string $query, int $topN): array
{
    if ($chunks === []) {
        return [];
    }

    $tokens = chat_tokenize($query);
    $scored = [];
    foreach ($chunks as $index => $chunk) {
        $text = (($chunk['source'] ?? '') . ' ' . ($chunk['text'] ?? ''));
        $scored[] = [
            'index' => $index,
            'chunk' => $chunk,
            'score' => chat_score_chunk($tokens, $text),
        ];
    }

    usort($scored, static fn(array $a, array $b): int => $b['score'] <=> $a['score']);

    $positive = array_values(array_filter($scored, static fn(array $s): bool => $s['score'] > 0));
    $selected = array_slice($positive !== [] ? $positive : $scored, 0, $topN);

    return array_map(static fn(array $s): array => $s['chunk'], $selected);
}

function chat_validate_messages(mixed $raw): array|string
{
    if (!is_array($raw) || !isset($raw['messages']) || !is_array($raw['messages'])) {
        return 'Missing messages';
    }

    $messages = $raw['messages'];
    if ($messages === []) {
        return 'messages must be a non-empty array';
    }
    if (count($messages) > CHAT_MAX_MESSAGES) {
        return 'At most ' . CHAT_MAX_MESSAGES . ' messages allowed';
    }

    $out = [];
    foreach ($messages as $item) {
        if (!is_array($item)) {
            return 'Invalid message';
        }
        $role = $item['role'] ?? null;
        $content = $item['content'] ?? null;
        if ($role !== 'user' && $role !== 'assistant') {
            return 'Invalid message role';
        }
        if (!is_string($content) || trim($content) === '') {
            return 'Invalid message content';
        }
        if (strlen($content) > CHAT_MAX_CONTENT) {
            return 'Each message must be at most ' . CHAT_MAX_CONTENT . ' characters';
        }
        $out[] = ['role' => $role, 'content' => trim($content)];
    }

    if (($out[count($out) - 1]['role'] ?? null) !== 'user') {
        return 'Last message must be from the user';
    }

    return $out;
}

function chat_load_knowledge(): array
{
    $path = __DIR__ . '/site-knowledge.json';
    if (!is_readable($path)) {
        throw new RuntimeException('Site knowledge index missing. Run npm run build:knowledge.');
    }
    $raw = file_get_contents($path);
    if ($raw === false) {
        throw new RuntimeException('Unable to read site knowledge index.');
    }
    $data = json_decode($raw, true);
    if (!is_array($data) || !isset($data['chunks']) || !is_array($data['chunks'])) {
        throw new RuntimeException('Invalid site knowledge index.');
    }
    return $data['chunks'];
}

function chat_build_system_prompt(array $chunks): string
{
    $parts = [];
    foreach ($chunks as $chunk) {
        $source = (string) ($chunk['source'] ?? 'unknown');
        $text = (string) ($chunk['text'] ?? '');
        $parts[] = "[{$source}]\n{$text}";
    }
    $context = $parts !== [] ? implode("\n\n---\n\n", $parts) : '(no context available)';

    return implode("\n", [
        'You are the FindShow site assistant.',
        'Answer questions using ONLY the site context below.',
        'If the answer is not in the context, say you do not know based on the site content.',
        'Do not invent streaming availability for specific titles unless it appears in the context.',
        'Keep answers concise and helpful.',
        'When relevant, briefly mention Sources using the bracketed file paths from the context.',
        '',
        'SITE CONTEXT:',
        $context,
    ]);
}

function chat_call_openai(string $apiKey, string $model, string $system, array $messages): string
{
    $payload = [
        'model' => $model,
        'temperature' => 0.3,
        'messages' => array_merge(
            [['role' => 'system', 'content' => $system]],
            $messages
        ),
    ];

    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    if ($ch === false) {
        throw new RuntimeException('Unable to initialize HTTP client');
    }

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
    ]);

    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        throw new RuntimeException($error !== '' ? $error : 'OpenAI request failed');
    }
    if ($status < 200 || $status >= 300) {
        throw new RuntimeException("OpenAI {$status}: {$raw}");
    }

    $data = json_decode($raw, true);
    $reply = trim((string) ($data['choices'][0]['message']['content'] ?? ''));
    if ($reply === '') {
        throw new RuntimeException('Empty response from OpenAI');
    }
    return $reply;
}

function handle_chat(): void
{
    $contentType = $_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? '');
    if (!str_contains(strtolower($contentType), 'application/json')) {
        send_json(415, ['error' => 'Content-Type must be application/json']);
    }

    $apiKey = load_openai_key();
    if ($apiKey === '') {
        send_json(500, [
            'error' => 'OPENAI_API_KEY is not configured. Add it to tmdb-config.php or config.local.php on the server.',
        ]);
    }

    $rawBody = file_get_contents('php://input');
    if ($rawBody === false || strlen($rawBody) > 65536) {
        send_json(400, ['error' => 'Request body too large or unreadable']);
    }

    $body = json_decode($rawBody, true);
    if (!is_array($body)) {
        send_json(400, ['error' => 'Invalid JSON']);
    }

    $messages = chat_validate_messages($body);
    if (is_string($messages)) {
        send_json(400, ['error' => $messages]);
    }

    $query = '';
    for ($i = count($messages) - 1; $i >= 0; $i--) {
        if ($messages[$i]['role'] === 'user') {
            $query = $messages[$i]['content'];
            break;
        }
    }

    $chunks = chat_load_knowledge();
    $retrieved = chat_retrieve_chunks($chunks, $query, CHAT_TOP_CHUNKS);
    $system = chat_build_system_prompt($retrieved);
    $reply = chat_call_openai($apiKey, load_openai_model(), $system, $messages);

    $sources = [];
    foreach ($retrieved as $chunk) {
        $source = (string) ($chunk['source'] ?? '');
        if ($source !== '' && !in_array($source, $sources, true)) {
            $sources[] = $source;
        }
    }

    send_json(200, ['reply' => $reply, 'sources' => $sources]);
}

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $path = request_path();

    if ($path === '/api/chat') {
        if ($method !== 'POST') {
            send_json(405, ['error' => 'Method not allowed']);
        }
        handle_chat();
    }

    if ($path === '/api/lists/load') {
        if ($method !== 'POST') {
            send_json(405, ['error' => 'Method not allowed']);
        }
        handle_lists_load();
    }

    if ($path === '/api/lists/watching') {
        if ($method !== 'POST') {
            send_json(405, ['error' => 'Method not allowed']);
        }
        handle_lists_watching();
    }

    if ($path === '/api/lists/to-watch') {
        if ($method !== 'POST') {
            send_json(405, ['error' => 'Method not allowed']);
        }
        handle_lists_to_watch();
    }

    if ($path === '/api/lists/public-search') {
        if ($method !== 'POST') {
            send_json(405, ['error' => 'Method not allowed']);
        }
        handle_lists_public_search();
    }

    if ($path === '/api/lists/delete') {
        if ($method !== 'POST') {
            send_json(405, ['error' => 'Method not allowed']);
        }
        handle_lists_delete();
    }

    if ($method !== 'GET') {
        send_json(405, ['error' => 'Method not allowed']);
    }

    $apiKey = load_api_key();
    if ($apiKey === '') {
        send_json(500, [
            'error' => 'TMDB_API_KEY is not configured. Add tmdb-config.php on the server.',
        ]);
    }

    if ($path === '/api/search') {
        handle_search($apiKey);
    }

    if (preg_match('#^/api/title/(movie|tv)/([^/]+)/providers$#', $path, $matches)) {
        handle_title_providers($apiKey, $matches[1], $matches[2]);
    }

    if (preg_match('#^/api/show/([^/]+)/providers$#', $path, $matches)) {
        handle_title_providers($apiKey, 'tv', $matches[1]);
    }

    send_json(404, ['error' => 'Not found']);
} catch (Throwable $error) {
    send_json(502, ['error' => $error->getMessage()]);
}
