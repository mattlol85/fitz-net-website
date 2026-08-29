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
