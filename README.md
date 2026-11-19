# JoJo AI API

Standalone authenticated backend for **https://ai.cashpay-all.com**, used by the web and Electron clients. Private listener: **127.0.0.1:8096**. Public Nginx routes `/api/` here and other paths to the web at 8095. PostgreSQL, encryption, JWT, OpenAI model keys and worker credentials belong to this service only.

Copy `.env.example` to `.env.local`, configure it, export the database variables for CLI commands, run `npm ci`, `npm run migrate`, `npm run build`, then `pm2 start deploy/ecosystem.config.cjs`. Never expose the database or worker control ports. See `deploy/nginx.conf.example`; configure existing TLS certificates and run nginx -t before reloading.

## API v1

Authenticated cookie: `dev_portal_token`, signed by the configured developer portal. Unsafe browser operations require the configured public `Origin`. The web gateway forwards the session; the executable contains no API credentials. No permissive CORS is enabled.

- GET /api/v1/session: verified user and actual credit balances.
- GET /api/v1/projects: owned/accepted shared projects. POST creates a project.
- GET /api/v1/projects/:id/files: metadata/revisions; `?path=` reads a file.
- POST same route: `{path,content}` creates a file; folders use an empty `folder/.gitkeep`.
- PUT: `{path,content,revision}` saves UTF-8 text.
- PATCH: `{path,target,revision}` renames a file.
- DELETE: `{path,revision}` deletes a file.
- Conflicting revisions or destinations return 409; other users cannot access the project.
- GET /api/v1/projects/:id/chat: persisted history.
- POST /api/v1/projects/:id/chat/stream: `{message,requestId,attachments?}` yields accepted/progress/result SSE events. Proposals stay unapplied until approval. A disconnected stream may complete server-side: reload history or reuse the requestId instead of silently repeating a billed generation.
- POST /api/v1/workspace/actions: fixed server-action adapter used by the current web interface; module allowlist, real session/project guards and public Origin checks still apply.
- Existing /api/projects/:id/{runtime,preview,archive,github,android} and /api/integrations/* contracts remain available.
- GET /healthz checks PostgreSQL; returns 503 when unavailable.

OpenAI Responses provides code proposals; this is not a complete autonomous Codex CLI with arbitrary tools. Streaming displays actual text/file proposals rather than fake typing. Unsupported model/service operations return errors. 100 daily non-cumulative UTC credits are the application's allowance; they do not represent free OpenAI usage. Personal API keys are encrypted and use the user's API billing. ChatGPT subscriptions and API billing are separate; any eligible subscription API-credit benefit must be activated with OpenAI and the linked organization's API key used here.

Run `npm test`, `npm run typecheck`; `npm run test:credits` requires an isolated JOJO_TEST_DATABASE_URL. `npm run test:runtime` needs Docker. KVM Android boot, native APK compilation, external model/OAuth credentials and live DNS/TLS require their actual infrastructure. Windows signing belongs to the desktop release process. No production secrets/data are included.
