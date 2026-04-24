// Standard OTLP path — the OTel Collector's otlphttp exporter POSTs here
// when using `endpoint` mode (appends /v1/traces automatically).
// Delegates to the existing ingest handler.
export { POST } from "@/app/api/ingest/route";
