<?php
declare(strict_types=1);

const LISTS_MAX_ITEMS = 50;

function load_list_data_path(): string
{
    $config = load_config();
    if (!empty($config['LIST_DATA_PATH'])) {
        return (string) $config['LIST_DATA_PATH'];
    }
    if (!empty($config['LIST_DB_PATH'])) {
        $legacy = (string) $config['LIST_DB_PATH'];
        if (str_ends_with(strtolower($legacy), '.json')) {
            return $legacy;
        }
        return preg_replace('/\.sqlite$/i', '.json', $legacy) ?: ($legacy . '.json');
    }

    $home = getenv('HOME') ?: ($_SERVER['HOME'] ?? '');
    if (is_string($home) && $home !== '') {
        return $home . '/findshow-lists.json';
    }

    return dirname(__DIR__, 2) . '/findshow-lists.json';
}

function lists_normalize_email(mixed $email): string|null
{
    if (!is_string($email)) {
        return null;
    }
    $normalized = strtolower(trim($email));
    if ($normalized === '' || !filter_var($normalized, FILTER_VALIDATE_EMAIL)) {
        return null;
    }
    if (strlen($normalized) > 254) {
        return null;
    }
    return $normalized;
}

function lists_read_json_body(): array
{
    $rawBody = file_get_contents('php://input');
    if ($rawBody === false || strlen($rawBody) > 65536) {
        send_json(400, ['error' => 'Request body too large or unreadable']);
    }
    $body = json_decode($rawBody, true);
    if (!is_array($body)) {
        send_json(400, ['error' => 'Invalid JSON']);
    }
    return $body;
}

function lists_provider_list(mixed $raw): array
{
    if (!is_array($raw)) {
        return [];
    }
    $out = [];
    $seen = [];
    foreach ($raw as $item) {
        if (!is_array($item)) {
            continue;
        }
        $id = isset($item['id']) ? (int) $item['id'] : 0;
        $name = isset($item['name']) && is_string($item['name']) ? trim($item['name']) : '';
        if ($id <= 0 || $name === '' || isset($seen[$id])) {
            continue;
        }
        $seen[$id] = true;
        $logoUrl = null;
        if (isset($item['logoUrl']) && is_string($item['logoUrl']) && $item['logoUrl'] !== '') {
            $logoUrl = $item['logoUrl'];
        }
        $out[] = [
            'id' => $id,
            'name' => $name,
            'logoUrl' => $logoUrl,
            'displayPriority' => isset($item['displayPriority']) ? (int) $item['displayPriority'] : 0,
        ];
    }
    return $out;
}

/** @return array{users: array<string, mixed>} */
function lists_empty_store(): array
{
    return ['users' => []];
}

/** @return array{users: array<string, mixed>} */
function lists_decode_store(string $raw): array
{
    if ($raw === '') {
        return lists_empty_store();
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return lists_empty_store();
    }
    $users = $data['users'] ?? [];
    if (!is_array($users)) {
        $users = [];
    }
    return ['users' => $users];
}

/** @return array{0: resource, 1: array{users: array<string, mixed>}} */
function lists_open_store(): array
{
    $path = load_list_data_path();
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        throw new RuntimeException('Unable to create list data directory.');
    }

    $handle = fopen($path, 'c+');
    if ($handle === false) {
        throw new RuntimeException('Unable to open list data file.');
    }

    if (!flock($handle, LOCK_EX)) {
        fclose($handle);
        throw new RuntimeException('Unable to lock list data file.');
    }

    rewind($handle);
    $raw = stream_get_contents($handle);
    if ($raw === false) {
        flock($handle, LOCK_UN);
        fclose($handle);
        throw new RuntimeException('Unable to read list data file.');
    }

    return [$handle, lists_decode_store($raw)];
}

/** @param resource $handle */
function lists_write_store($handle, array $store): void
{
    $json = json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('Unable to encode list data.');
    }
    rewind($handle);
    if (!ftruncate($handle, 0)) {
        throw new RuntimeException('Unable to truncate list data file.');
    }
    if (fwrite($handle, $json . "\n") === false) {
        throw new RuntimeException('Unable to write list data file.');
    }
    fflush($handle);
}

/** @param resource $handle */
function lists_close_store($handle): void
{
    flock($handle, LOCK_UN);
    fclose($handle);
}

function lists_sort_by_updated(array $items): array
{
    usort($items, static function (array $a, array $b): int {
        return strcmp((string) ($b['updatedAt'] ?? ''), (string) ($a['updatedAt'] ?? ''));
    });
    return array_values($items);
}

/** @param array{users: array<string, mixed>} $store */
function lists_normalize_first_name(mixed $firstName): string|null
{
    if ($firstName === null) {
        return null;
    }
    if (!is_string($firstName)) {
        return null;
    }
    $trimmed = trim($firstName);
    if ($trimmed === '') {
        return '';
    }
    if (strlen($trimmed) > 80) {
        $trimmed = substr($trimmed, 0, 80);
    }
    return $trimmed;
}

function lists_normalize_visibility(mixed $visibility): string
{
    return $visibility === 'public' ? 'public' : 'private';
}

function lists_normalize_item_row(array $row, string $listKind): array
{
    $visibility = lists_normalize_visibility($row['visibility'] ?? 'private');
    if ($listKind === 'watching') {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'mediaType' => 'tv',
            'name' => (string) ($row['name'] ?? ''),
            'year' => isset($row['year']) && is_string($row['year']) && $row['year'] !== '' ? $row['year'] : null,
            'posterUrl' => isset($row['posterUrl']) && is_string($row['posterUrl']) && $row['posterUrl'] !== ''
                ? $row['posterUrl']
                : null,
            'selectedProviders' => lists_provider_list($row['selectedProviders'] ?? []),
            'visibility' => $visibility,
            'updatedAt' => isset($row['updatedAt']) && is_string($row['updatedAt']) ? $row['updatedAt'] : '',
        ];
    }

    $mediaType = ($row['mediaType'] ?? 'movie') === 'tv' ? 'tv' : 'movie';
    return [
        'id' => (int) ($row['id'] ?? 0),
        'mediaType' => $mediaType,
        'name' => (string) ($row['name'] ?? ''),
        'year' => isset($row['year']) && is_string($row['year']) && $row['year'] !== '' ? $row['year'] : null,
        'posterUrl' => isset($row['posterUrl']) && is_string($row['posterUrl']) && $row['posterUrl'] !== ''
            ? $row['posterUrl']
            : null,
        'selectedProviders' => lists_provider_list($row['selectedProviders'] ?? []),
        'visibility' => $visibility,
        'updatedAt' => isset($row['updatedAt']) && is_string($row['updatedAt']) ? $row['updatedAt'] : '',
    ];
}

function lists_ensure_user(array &$store, string $email): void
{
    if (!isset($store['users'][$email]) || !is_array($store['users'][$email])) {
        $store['users'][$email] = ['watching' => [], 'toWatch' => [], 'firstName' => null];
    }
    if (!isset($store['users'][$email]['watching']) || !is_array($store['users'][$email]['watching'])) {
        $store['users'][$email]['watching'] = [];
    }
    if (!isset($store['users'][$email]['toWatch']) || !is_array($store['users'][$email]['toWatch'])) {
        $store['users'][$email]['toWatch'] = [];
    }
    if (!array_key_exists('firstName', $store['users'][$email])) {
        $store['users'][$email]['firstName'] = null;
    }
}

/** @param array{users: array<string, mixed>} $store */
function lists_payload(array $store, string $email): array
{
    lists_ensure_user($store, $email);
    $bucket = $store['users'][$email];
    $firstName = $bucket['firstName'] ?? null;
    if (!is_string($firstName) || trim($firstName) === '') {
        $firstName = null;
    }
    $watching = [];
    foreach ($bucket['watching'] as $row) {
        if (!is_array($row)) {
            continue;
        }
        $normalized = lists_normalize_item_row($row, 'watching');
        if ($normalized['id'] > 0 && $normalized['name'] !== '') {
            $watching[] = $normalized;
        }
    }
    $toWatch = [];
    foreach ($bucket['toWatch'] as $row) {
        if (!is_array($row)) {
            continue;
        }
        $normalized = lists_normalize_item_row($row, 'toWatch');
        if ($normalized['id'] > 0 && $normalized['name'] !== '') {
            $toWatch[] = $normalized;
        }
    }

    return [
        'watching' => lists_sort_by_updated($watching),
        'toWatch' => lists_sort_by_updated($toWatch),
        'firstName' => $firstName,
    ];
}

function lists_fetch_all(string $email): array
{
    [$handle, $store] = lists_open_store();
    try {
        return lists_payload($store, $email);
    } finally {
        lists_close_store($handle);
    }
}

function handle_lists_load(): void
{
    $body = lists_read_json_body();
    $email = lists_normalize_email($body['email'] ?? null);
    if ($email === null) {
        send_json(400, ['error' => 'Valid email is required']);
    }

    $firstName = lists_normalize_first_name($body['firstName'] ?? null);
    if ($firstName === null && array_key_exists('firstName', $body) && $body['firstName'] !== null && !is_string($body['firstName'])) {
        send_json(400, ['error' => 'firstName must be a string']);
    }

    [$handle, $store] = lists_open_store();
    try {
        lists_ensure_user($store, $email);
        if ($firstName !== null) {
            $store['users'][$email]['firstName'] = $firstName === '' ? null : $firstName;
            lists_write_store($handle, $store);
        }
        $payload = lists_payload($store, $email);
    } finally {
        lists_close_store($handle);
    }

    send_json(200, $payload);
}

function handle_lists_watching(): void
{
    $body = lists_read_json_body();
    $email = lists_normalize_email($body['email'] ?? null);
    if ($email === null) {
        send_json(400, ['error' => 'Valid email is required']);
    }

    $action = $body['action'] ?? null;
    if ($action !== 'add' && $action !== 'remove') {
        send_json(400, ['error' => 'action must be add or remove']);
    }

    $item = $body['item'] ?? null;
    if (!is_array($item) || !isset($item['id'])) {
        send_json(400, ['error' => 'item.id is required']);
    }
    $id = (int) $item['id'];
    if ($id <= 0) {
        send_json(400, ['error' => 'Invalid item id']);
    }

    $status = 200;
    $payload = null;
    $error = null;

    [$handle, $store] = lists_open_store();
    try {
        lists_ensure_user($store, $email);
        /** @var array{watching: array, toWatch: array} $bucket */
        $bucket =& $store['users'][$email];

        if ($action === 'remove') {
            $bucket['watching'] = array_values(array_filter(
                $bucket['watching'],
                static fn($row): bool => !is_array($row) || (int) ($row['id'] ?? 0) !== $id
            ));
            lists_write_store($handle, $store);
            $payload = lists_payload($store, $email);
        } else {
            $name = isset($item['name']) && is_string($item['name']) ? trim($item['name']) : '';
            if ($name === '') {
                $status = 400;
                $error = ['error' => 'item.name is required'];
            } else {
                $providers = lists_provider_list($item['providers'] ?? []);
                if ($providers === []) {
                    $status = 400;
                    $error = ['error' => 'Select at least one streaming service'];
                } else {
                    $exists = false;
                    foreach ($bucket['watching'] as $row) {
                        if (is_array($row) && (int) ($row['id'] ?? 0) === $id) {
                            $exists = true;
                            break;
                        }
                    }
                    if (!$exists && count($bucket['watching']) >= LISTS_MAX_ITEMS) {
                        $status = 400;
                        $error = ['error' => 'Currently watching list is full (max ' . LISTS_MAX_ITEMS . ')'];
                    } else {
                        $year = isset($item['year']) && is_string($item['year']) && $item['year'] !== ''
                            ? $item['year']
                            : null;
                        $posterUrl = isset($item['posterUrl']) && is_string($item['posterUrl']) && $item['posterUrl'] !== ''
                            ? $item['posterUrl']
                            : null;
                        $entry = [
                            'id' => $id,
                            'mediaType' => 'tv',
                            'name' => $name,
                            'year' => $year,
                            'posterUrl' => $posterUrl,
                            'selectedProviders' => $providers,
                            'visibility' => lists_normalize_visibility($item['visibility'] ?? 'private'),
                            'updatedAt' => gmdate('c'),
                        ];
                        $next = [];
                        foreach ($bucket['watching'] as $row) {
                            if (!is_array($row) || (int) ($row['id'] ?? 0) === $id) {
                                continue;
                            }
                            $next[] = $row;
                        }
                        $next[] = $entry;
                        $bucket['watching'] = $next;
                        lists_write_store($handle, $store);
                        $payload = lists_payload($store, $email);
                    }
                }
            }
        }
    } finally {
        lists_close_store($handle);
    }

    if ($error !== null) {
        send_json($status, $error);
    }
    send_json(200, $payload ?? ['watching' => [], 'toWatch' => [], 'firstName' => null]);
}

function handle_lists_to_watch(): void
{
    $body = lists_read_json_body();
    $email = lists_normalize_email($body['email'] ?? null);
    if ($email === null) {
        send_json(400, ['error' => 'Valid email is required']);
    }

    $action = $body['action'] ?? null;
    if ($action !== 'add' && $action !== 'remove') {
        send_json(400, ['error' => 'action must be add or remove']);
    }

    $item = $body['item'] ?? null;
    if (!is_array($item) || !isset($item['id'])) {
        send_json(400, ['error' => 'item.id is required']);
    }
    $id = (int) $item['id'];
    if ($id <= 0) {
        send_json(400, ['error' => 'Invalid item id']);
    }

    $status = 200;
    $payload = null;
    $error = null;

    [$handle, $store] = lists_open_store();
    try {
        lists_ensure_user($store, $email);
        /** @var array{watching: array, toWatch: array} $bucket */
        $bucket =& $store['users'][$email];

        $mediaType = isset($item['mediaType']) && $item['mediaType'] === 'tv' ? 'tv' : 'movie';
        if (
            isset($item['mediaType'])
            && $item['mediaType'] !== 'tv'
            && $item['mediaType'] !== 'movie'
        ) {
            $status = 400;
            $error = ['error' => 'item.mediaType must be movie or tv'];
        } elseif ($action === 'remove') {
            $bucket['toWatch'] = array_values(array_filter(
                $bucket['toWatch'],
                static function ($row) use ($id, $mediaType): bool {
                    if (!is_array($row)) {
                        return false;
                    }
                    $rowType = ($row['mediaType'] ?? 'movie') === 'tv' ? 'tv' : 'movie';
                    return !((int) ($row['id'] ?? 0) === $id && $rowType === $mediaType);
                }
            ));
            lists_write_store($handle, $store);
            $payload = lists_payload($store, $email);
        } else {
            $name = isset($item['name']) && is_string($item['name']) ? trim($item['name']) : '';
            if ($name === '') {
                $status = 400;
                $error = ['error' => 'item.name is required'];
            } else {
                $exists = false;
                foreach ($bucket['toWatch'] as $row) {
                    if (!is_array($row)) {
                        continue;
                    }
                    $rowType = ($row['mediaType'] ?? 'movie') === 'tv' ? 'tv' : 'movie';
                    if ((int) ($row['id'] ?? 0) === $id && $rowType === $mediaType) {
                        $exists = true;
                        break;
                    }
                }
                if (!$exists && count($bucket['toWatch']) >= LISTS_MAX_ITEMS) {
                    $status = 400;
                    $error = ['error' => 'To watch list is full (max ' . LISTS_MAX_ITEMS . ')'];
                } else {
                    $year = isset($item['year']) && is_string($item['year']) && $item['year'] !== ''
                        ? $item['year']
                        : null;
                    $posterUrl = isset($item['posterUrl']) && is_string($item['posterUrl']) && $item['posterUrl'] !== ''
                        ? $item['posterUrl']
                        : null;
                    $entry = [
                        'id' => $id,
                        'mediaType' => $mediaType,
                        'name' => $name,
                        'year' => $year,
                        'posterUrl' => $posterUrl,
                        'selectedProviders' => lists_provider_list($item['providers'] ?? []),
                        'visibility' => lists_normalize_visibility($item['visibility'] ?? 'private'),
                        'updatedAt' => gmdate('c'),
                    ];
                    $next = [];
                    foreach ($bucket['toWatch'] as $row) {
                        if (!is_array($row)) {
                            continue;
                        }
                        $rowType = ($row['mediaType'] ?? 'movie') === 'tv' ? 'tv' : 'movie';
                        if ((int) ($row['id'] ?? 0) === $id && $rowType === $mediaType) {
                            continue;
                        }
                        $next[] = $row;
                    }
                    $next[] = $entry;
                    $bucket['toWatch'] = $next;
                    lists_write_store($handle, $store);
                    $payload = lists_payload($store, $email);
                }
            }
        }
    } finally {
        lists_close_store($handle);
    }

    if ($error !== null) {
        send_json($status, $error);
    }
    send_json(200, $payload ?? ['watching' => [], 'toWatch' => [], 'firstName' => null]);
}

function handle_lists_delete(): void
{
    $body = lists_read_json_body();
    $email = lists_normalize_email($body['email'] ?? null);
    if ($email === null) {
        send_json(400, ['error' => 'Valid email is required']);
    }

    [$handle, $store] = lists_open_store();
    try {
        if (isset($store['users'][$email])) {
            unset($store['users'][$email]);
            lists_write_store($handle, $store);
        }
    } finally {
        lists_close_store($handle);
    }

    send_json(200, ['ok' => true]);
}

function handle_lists_public_search(): void
{
    $body = lists_read_json_body();
    $query = isset($body['query']) && is_string($body['query']) ? trim($body['query']) : '';
    if ($query === '' || strlen($query) > 254) {
        send_json(400, ['error' => 'Enter an email or first name to search']);
    }

    $queryLower = strtolower($query);
    [$handle, $store] = lists_open_store();
    try {
        $results = [];
        foreach ($store['users'] as $email => $bucket) {
            if (!is_string($email) || !is_array($bucket)) {
                continue;
            }
            $firstName = isset($bucket['firstName']) && is_string($bucket['firstName'])
                ? trim($bucket['firstName'])
                : '';
            $emailMatch = strtolower($email) === $queryLower;
            $nameMatch = $firstName !== '' && str_contains(strtolower($firstName), $queryLower);
            if (!$emailMatch && !$nameMatch) {
                continue;
            }

            $payload = lists_payload(['users' => [$email => $bucket]], $email);
            $publicWatching = array_values(array_filter(
                $payload['watching'],
                static fn(array $row): bool => ($row['visibility'] ?? 'private') === 'public'
            ));
            $publicToWatch = array_values(array_filter(
                $payload['toWatch'],
                static fn(array $row): bool => ($row['visibility'] ?? 'private') === 'public'
            ));
            if ($publicWatching === [] && $publicToWatch === []) {
                continue;
            }

            $results[] = [
                'email' => $email,
                'firstName' => $firstName !== '' ? $firstName : null,
                'watching' => $publicWatching,
                'toWatch' => $publicToWatch,
            ];
            if (count($results) >= 20) {
                break;
            }
        }
    } finally {
        lists_close_store($handle);
    }

    send_json(200, ['results' => $results]);
}
