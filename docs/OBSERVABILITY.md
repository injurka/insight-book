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

## This deployment

The supplied Swarm stack exposes the OTLP/HTTP receiver at
`https://otlp.limited-dissolve.ru`. Web builds take the endpoint from
`VITE_OTEL_EXPORTER_OTLP_ENDPOINT` (or the generated `app-config.js`). Tauri
release builds use that value when it is a valid non-local URL and otherwise
fall back to the same production endpoint, because an APK has no nginx
runtime config.

OTLP exports from a Tauri WebView use the browser `fetch` API, so the receiver
must allow the Tauri origin in addition to the web origins. In the ingester
receiver from the deployment config, add the origin used by the installed
Tauri build (Tauri 2 normally uses `http://tauri.localhost`; keep
`https://tauri.localhost` too if that is what `window.location.origin` shows
in Eruda):

```yaml
receivers:
  otlp:
    protocols:
      http:
        cors:
          allowed_origins:
            - https://insight-book.ru
            - https://admin.insight-book.ru
            - http://tauri.localhost
            - https://tauri.localhost
          allowed_headers:
            - '*'
```

After changing the external SigNoz config, restart/redeploy `ingester` and
verify an APK export by filtering SigNoz for
`service.name = insight-book-client` and
`deployment.environment = production` (or the mode embedded by the build).

┌─────────────────────────────────────────────────────────────┐
│                   insight-book-client                       │
│                                                             │
│  Web                                         Tauri / APK    │
│  insight-book.ru                            tauri.localhost │
│                                                             │
│  Browser fetch                              plugin-http     │
│      │                                           │          │
│      │ OTel Fetch instrumentation               │ manual    │
│      │                                           │ span     │
│      └──────────────────┬────────────────────────┘          │
│                         │                                   │
│                   OpenTelemetry SDK                         │
│                         │                                   │
│             ┌───────────┼───────────┐                       │
│             │           │           │                       │
│           Traces       Logs       Metrics                   │
│             │           │           │                       │
│             │           │           ├─ app.api.requests     │
│             │           │           ├─ app.api.errors       │
│             │           │           └─ app.api.duration     │
│             │           │                                   │
│             │           └─ api.request.error                │
│             │               WARN expected                   │
│             │               ERROR unexpected                │
│             │                                               │
│             └─ API spans + traceparent → backend API        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ OTLP/HTTP
                          │ HTTPS
                          ▼
             https://otlp.limited-dissolve.ru
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                         Traefik                             │
│                                                             │
│ Host(`otlp.limited-dissolve.ru`)                            │
│ HTTPS / websecure                                           │
│                       │                                     │
│                       ▼ :4318                               │
│                 signoz-ingester                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ OTLP receiver
                        │
                        │ HTTP :4318
                        │ gRPC :4317
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                 SigNoz OTel Collector                       │
│                                                             │
│ CORS allowed origins:                                       │
│   https://insight-book.ru                                   │
│   https://admin.insight-book.ru                             │
│   http://tauri.localhost                                    │
│   https://tauri.localhost                                   │
│                                                             │
│           ┌────────────┬──────────────┐                     │
│           │            │              │                     │
│          Logs        Traces         Metrics                 │
│           │            │              │                     │
│           └────────────┴──────┬───────┘                     │
│                               ▼                             │
│                          processors                         │
│                        batch / spanmetrics                  │
└───────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                         ClickHouse                          │
│                                                             │
│   signoz_logs        signoz_traces       signoz_metrics     │
│                                                             │
└───────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                         SigNoz UI                           │
│               signoz.limited-dissolve.ru                    │
│                                                             │
│   Logs             Traces              Metrics              │
│   Dashboards       API latency         Alerts               │
│   API errors       Distributed traces Error rate            │
└─────────────────────────────────────────────────────────────┘
