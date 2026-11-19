# API verification

Next.js production build and TypeScript passed. Eleven existing contract tests cover ZIP/paths/crypto, OpenAI request/stream handling, PNG cropping, Git merge and npm parsing. An actual PostgreSQL fixture behind the separate API and web gateway verified create/read/save/rename/delete, conflicting revisions, destination collisions and cross-account denial. SSE transport returned a real configuration error with no simulated provider answer when OpenAI was not configured.

Prior worker tests covered real Docker dependency installation/build/publication/log streaming and scoped cancellation. No paid model request, production OAuth flow, public DNS/TLS deployment or KVM boot is claimed by these local tests.
