# fitz-net-website — Agentic Development Guide

React 19 SPA — the frontend for Fitz-Net. Features authentication, real-time boards, game stats, and system monitoring.

---

## Tech Stack

| Item | Value |
|---|---|
| Framework | React 19 |
| Build tool | Vite 6 |
| Routing | React Router v7 |
| Testing | Vitest 4 + @testing-library/react |
| WebSocket | @stomp/stompjs |
| Charts | Recharts |
| Markdown | react-markdown + remark-gfm |

---

## Architecture

| Layer | Location | Pattern |
|---|---|---|
| Pages/Components | `src/components/` | React functional components with hooks |
| Context | `src/contexts/` | `AuthContext` provides `user`, `token`, `login`, `logout`, `updateProfile`, `isAuthenticated` |
| Services | `src/services/` | `api.js` (real API calls), `mockApi.js` (offline/dev mock), `actuatorService.js`, `liveBoardService.js` |
| CSS | `src/css/` | Component-scoped CSS files (one per component) |
| Constants | `src/constants.js` | API URLs, config arrays |
| Routing | `src/App.jsx` | React Router v7 `<Routes>` |
| Sites | `src/site.js` | One build serves **fitznet.org** and **lori.fitznet.org** (Lori-Net, pink "LN"), picked from the hostname |

---

## Key Conventions

- API calls go through `src/services/api.js` — wraps `fetch()` and returns `{ success, message, ...data }`
- Mock API toggled via `VITE_USE_MOCK_API=true` env var — all new API calls need a mock implementation in `mockApi.js`
- `AuthContext` manages JWT token in `localStorage` (`authToken`, `authUser` keys)
- All authenticated API calls include `Authorization: Bearer <token>` header
- Tests: Vitest + `@testing-library/react` + `@testing-library/user-event`
- Each component `Foo.jsx` has a co-located `Foo.test.jsx`
- Mocking pattern in tests: `vi.mock('../contexts/AuthContext', ...)` to control auth state
- Test names must start with `should`
- **Two sites, one build.** `getSite()` (`src/site.js`) returns the Fitz-Net or Lori-Net config: name, logo, animation, footer, required permission. `index.jsx` sets `data-site` on `<html>`, and `:root[data-site='lori']` in `index.css` re-tints every colour token, so new CSS that uses tokens is pink on Lori-Net for free. Lori-Net renders its own short route list in `App.jsx` inside `SiteGate`, which needs `LORINET_ACCESS` (ADMIN passes) and shows `LoginModal` when signed out. Preview it locally at `http://localhost:3000/?site=lori` (mock user `lori` / `lorinet123`). LN brand assets are generated from the FN ones by `scripts/make-lori-assets.py`; re-run it if an FN asset changes
- **Marine Park tab.** `/marine-park` (Fitz-Net only) frames the Unity web build from `MARINE_PARK_URL` (`src/constants.js`, default `/marine-park/index.html`, override with `VITE_MARINE_PARK_URL`) and passes the signed-in username as `?name=`, which the game uses to pre-fill its player name. The route and navbar link need `MARINE_PARK_GAME` (ADMIN passes); the permission is runtime-defined, so add it in the Admin page's permission catalogue before granting it. The Docker image bakes in the game release pinned in `marine-park.version`: its `marinepark` stage runs `scripts/fetch-marine-park.sh`, which downloads `MarinePark-<version>-web.zip` from the private Marine-Park repo using the `marine_park_token` build secret (`MARINE_PARK_TOKEN` repo secret in `publish.yml`, where `MARINE_PARK_REQUIRED=true` makes a missing token fail the build). To upgrade the game, bump that file. Local `docker build` without the secret skips the game; add `--secret id=marine_park_token,env=GH_TOKEN` to include it. To preview with `npm run dev`, unzip the web zip into `public/marine-park/` (gitignored, and excluded from the image) and sign in as mock user `testuser` / `password123`. Without the build the page says the game isn't installed

---

## Feature Implementation Order

1. **API service** — Add the call in `src/services/api.js` with matching method/URL/headers
2. **Mock API** — Add mock implementation in `src/services/mockApi.js`
3. **Context** — If auth-related, add method to `AuthContext` and expose via `useAuth()`
4. **Component** — Build/modify the UI component
5. **CSS** — Add styles in `src/css/`
6. **Routing** — Add route in `App.jsx` if it's a new page
7. **Tests** — Write tests in co-located `*.test.jsx`, mock `AuthContext` for auth state

---

## Build & Test

```bash
npm install                          # Install dependencies (first time)
npm run dev                          # Start dev server
npx vitest run                       # Run all tests once
npx vitest run --reporter=verbose    # Verbose test output
npm run build                        # Production build
```

---

## Custom Claude Code Agents

- `web-polish-reviewer` (`.claude/agents/web-polish-reviewer.md`) — read-only reviewer that audits changed frontend code for polish: visual/token consistency, layout regressions (footer, top-right login), accessibility, React/`AuthContext` hygiene, routing, and loading/empty/error states.

---

## Commit Convention

```
feat(subject): description
fix(subject): description
chore(subject): description
```

Use `feat` for new user-facing behavior, `fix` for bug fixes, `chore` for maintenance/tooling.

---

## Common Pitfalls

- **HTTP method mismatch:** `fetch()` method must match backend `@GetMapping`/`@PostMapping`/etc.
- **DTO field name mismatch:** JSON keys must match Java camelCase field names in the backend DTO
- **Void responses:** If the backend returns `void`, `response.json()` will throw — ensure backend always returns a DTO
- **CORS:** New origins must be added to `SecurityConfig` in fitz-net-api
- **Auth headers:** All non-public endpoints need `Authorization: Bearer <token>` — get token from `useAuth().token`
