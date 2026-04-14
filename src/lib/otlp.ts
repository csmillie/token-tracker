import type {
  OtlpAttribute,
  OtlpAttributeValue,
  OtlpTracePayload,
  OtlpLogsPayload,
  OtlpResourceSpans,
  OtlpSpan,
} from "./types";

// ── Attribute helpers ──
// Claude Code's OTLP attribute keys may change across versions.
// We check multiple possible names for each field.

function getAttrValue(
  attrs: OtlpAttribute[] | undefined,
  ...keys: string[]
): string | number | undefined {
  if (!attrs) return undefined;
  for (const key of keys) {
    const attr = attrs.find((a) => a.key === key);
    if (attr) return extractValue(attr.value);
  }
  return undefined;
}

function extractValue(v: OtlpAttributeValue): string | number | undefined {
  if (v.intValue !== undefined) return Number(v.intValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.boolValue !== undefined) return v.boolValue ? 1 : 0;
  return undefined;
}

function attrsToRecord(
  attrs: OtlpAttribute[] | undefined
): Record<string, unknown> {
  if (!attrs) return {};
  const result: Record<string, unknown> = {};
  for (const a of attrs) {
    result[a.key] = extractValue(a.value);
  }
  return result;
}

// ── Extract session ID from resource or span attributes ──
// Claude Code may place session_id under different attribute names.

function extractSessionId(
  resourceAttrs: OtlpAttribute[] | undefined,
  spanAttrs: OtlpAttribute[] | undefined,
  fallbackTraceId?: string
): string {
  const candidates = [
    "session.id",
    "claude_code.session_id",
    "claude.session_id",
    "service.instance.id",
  ];

  const fromResource = getAttrValue(resourceAttrs, ...candidates);
  if (fromResource) return String(fromResource);

  const fromSpan = getAttrValue(spanAttrs, ...candidates);
  if (fromSpan) return String(fromSpan);

  // Fall back to trace ID if no session ID found
  return fallbackTraceId ?? "unknown";
}

// ── Token attribute key candidates ──
// OpenTelemetry GenAI semantic conventions + possible Claude Code variants

const INPUT_TOKEN_KEYS = [
  "gen_ai.usage.input_tokens",
  "gen_ai.usage.prompt_tokens",
  "llm.usage.prompt_tokens",
  "input_tokens",
];

const OUTPUT_TOKEN_KEYS = [
  "gen_ai.usage.output_tokens",
  "gen_ai.usage.completion_tokens",
  "llm.usage.completion_tokens",
  "output_tokens",
];

const CACHE_READ_KEYS = [
  "gen_ai.usage.cache_read_input_tokens",
  "gen_ai.usage.cache_read_tokens",
  "cache_read_input_tokens",
];

const CACHE_CREATE_KEYS = [
  "gen_ai.usage.cache_creation_input_tokens",
  "gen_ai.usage.cache_creation_tokens",
  "cache_creation_input_tokens",
];

const MODEL_KEYS = [
  "gen_ai.request.model",
  "gen_ai.response.model",
  "llm.request.model",
  "model",
];

export interface ParsedUsageEvent {
  session_id: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_create_tokens: number;
  span_name: string | null;
  trace_id: string | null;
  span_id: string | null;
  ts: Date;
  raw_attributes: Record<string, unknown>;
}

// ── Parse OTLP trace payload into usage events ──

export function parseTracePayload(
  payload: OtlpTracePayload
): ParsedUsageEvent[] {
  const events: ParsedUsageEvent[] = [];

  if (!payload.resourceSpans) return events;

  for (const rs of payload.resourceSpans) {
    const resourceAttrs = rs.resource?.attributes;

    if (!rs.scopeSpans) continue;

    for (const ss of rs.scopeSpans) {
      if (!ss.spans) continue;

      for (const span of ss.spans) {
        const inputTokens = Number(
          getAttrValue(span.attributes, ...INPUT_TOKEN_KEYS) ?? 0
        );
        const outputTokens = Number(
          getAttrValue(span.attributes, ...OUTPUT_TOKEN_KEYS) ?? 0
        );

        // Skip spans with no token usage
        if (inputTokens === 0 && outputTokens === 0) continue;

        const sessionId = extractSessionId(
          resourceAttrs,
          span.attributes,
          span.traceId
        );
        const model = getAttrValue(span.attributes, ...MODEL_KEYS);
        const cacheRead = Number(
          getAttrValue(span.attributes, ...CACHE_READ_KEYS) ?? 0
        );
        const cacheCreate = Number(
          getAttrValue(span.attributes, ...CACHE_CREATE_KEYS) ?? 0
        );

        // Timestamp: prefer span endTime, fall back to startTime, fall back to now
        let ts = new Date();
        if (span.endTimeUnixNano) {
          ts = new Date(Number(BigInt(span.endTimeUnixNano) / 1000000n));
        } else if (span.startTimeUnixNano) {
          ts = new Date(Number(BigInt(span.startTimeUnixNano) / 1000000n));
        }

        events.push({
          session_id: sessionId,
          model: model != null ? String(model) : null,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_read_tokens: cacheRead,
          cache_create_tokens: cacheCreate,
          span_name: span.name ?? null,
          trace_id: span.traceId ?? null,
          span_id: span.spanId ?? null,
          ts,
          raw_attributes: attrsToRecord(span.attributes),
        });
      }
    }
  }

  return events;
}

// ── Parse OTLP logs payload for token usage ──
// Claude Code may also emit token usage via log records

export function parseLogsPayload(
  payload: OtlpLogsPayload
): ParsedUsageEvent[] {
  const events: ParsedUsageEvent[] = [];

  if (!payload.resourceLogs) return events;

  for (const rl of payload.resourceLogs) {
    const resourceAttrs = rl.resource?.attributes;

    if (!rl.scopeLogs) continue;

    for (const sl of rl.scopeLogs) {
      if (!sl.logRecords) continue;

      for (const log of sl.logRecords) {
        const inputTokens = Number(
          getAttrValue(log.attributes, ...INPUT_TOKEN_KEYS) ?? 0
        );
        const outputTokens = Number(
          getAttrValue(log.attributes, ...OUTPUT_TOKEN_KEYS) ?? 0
        );

        if (inputTokens === 0 && outputTokens === 0) continue;

        const sessionId = extractSessionId(
          resourceAttrs,
          log.attributes,
          log.traceId
        );
        const model = getAttrValue(log.attributes, ...MODEL_KEYS);
        const cacheRead = Number(
          getAttrValue(log.attributes, ...CACHE_READ_KEYS) ?? 0
        );
        const cacheCreate = Number(
          getAttrValue(log.attributes, ...CACHE_CREATE_KEYS) ?? 0
        );

        let ts = new Date();
        if (log.timeUnixNano) {
          ts = new Date(Number(BigInt(log.timeUnixNano) / 1000000n));
        }

        events.push({
          session_id: sessionId,
          model: model != null ? String(model) : null,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_read_tokens: cacheRead,
          cache_create_tokens: cacheCreate,
          span_name: null,
          trace_id: log.traceId ?? null,
          span_id: log.spanId ?? null,
          ts,
          raw_attributes: attrsToRecord(log.attributes),
        });
      }
    }
  }

  return events;
}
