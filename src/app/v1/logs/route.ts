// Standard OTLP path — the OTel Collector's otlphttp exporter POSTs here
// when using `endpoint` mode (appends /v1/logs automatically).
// Delegates to the existing logs ingest handler.
export { POST } from "@/app/api/ingest/logs/route";
