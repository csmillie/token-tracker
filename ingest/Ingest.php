<?php

require_once __DIR__ . '/Db.php';

class Ingest
{
    /**
     * @param array<int,array<string,mixed>> $events
     */
    public static function store(array $events): int
    {
        if (count($events) === 0) {
            return 0;
        }
        $pdo = Db::get();

        $sessionIds = [];
        foreach ($events as $e) {
            $sessionIds[$e['session_id']] = $e['model'] ?? null;
        }

        $upsertSession = $pdo->prepare(
            'INSERT INTO sessions (session_id, model) VALUES (:sid, :model)
             ON DUPLICATE KEY UPDATE
               model = COALESCE(VALUES(model), model),
               last_seen = NOW()'
        );
        foreach ($sessionIds as $sid => $model) {
            $upsertSession->execute([':sid' => $sid, ':model' => $model]);
        }

        $insertEvent = $pdo->prepare(
            'INSERT INTO usage_events
               (session_id, model, input_tokens, output_tokens,
                cache_read_tokens, cache_create_tokens,
                span_name, trace_id, span_id, ts, raw_attributes)
             VALUES (:sid, :model, :in_tok, :out_tok, :cr, :cc,
                     :span_name, :trace_id, :span_id, :ts, :raw)'
        );
        $updateSession = $pdo->prepare(
            'UPDATE sessions SET
               total_input_tokens = total_input_tokens + :in_tok,
               total_output_tokens = total_output_tokens + :out_tok,
               total_cache_read_tokens = total_cache_read_tokens + :cr,
               total_cache_create_tokens = total_cache_create_tokens + :cc,
               model = COALESCE(:model, model),
               last_seen = NOW(),
               is_active = 1
             WHERE session_id = :sid'
        );

        $pdo->beginTransaction();
        try {
            foreach ($events as $e) {
                $insertEvent->execute([
                    ':sid' => $e['session_id'],
                    ':model' => $e['model'],
                    ':in_tok' => $e['input_tokens'],
                    ':out_tok' => $e['output_tokens'],
                    ':cr' => $e['cache_read_tokens'],
                    ':cc' => $e['cache_create_tokens'],
                    ':span_name' => $e['span_name'],
                    ':trace_id' => $e['trace_id'],
                    ':span_id' => $e['span_id'],
                    ':ts' => $e['ts'],
                    ':raw' => json_encode($e['raw_attributes']),
                ]);
                $updateSession->execute([
                    ':sid' => $e['session_id'],
                    ':model' => $e['model'],
                    ':in_tok' => $e['input_tokens'],
                    ':out_tok' => $e['output_tokens'],
                    ':cr' => $e['cache_read_tokens'],
                    ':cc' => $e['cache_create_tokens'],
                ]);
            }
            $pdo->commit();
        } catch (Throwable $t) {
            $pdo->rollBack();
            throw $t;
        }

        return count($events);
    }
}
