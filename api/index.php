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

function load_api_key(): string
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
        if (is_array($config) && !empty($config['TMDB_API_KEY'])) {
            return (string) $config['TMDB_API_KEY'];
        }
    }

    return '';
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

    $data = tmdb_fetch($apiKey, '/search/tv', [
        'query' => $q,
        'include_adult' => 'false',
        'language' => 'en-US',
    ]);

    $results = [];
    foreach ($data['results'] ?? [] as $show) {
        $firstAir = $show['first_air_date'] ?? null;
        $poster = $show['poster_path'] ?? null;
        $results[] = [
            'id' => $show['id'],
            'name' => $show['name'],
            'firstAirDate' => $firstAir,
            'year' => $firstAir ? substr((string) $firstAir, 0, 4) : null,
            'overview' => $show['overview'] ?? '',
            'posterUrl' => $poster ? IMAGE_BASE . '/w185' . $poster : null,
        ];
    }

    send_json(200, ['results' => $results]);
}

function handle_show_providers(string $apiKey, string $id): void
{
    if (!preg_match('/^\d+$/', $id)) {
        send_json(400, ['error' => 'Invalid show id']);
    }

    $details = tmdb_fetch($apiKey, "/tv/{$id}", ['language' => 'en-US']);
    $providersPayload = tmdb_fetch($apiKey, "/tv/{$id}/watch/providers");

    $us = $providersPayload['results']['US'] ?? null;
    $firstAir = $details['first_air_date'] ?? null;
    $poster = $details['poster_path'] ?? null;

    send_json(200, [
        'id' => $details['id'],
        'name' => $details['name'],
        'firstAirDate' => $firstAir,
        'year' => $firstAir ? substr((string) $firstAir, 0, 4) : null,
        'overview' => $details['overview'] ?? '',
        'posterUrl' => $poster ? IMAGE_BASE . '/w342' . $poster : null,
        'tmdbUrl' => $us['link'] ?? ('https://www.themoviedb.org/tv/' . $details['id']),
        'providers' => [
            'flatrate' => map_provider_list($us['flatrate'] ?? null),
            'ads' => map_provider_list($us['ads'] ?? null),
            'free' => map_provider_list($us['free'] ?? null),
            'rent' => map_provider_list($us['rent'] ?? null),
            'buy' => map_provider_list($us['buy'] ?? null),
        ],
    ]);
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        send_json(405, ['error' => 'Method not allowed']);
    }

    $apiKey = load_api_key();
    if ($apiKey === '') {
        send_json(500, [
            'error' => 'TMDB_API_KEY is not configured. Add tmdb-config.php on the server.',
        ]);
    }

    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $path = rawurldecode($path);

    if ($path === '/api/search') {
        handle_search($apiKey);
    }

    if (preg_match('#^/api/show/([^/]+)/providers$#', $path, $matches)) {
        handle_show_providers($apiKey, $matches[1]);
    }

    send_json(404, ['error' => 'Not found']);
} catch (Throwable $error) {
    send_json(502, ['error' => $error->getMessage()]);
}
