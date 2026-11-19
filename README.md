# Historical API snapshot — superseded

The current JoJo AI application is unified in **[Finuseco/JoJo-AI](https://github.com/Finuseco/JoJo-AI/tree/codex/production-studio-foundation)**.

Deploy **only JoJo-AI**, with one Next.js/PM2 process on **127.0.0.1:8095**. It serves the web and all API routes together under **https://ai.cashpay-all.com**. Windows and future Android/iOS clients use the same online API. Do not start this historical repository as an additional API service.

Existing API environment settings (database, JWT/encryption keys, OpenAI models and worker access) should be preserved and moved into the unified application's .env.local. Follow its deploy/README.md for the safe transition and only remove the obsolete jojo-ai-api PM2 process after the unified service is healthy.

This repository's source is retained for reference/history; it is no longer a deployment dependency.
