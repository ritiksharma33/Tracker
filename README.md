# Snorkel Submission Board

A small internal dashboard that runs the official `stb` CLI on the server and
shows the result — pick a project from a dropdown, paste your Snorkel API
key, see your submission status. No third-party site in the middle.

Built with Next.js (App Router). The whole app is three real pieces:

- `app/page.tsx` — the UI (project picker, key field, results table)
- `app/api/submissions/route.ts` — a server route that runs `stb`
- `lib/stb.ts` — the actual CLI invocation, isolated per request

---

## ⚠️ Read this before you deploy it for the team

Two things in here are **assumptions I made without documentation to verify
them against**, because `stb` is an internal tool with no public docs. Fix
these two things first — everything else in the app is solid.

### 1. `stb` has to actually be installed wherever this runs

Right now `stb` is installed at `/Users/ritikattri/.local/bin/stb` on your
own machine (it's almost certainly a `pipx`/`pip`-installed Python CLI).
A vanilla `vercel deploy` gives you a Node.js serverless function — `stb`
will **not** be on it unless you put it there.

Two realistic paths:

- **Vercel, with a custom build step.** If `stb` is installable via pip
  from somewhere Vercel's build can reach (an internal package index, a
  private GitHub repo, etc.), add that install to the build command in
  `vercel.json` or the Vercel project settings, e.g. something like
  `pip install --target ./stb-vendor stb-cli && npm run build` — the exact
  command depends on how `stb` is actually distributed, which I don't know.
  You'll also need Python available in the function runtime, which Vercel's
  Node functions don't give you by default.
- **A container-based platform instead** (Render, Fly.io, Railway, a plain
  VM). You control the image, so you `pip install`/`pipx install stb` once
  in a `Dockerfile` and it's just there. This is the more reliable option
  if you're not sure about the Vercel build constraints above — I'd lean
  this way for anything beyond a quick test.

If you do get it onto Vercel, set `STB_BINARY` in your environment
variables to the exact path if it's not on `PATH`.

### 2. The non-interactive login call is a guess

`lib/stb.ts` runs:

```
stb login --token <the key someone typed in>
```

`--token` is **not a confirmed flag** — I generated this without access to
`stb login --help`'s real output for a non-interactive case. Before you trust
this app:

```bash
stb login --help
stb keys --help
```

...and check whether authentication actually works this way, or whether it's
a different flag, or an environment variable your `stb` build reads instead
(if it's an env var, delete the `login` call in `lib/stb.ts` and instead add
the var to the `isolatedEnv` object passed into the submissions call —
there's a comment right above that code marking the spot).

Everything downstream of authentication (the isolated per-request `$HOME`,
the table parser, the UI) doesn't depend on this and should work as-is.

---

## Run it locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. You'll need `stb` installed and on your
`PATH` locally (which it already is, per what you showed me), and a real
API key to test the fetch.

## Deploy

**Vercel** (once the `stb`-availability question above is resolved):

```bash
npm i -g vercel
vercel
```

Or connect the repo in the Vercel dashboard and click Deploy — it auto-detects
Next.js. Set `STB_BINARY` under Project Settings → Environment Variables if
needed.

**Anywhere with Docker** (recommended if unsure about the point above):

```dockerfile
FROM node:20-slim
# install python + stb here, however your team distributes it
RUN apt-get update && apt-get install -y python3-pip
# RUN pip install stb-cli   <- replace with your real install step
WORKDIR /app
COPY . .
RUN npm install && npm run build
CMD ["npm", "start"]
```

## Add a project to the dropdown

Open `lib/projects.ts` and add one entry:

```ts
{
  id: "another-project",       // anything unique, URL-safe
  name: "CDG_Another_Project", // must match --project-name exactly
  label: "Another Project",    // what shows in the dropdown
},
```

Nothing else needs to change — the dropdown, the command preview, and the
API route all read from this one list.

## How a request works

1. You pick a project and paste a key, click **Fetch status**.
2. The browser sends both to `POST /api/submissions` — this app's own
   server, not a third party.
3. The server creates a throwaway temp directory, uses it as `$HOME` for
   just this one request, runs `stb login` then `stb submissions list`
   inside it, and deletes the directory when done. This means two people
   using the dashboard at the same moment never share a session or see
   each other's data.
4. The table `stb` prints gets parsed into JSON and rendered.

## Security notes

- Your key is used for one request and is never written to a database,
  log file, or persisted config — the temp `$HOME` is deleted in a
  `finally` block whether the request succeeds or fails.
- That said, this app **does** pass your key through its own server, so
  anyone who can deploy/read that server's logs could add logging and
  capture it. Treat it the same as you'd treat pasting a password into any
  internal tool: fine for a trusted team, not something to expose publicly
  without adding real auth in front of it.
- **On the credential you shared while asking for this**: it was pasted in
  plaintext in a chat, so treat it as compromised — rotate it in the
  Snorkel dashboard rather than reusing it here.
