# Site release: branch claude/site-apps (Nov 20, 2026)

Already live on `main`: everything up to PR #2 (`claude/site-sales`: `/test/sales/`, `/test/hub/`, claims/titles
routing, shell cache v6).

What merging this branch adds (approved plan: queuebot repo, docs/design/mockups/nov20b/apps-plan.md):

| Change | Where |
| --- | --- |
| Own icon per app: MG roundel on gold (Store), navy (UW), blue (My Hub), charcoal (Master Sales); 512, 192 (any and maskable) and 180 apple-touch-icon; test copies with a "TEST" band | `icons/<app>-*.png`, `icons/<app>-test-*.png` (24 new files; old icons kept) |
| Names: QB Store / QueueBot Store, QB UW / QueueBot UW, My Hub, QB Sales / QueueBot Master Sales; test: QB Store T, QB UW T, My Hub T, QB Sales T. `id`, `start_url`, `scope` unchanged | the 8 `manifest.webmanifest` |
| Per page: apple-touch-icon, apple-mobile-web-app-title, theme-color, loading image | the 8 `index.html` |
| Root page lists the four apps with their icons | `index.html` |
| Shell cache v7 with the new icons | `sw.js` |
| Checks for each app's manifest, icons and iPhone tags | `test/site.page.js` |

`/preview/` is not changed.

After GitHub Pages deploys, check:

1. https://queuebot.motorygroup.com/ shows Store, UW, My Hub and Master Sales with their icons.
2. On Android, an installed QueueBot app picks up its new name and icon within about a day (no reinstall).
3. On iPhone, delete the saved app and add it again from Safari: the new icon and name show.
4. Pages open before may need one reload to pick up cache v7.

Earlier release notes: see git history of this file.
