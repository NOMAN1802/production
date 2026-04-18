# cPanel deployment (React app)

Deploy the pre-built React app so cPanel does not run a heavy `npm install`.

## 1. Build locally

```bash
cd client
npm run build
```

This creates `client/dist`.

## 2. Deployment layout (Application root)

Upload to `public_html/mskabirstore` (or your Application root) **only**:

| Path           | Source / contents |
|----------------|-------------------|
| `package.json` | Root [package.json](package.json) (minimal, no dependencies) |
| `server.js`    | Root [server.js](server.js) |
| `dist/`        | **Contents** of `client/dist` (all built files inside a folder named `dist`) |

So the folder on the server should look like:

```
public_html/mskabirstore/
  package.json
  server.js
  dist/
    index.html
    assets/
      ...
```

## 3. cPanel Node.js setup

- **Application root:** `public_html/mskabirstore`
- **Application startup file:** `server.js`
- Run **NPM install** once (no-op with the minimal package.json).
- **Start** the application.

## 4. API base URL

Point the React app at your production API in [client/src/services/baseApi.ts](client/src/services/baseApi.ts), then rebuild and re-upload `dist/` if needed.
