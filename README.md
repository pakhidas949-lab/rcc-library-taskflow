# TaskFlow API — RCC IIT Central Library Services

> A production-grade RESTful backend for **RCC IIT Library**, built with Node.js and Express.
> The full project lives in **[`taskflow-api/`](taskflow-api/)** — start there.

This repository contains one deliverable: **TaskFlow API**, the server-side engine that
replaces browser `localStorage` with real server-side persistence for the RCC IIT Central
Library Services system.

---

## What it is

A library management backend with three audiences:

| Audience | Entry point | What they get |
|---|---|---|
| **Visitors / students** | `/` | A public landing page — services, collections, opening hours |
| **Library staff** | `/login` → `/dashboard` | Four operational dashboards with live, server-backed data |
| **Developers** | `/api/docs` | A fully documented REST API with OpenAPI / Swagger UI |

The four dashboard pages started as static HTML mock-ups with hard-coded tables. In this
build **every row of every table is mirrored to a real server-side task** — completing a
task in the browser changes the store, survives a refresh, and is visible from any other
device.

---

## Quick start

```bash
cd taskflow-api
npm install
npm start
```

Then open **<http://localhost:5000>**.

Sign in to the staff portal with `priyanka` / `rccit@2026` (there is a one-click chip for
it on the login page).

| Command | What it does |
|---|---|
| `npm start` | Run the server |
| `npm run dev` | Run with auto-restart on save |
| `npm test` | Run the full suite — 88 tests, 3 files |
| `npm run test:postman` | Run the Postman collection headlessly (29 requests, 71 assertions) |
| `npm run build:pages` | Rebuild the public HTML pages from `tools/templates/` |
| `npm run audit:buttons` | List every button on every page |
| `npm run validate:openapi` | Parse the OpenAPI spec and check every `$ref` |

---

## At a glance

| | |
|---|---|
| **Stack** | Node.js 18+ · Express 4 · zod · helmet · cors · morgan · express-rate-limit |
| **Endpoints** | Task CRUD, session auth, aggregate stats, health, OpenAPI spec |
| **Auth** | Server-side sessions · HttpOnly cookie · scrypt hashing · account lockout |
| **Frontend** | Landing page, login page and 4 live dashboards, all served by the API |
| **Buttons** | 141 dashboard controls, every one wired to the API |
| **Tests** | 88 automated · 29 Postman requests · 71 assertions |
| **Docs** | OpenAPI 3.0 + Swagger UI + this README |

---

## Layout

```
Task1_priya/
├── README.md              ← you are here
└── taskflow-api/          ← the actual project
    ├── server.js
    ├── src/               Express app: routes, controllers, services, middleware, stores
    ├── public/            Landing page, login page, 4 dashboards, client scripts
    ├── tests/             Automated tests, Postman collection, load-test profile
    ├── tools/             Page builder, header generator, button auditor, OpenAPI validator
    ├── docs/              openapi.yaml + demo.mp4
    └── README.md          ← the full 500-line project documentation
```

---

## The demo recording

A walkthrough of the whole flow — the landing page, the staff sign-in, the live
dashboards and the task desk.

[![Watch the demo](<video controls src="https://github.com/pakhidas949-lab/rcc-library-taskflow/blob/main/docs/demo.mp4" title="./taskflow-api/docs/demo.mp4"></video>)

**[▶ Download the recording](./taskflow-api/docs/demo.mp4)** · also served by the running API at
<http://localhost:5000/docs/demo.mp4>

> The recording lives at `taskflow-api/docs/demo.mp4` and the poster frame at
> `taskflow-api/docs/thumbnail.jpg`. Drop your own recording over them and the thumbnail
> and the link pick it up automatically.

---

## Full documentation

Everything — architecture, the complete API reference, the authentication design, the
security posture, deployment, troubleshooting and the roadmap — is in:

### **[→ `taskflow-api/README.md`](taskflow-api/README.md)**

---

<div align="center">

**RCC IIT Library — Central Library Services**
TaskFlow API · Node.js + Express · REST + Authentication + Live dashboards

</div>
