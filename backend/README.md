# ZhiLens Backend

Evidence-backed Zhihu reading backend. Node.js 22, TypeScript, Fastify and Zod.

## Commands

~~~bash
npm install
npm run check       # typecheck + data validation + tests + production build
npm run dev         # local watch mode, reads ../.env.local
npm run build
npm run start:prod  # requires environment variables from deployment
~~~

## Runtime endpoints

- GET /health
- GET /ready
- GET /api/v1/meta
- GET /api/v1/openapi.json
- GET /api/v1/sources
- GET /api/v1/sources/:sourceId
- POST /api/v1/search
- POST /api/v1/lens
- POST /api/v1/reading-set
- POST /api/v1/render-packet

The frontend should use RenderPacket as its primary display contract. Every rendered fact carries validated Evidence and source provenance.

Canonical data currently contains 184 sources and 7 manually verified ExperienceRecords. See data/README.md for provenance. The full handoff is ../07_知鉴_后端交接文档_v0.1.md.
