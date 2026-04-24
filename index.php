<?php

// TokenTracker PHP ingest — served via Laravel Valet or any PHP server
// Endpoints:
//   POST /v1/traces
//   POST /v1/logs
//   GET  /healthz

require_once __DIR__ . '/ingest/OtlpParser.php';
require_once __DIR__ . '/ingest/Ingest.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';

if ($method === 'GET' && $uri === '/healthz') {
    echo json_encode(['ok' => true]);
    exit;
}

// Session metadata from Claude Code hooks
if ($method === 'POST' && $uri === '/v1/session-meta') {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        http_response_code(400);
        echo json_encode(['error' => 'empty body']);
        exit;
    }
    try {
        $data = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException $e) {
        http_response_code(400);
        echo json_encode(['error' => 'invalid json']);
        exit;
    }

    $sid = $data['session_id'] ?? '';
    if ($sid === '') {
        http_response_code(400);
        echo json_encode(['error' => 'missing session_id']);
        exit;
    }

    try {
        $pdo = Db::get();

        $stmt = $pdo->prepare(
            'INSERT INTO sessions (session_id, project_name, cwd, git_branch)
             VALUES (:sid, :project, :cwd, :branch)
             ON DUPLICATE KEY UPDATE
               project_name = COALESCE(VALUES(project_name), project_name),
               cwd = COALESCE(VALUES(cwd), cwd),
               git_branch = COALESCE(VALUES(git_branch), git_branch),
               last_seen = NOW()'
        );
        $stmt->execute([
            ':sid' => $sid,
            ':project' => $data['project_name'] ?? null,
            ':cwd' => $data['cwd'] ?? null,
            ':branch' => $data['git_branch'] ?? null,
        ]);

        $event = $data['event_type'] ?? 'unknown';
        $snap = $pdo->prepare(
            'INSERT INTO session_snapshots
               (session_id, cwd, git_branch, project_name, event_type, raw_payload)
             VALUES (:sid, :cwd, :branch, :project, :event, :raw)'
        );
        $snap->execute([
            ':sid' => $sid,
            ':cwd' => $data['cwd'] ?? null,
            ':branch' => $data['git_branch'] ?? null,
            ':project' => $data['project_name'] ?? null,
            ':event' => $event,
            ':raw' => json_encode($data),
        ]);

        if ($event === 'SessionEnd') {
            $pdo->prepare('UPDATE sessions SET is_active = 0, last_seen = NOW() WHERE session_id = :sid')
                ->execute([':sid' => $sid]);
        }

        error_log("TokenTracker: session-meta {$event} for {$sid}");
        echo json_encode(['ok' => true]);
    } catch (Throwable $t) {
        error_log('TokenTracker session-meta error: ' . $t->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'failed', 'detail' => $t->getMessage()]);
    }
    exit;
}

if ($method !== 'POST' || ($uri !== '/v1/traces' && $uri !== '/v1/logs')) {
    http_response_code(404);
    echo json_encode(['error' => 'not found', 'uri' => $uri]);
    exit;
}

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'protobuf') !== false) {
    http_response_code(415);
    echo json_encode(['error' => 'protobuf not supported — set encoding: json on collector']);
    exit;
}

$raw = file_get_contents('php://input');
if ($raw === false || $raw === '') {
    http_response_code(400);
    echo json_encode(['error' => 'empty body']);
    exit;
}

try {
    $payload = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
} catch (JsonException $e) {
    http_response_code(400);
    echo json_encode(['error' => 'invalid json', 'detail' => $e->getMessage()]);
    exit;
}

try {
    $events = $uri === '/v1/traces'
        ? OtlpParser::parseTraces($payload)
        : OtlpParser::parseLogs($payload);

    $accepted = Ingest::store($events);
    error_log("TokenTracker: ingested {$accepted} events from {$uri}");
    echo json_encode(['accepted' => $accepted]);
} catch (Throwable $t) {
    error_log('TokenTracker ingest error: ' . $t->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'ingest failed', 'detail' => $t->getMessage()]);
}
