<?php

// Parses OTLP JSON payloads (traces + logs) into usage events.
// Mirrors src/lib/otlp.ts behavior.

class OtlpParser
{
    private const INPUT_TOKEN_KEYS = [
        'gen_ai.usage.input_tokens',
        'gen_ai.usage.prompt_tokens',
        'llm.usage.prompt_tokens',
        'input_tokens',
    ];

    private const OUTPUT_TOKEN_KEYS = [
        'gen_ai.usage.output_tokens',
        'gen_ai.usage.completion_tokens',
        'llm.usage.completion_tokens',
        'output_tokens',
    ];

    private const CACHE_READ_KEYS = [
        'gen_ai.usage.cache_read_input_tokens',
        'gen_ai.usage.cache_read_tokens',
        'cache_read_input_tokens',
        'cache_read_tokens',
    ];

    private const CACHE_CREATE_KEYS = [
        'gen_ai.usage.cache_creation_input_tokens',
        'gen_ai.usage.cache_creation_tokens',
        'cache_creation_input_tokens',
        'cache_creation_tokens',
    ];

    private const MODEL_KEYS = [
        'gen_ai.request.model',
        'gen_ai.response.model',
        'llm.request.model',
        'model',
    ];

    private const SESSION_KEYS = [
        'session.id',
        'claude_code.session_id',
        'claude.session_id',
        'service.instance.id',
    ];

    /**
     * @return array<int,array<string,mixed>>
     */
    public static function parseTraces(array $payload): array
    {
        $events = [];
        foreach ($payload['resourceSpans'] ?? [] as $rs) {
            $resourceAttrs = $rs['resource']['attributes'] ?? [];
            foreach ($rs['scopeSpans'] ?? [] as $ss) {
                foreach ($ss['spans'] ?? [] as $span) {
                    $spanAttrs = $span['attributes'] ?? [];
                    $event = self::buildEvent(
                        $resourceAttrs,
                        $spanAttrs,
                        $span['name'] ?? null,
                        $span['traceId'] ?? null,
                        $span['spanId'] ?? null,
                        $span['endTimeUnixNano'] ?? $span['startTimeUnixNano'] ?? null
                    );
                    if ($event !== null) {
                        $events[] = $event;
                    }
                }
            }
        }
        return $events;
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public static function parseLogs(array $payload): array
    {
        $events = [];
        foreach ($payload['resourceLogs'] ?? [] as $rl) {
            $resourceAttrs = $rl['resource']['attributes'] ?? [];
            foreach ($rl['scopeLogs'] ?? [] as $sl) {
                foreach ($sl['logRecords'] ?? [] as $log) {
                    $logAttrs = $log['attributes'] ?? [];
                    $event = self::buildEvent(
                        $resourceAttrs,
                        $logAttrs,
                        null,
                        $log['traceId'] ?? null,
                        $log['spanId'] ?? null,
                        $log['timeUnixNano'] ?? null
                    );
                    if ($event !== null) {
                        $events[] = $event;
                    }
                }
            }
        }
        return $events;
    }

    private static function buildEvent(
        array $resourceAttrs,
        array $attrs,
        ?string $spanName,
        ?string $traceId,
        ?string $spanId,
        ?string $tsNano
    ): ?array {
        $input = (int) (self::getAttrValue($attrs, self::INPUT_TOKEN_KEYS) ?? 0);
        $output = (int) (self::getAttrValue($attrs, self::OUTPUT_TOKEN_KEYS) ?? 0);
        if ($input === 0 && $output === 0) {
            return null;
        }
        $cacheRead = (int) (self::getAttrValue($attrs, self::CACHE_READ_KEYS) ?? 0);
        $cacheCreate = (int) (self::getAttrValue($attrs, self::CACHE_CREATE_KEYS) ?? 0);
        $model = self::getAttrValue($attrs, self::MODEL_KEYS);
        $sessionId = self::getAttrValue($resourceAttrs, self::SESSION_KEYS)
            ?? self::getAttrValue($attrs, self::SESSION_KEYS)
            ?? $traceId
            ?? 'unknown';

        return [
            'session_id' => (string) $sessionId,
            'model' => $model !== null ? (string) $model : null,
            'input_tokens' => $input,
            'output_tokens' => $output,
            'cache_read_tokens' => $cacheRead,
            'cache_create_tokens' => $cacheCreate,
            'span_name' => $spanName,
            'trace_id' => $traceId,
            'span_id' => $spanId,
            'ts' => self::nanoToIso($tsNano),
            'raw_attributes' => self::attrsToRecord($attrs),
        ];
    }

    /**
     * @param array<int,array<string,mixed>> $attrs
     * @param array<int,string> $keys
     */
    private static function getAttrValue(array $attrs, array $keys): string|int|float|null
    {
        foreach ($keys as $key) {
            foreach ($attrs as $a) {
                if (($a['key'] ?? null) === $key) {
                    return self::extractValue($a['value'] ?? []);
                }
            }
        }
        return null;
    }

    private static function extractValue(array $v): string|int|float|null
    {
        if (isset($v['intValue'])) {
            return (int) $v['intValue'];
        }
        if (isset($v['doubleValue'])) {
            return (float) $v['doubleValue'];
        }
        if (isset($v['stringValue'])) {
            return (string) $v['stringValue'];
        }
        if (isset($v['boolValue'])) {
            return $v['boolValue'] ? 1 : 0;
        }
        return null;
    }

    private static function attrsToRecord(array $attrs): array
    {
        $out = [];
        foreach ($attrs as $a) {
            $out[$a['key'] ?? ''] = self::extractValue($a['value'] ?? []);
        }
        return $out;
    }

    private static function nanoToIso(?string $nano): string
    {
        if ($nano === null || $nano === '') {
            return gmdate('Y-m-d H:i:s');
        }
        $sec = (int) bcdiv($nano, '1000000000', 0);
        return gmdate('Y-m-d H:i:s', $sec);
    }
}
