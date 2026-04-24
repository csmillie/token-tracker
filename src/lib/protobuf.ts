// Decode OTLP protobuf payloads into the JSON-equivalent structures
// used by our existing parsers. Handles gzip-compressed payloads.

import { gunzipSync } from "node:zlib";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const root = require("@opentelemetry/otlp-transformer/build/src/generated/root");

const ExportTraceServiceRequest =
  root.opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest;

const ExportLogsServiceRequest =
  root.opentelemetry.proto.collector.logs.v1.ExportLogsServiceRequest;

import type { OtlpTracePayload, OtlpLogsPayload } from "./types";

function bytesToHex(bytes: Uint8Array | Buffer): string {
  return Buffer.from(bytes).toString("hex");
}

// Convert protobuf numeric nano timestamps to string (matching JSON OTLP format)
function nanoToString(value: unknown): string | undefined {
  if (value == null) return undefined;
  return String(value);
}

// Convert protobuf attribute value to our JSON type shape
function convertValue(val: Record<string, unknown>): Record<string, unknown> {
  if (val.stringValue != null) return { stringValue: val.stringValue };
  if (val.intValue != null) return { intValue: String(val.intValue) };
  if (val.doubleValue != null) return { doubleValue: val.doubleValue };
  if (val.boolValue != null) return { boolValue: val.boolValue };
  if (val.arrayValue != null) {
    const arr = val.arrayValue as { values?: unknown[] };
    return {
      arrayValue: {
        values: (arr.values ?? []).map((v) =>
          convertValue(v as Record<string, unknown>)
        ),
      },
    };
  }
  return {};
}

function convertAttributes(
  attrs: Array<{ key: string; value: Record<string, unknown> }> | undefined
) {
  if (!attrs) return undefined;
  return attrs.map((a) => ({
    key: a.key,
    value: convertValue(a.value ?? {}),
  }));
}

function maybeGunzip(buf: Buffer): Buffer {
  // Gzip magic bytes: 0x1f 0x8b
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    return gunzipSync(buf);
  }
  return buf;
}

export function decodeProtobufTraces(buf: Buffer): OtlpTracePayload {
  const msg = ExportTraceServiceRequest.decode(maybeGunzip(buf));
  const obj = ExportTraceServiceRequest.toObject(msg, {
    longs: String,
    bytes: Buffer,
  });

  return {
    resourceSpans: (obj.resourceSpans ?? []).map(
      (rs: Record<string, unknown>) => {
        const resource = rs.resource as
          | { attributes?: Array<{ key: string; value: Record<string, unknown> }> }
          | undefined;
        return {
          resource: resource
            ? { attributes: convertAttributes(resource.attributes) }
            : undefined,
          scopeSpans: (
            (rs.scopeSpans ?? []) as Array<Record<string, unknown>>
          ).map((ss) => ({
            scope: ss.scope as { name?: string } | undefined,
            spans: (
              (ss.spans ?? []) as Array<Record<string, unknown>>
            ).map((span) => ({
              traceId: span.traceId instanceof Buffer || span.traceId instanceof Uint8Array
                ? bytesToHex(span.traceId as Buffer)
                : span.traceId as string | undefined,
              spanId: span.spanId instanceof Buffer || span.spanId instanceof Uint8Array
                ? bytesToHex(span.spanId as Buffer)
                : span.spanId as string | undefined,
              name: span.name as string | undefined,
              attributes: convertAttributes(
                span.attributes as Array<{ key: string; value: Record<string, unknown> }> | undefined
              ),
              startTimeUnixNano: nanoToString(span.startTimeUnixNano),
              endTimeUnixNano: nanoToString(span.endTimeUnixNano),
              status: span.status as { code?: number } | undefined,
            })),
          })),
        };
      }
    ),
  };
}

export function decodeProtobufLogs(buf: Buffer): OtlpLogsPayload {
  const msg = ExportLogsServiceRequest.decode(maybeGunzip(buf));
  const obj = ExportLogsServiceRequest.toObject(msg, {
    longs: String,
    bytes: Buffer,
  });

  return {
    resourceLogs: (obj.resourceLogs ?? []).map(
      (rl: Record<string, unknown>) => {
        const resource = rl.resource as
          | { attributes?: Array<{ key: string; value: Record<string, unknown> }> }
          | undefined;
        return {
          resource: resource
            ? { attributes: convertAttributes(resource.attributes) }
            : undefined,
          scopeLogs: (
            (rl.scopeLogs ?? []) as Array<Record<string, unknown>>
          ).map((sl) => ({
            scope: sl.scope as { name?: string } | undefined,
            logRecords: (
              (sl.logRecords ?? []) as Array<Record<string, unknown>>
            ).map((lr) => ({
              timeUnixNano: nanoToString(lr.timeUnixNano),
              body: lr.body ? convertValue(lr.body as Record<string, unknown>) : undefined,
              attributes: convertAttributes(
                lr.attributes as Array<{ key: string; value: Record<string, unknown> }> | undefined
              ),
              traceId: lr.traceId instanceof Buffer || lr.traceId instanceof Uint8Array
                ? bytesToHex(lr.traceId as Buffer)
                : lr.traceId as string | undefined,
              spanId: lr.spanId instanceof Buffer || lr.spanId instanceof Uint8Array
                ? bytesToHex(lr.spanId as Buffer)
                : lr.spanId as string | undefined,
            })),
          })),
        };
      }
    ),
  };
}
