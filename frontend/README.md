# UniShare frontend

React 19 and TypeScript application built with Vite, Tailwind CSS v4, React Router, and Lucide React. The backend runs separately. Start with the [repository setup instructions](../README.md) to install and seed it.

From this directory, using Node.js 24:

```bash
npm ci
npm run dev -- --host 127.0.0.1
```

Open <http://127.0.0.1:5173>. The development server proxies `/api` to `http://127.0.0.1:8000`.

## Structure

- `src/pages/`: homepage, course/resource lists and details, and the not-found page.
- `src/components/`: shared navigation, cards, PDF viewer, and loading/error/empty states.
- `src/api/client.ts`: API requests and document URLs.
- `src/types/api.ts`: shared API response types.
- `src/utils/`: formatting and query helpers.

## Checks

```bash
npm test
npm run lint
npx tsc -b
npm run build
```

`npm test` uses Node 24’s built-in test runner and TypeScript support; it covers query parsing, API error messages, shortcut targets, and cancelled/stale requests without adding a test dependency. Browser workflows still need manual verification.

The production build includes a TypeScript check and writes `dist/`. `npm run preview` serves that build for local inspection; verify that API requests reach the backend when using it. Production hosting must provide a fallback to `index.html` for client-side routes and route `/api` to FastAPI, or use `VITE_API_BASE_URL` with a permitted API origin.

Set `VITE_API_BASE_URL` in `.env.local` only when the API uses a separate origin; its value is an origin such as `http://127.0.0.1:8000`, without `/api`. Vite embeds these values in client code, so they must not contain secrets.

Manual checks should cover search/filter/reset, pagination, browser back/forward, slow or failed API requests, PDF preview/download, phone-width layouts, and keyboard navigation. Keep the existing visual design when contributing fixes.
