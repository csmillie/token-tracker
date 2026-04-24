import { NextRequest, NextResponse } from "next/server";
import { parseTracePayload } from "@/lib/otlp";
import { upsertSession, insertUsageEvent } from "@/lib/queries";
import { decodeProtobufTraces } from "@/lib/protobuf";
import type { OtlpTracePayload } from "@/lib/types";

// Receives OTLP trace data from the OTel Collector.
// Handles both JSON and protobuf encodings.

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";

    let payload: OtlpTracePayload;
    if (contentType.includes("protobuf")) {
      const buf = Buffer.from(await request.arrayBuffer());
      payload = decodeProtobufTraces(buf);
    } else {
      payload = await request.json();
    }
    const events = parseTracePayload(payload);

    if (events.length === 0) {
      return NextResponse.json({ accepted: 0 });
    }

    // Process events: upsert sessions, insert events
    const sessionIds = new Set(events.map((e) => e.session_id));

    // Upsert all unique sessions first
    await Promise.all(
      Array.from(sessionIds).map((sid) => {
        const firstEvent = events.find((e) => e.session_id === sid);
        return upsertSession({
          session_id: sid,
          model: firstEvent?.model,
        });
      })
    );

    // Insert all usage events
    await Promise.all(
      events.map((e) =>
        insertUsageEvent({
          session_id: e.session_id,
          model: e.model,
          input_tokens: e.input_tokens,
          output_tokens: e.output_tokens,
          cache_read_tokens: e.cache_read_tokens,
          cache_create_tokens: e.cache_create_tokens,
          span_name: e.span_name,
          trace_id: e.trace_id,
          span_id: e.span_id,
          ts: e.ts,
          raw_attributes: e.raw_attributes,
        })
      )
    );

    console.log(
      `Ingested ${events.length} usage events from ${sessionIds.size} sessions`
    );
    return NextResponse.json({ accepted: events.length });
  } catch (err) {
    console.error("Ingest error:", err);
    return NextResponse.json(
      { error: "Ingestion failed", detail: String(err) },
      { status: 500 }
    );
  }
}
