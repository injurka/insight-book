# Client observability in SigNoz

The client exports OpenTelemetry traces, logs, and metrics to the configured
OTLP endpoint. The resource is identified by:

- `service.name=insight-book-client`
- `service.version=<client version>`
- `deployment.environment=<Vite mode>`

## API signals

Browser API calls use the OTel Fetch instrumentation. Tauri calls use a
manual client span because `@tauri-apps/plugin-http` does not go through the
browser `fetch` implementation. Both transports propagate W3C `traceparent`
to the API.

API errors are emitted as a structured log with body `api.request.error` and
these attributes:

- `http.method`
- `url.path` (query strings and identifier-like path segments are redacted)
- `http.status_code`
- `api.error_code`
- `api.error_classification=expected|unexpected`
- `api.transport=browser|tauri`
- `app.feature`
- `api.duration_ms`

Expected errors remain visible with WARN severity. They include cancelled or
offline requests and ordinary `401` session checks. Unexpected API failures
use ERROR severity and mark the active span as failed.

The client also exports:

- `app.api.requests` — completed API calls;
- `app.api.errors` — API failures by classification;
- `app.api.duration` — API duration histogram.

Useful SigNoz views are:

1. Logs filtered by `service.name=insight-book-client` and
   `body=api.request.error`, grouped by `url.path`, `http.status_code`, and
   `api.transport`.
2. Unexpected errors grouped by `app.feature` and client version.
3. API duration percentiles split by `api.transport`.
4. An alert on the rate of `api.error_classification=unexpected` or HTTP 5xx
   responses. Keep expected errors out of the paging alert.

The repository configures the client signals and attributes; dashboards and
alerts are SigNoz-side resources and still need to be created in the target
SigNoz installation.
