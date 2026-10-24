# Mishmash

A RUN.world game the community designs: players suggest features and the best ones get built.
It is **Bloom Island**, a 2.5D survival and crafting game: your plane crashes on a big island
where the other passengers are turning into plants. Gather, craft, build a base, farm, tame
animals, weather the storms, crack the island's secrets, find the three radio parts and call
for rescue, solo or with up to 3 friends. Around it sits a small hub: the suggestions box and
the owner's Dev area.

```bash
npm install
npm run dev          # local preview, SDK in mock mode (suggestions are a local stand-in;
                     # co-op runs on a local room server on port 9001)
npm test             # rules unit tests
npm run playthrough  # Playwright playthrough (dev server running)
npx tsx scripts/islandmap.ts 1234 map.png   # picture of the island for a seed
```

See `CLAUDE.md` for architecture, conventions, checks and deployment.

## One-time setup (RUN)

### 1. Install the tools

You need Node.js 20 or newer and Git. Check what you have:

```bash
node --version
git --version
```

If either is missing, install Node.js from nodejs.org and Git from git-scm.com.

Install the RUN CLI.

Mac or Linux:

```bash
curl -fsSL https://github.com/series-ai/rundot-cli-releases/releases/latest/download/install.sh | bash
```

Windows (PowerShell):

```powershell
irm https://github.com/series-ai/rundot-cli-releases/releases/latest/download/install.ps1 | iex
```

Then close and reopen the terminal and check that it works:

```bash
rundot --version
```

### 2. Download the game code

```bash
git clone -b claude/happy-mayer-ufwo5m https://github.com/rhuneark/Mishmash
cd Mishmash
```

### 3. Log in to RUN

```bash
rundot login
```

A browser window opens. Sign in with your Google account, then come back to the terminal.

### 4. Create the game on RUN

```bash
rundot init --name "Mishmash" --description "A brand-new game, coming soon to RUN." --orientation Portrait --build-path ./dist
```

This creates `game.config.prod.json`. The description is a placeholder; it can be changed any
time.

### 5. Build and deploy

```bash
npm ci
npm run build
rundot deploy --orientation Portrait
```

The last command prints the private share link at the end.

### 6. Create a deploy key for GitHub

```bash
rundot game api-keys create --label "GitHub Actions"
```

It prints a key starting with `rk_` only once, so copy it now. Never paste it in a chat.

### 7. Add the key to GitHub

1. Go to https://github.com/rhuneark/Mishmash/settings/secrets/actions
2. Click **New repository secret**.
3. Name: `RUNDOT_API_KEY`
4. Secret: paste the `rk_…` key.
5. Click **Add secret**.

### 8. Save the game config to the repo

```bash
git add game.config.prod.json
git commit -m "Add RUN game config"
git push
```

From then on, every push to the game branch deploys a new private build
(`.github/workflows/deploy.yml`).
