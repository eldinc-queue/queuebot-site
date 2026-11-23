# Site release: branch claude/hub-icons (Nov 23, 2026)

Already live on `main`: everything up to PR #3 (`claude/site-apps`: own icon per app, shell cache v7).

What merging this branch adds (approved mockup: queuebot repo, branch claude/mockups-hub-icon, docs/design/mockups/hub-icon/):

| Change | Where |
| --- | --- |
| My Hub with a flag icon: `/hub/co/` (Colombia), `/hub/mx/` (Mexico), `/hub/us/` (USA). Same My Hub page, own home screen app | `hub/co/`, `hub/mx/`, `hub/us/` (index.html + manifest.webmanifest each) |
| Flag icons, 512, 192 (any and maskable) and 180 apple-touch-icon, solid RGB | `icons/hub-co-*`, `icons/hub-mx-*`, `icons/hub-us-*` (9 new files) |
| Shell cache v8 with the new pages, manifests and icons | `sw.js` |
| Checks for each flag page (live link, page=hub, own manifest id, icons, shared scripts) | `test/site.page.js` |

`/hub/` (Default icon) and `/preview/` are not changed. QueueBot shows each person their link on My Hub
("Put My Hub on your phone", queuebot branch `claude/hub-icons`); the site works on its own before that.

After GitHub Pages deploys, check:

1. https://queuebot.motorygroup.com/hub/co/ opens My Hub; on iPhone, Share > Add to Home Screen shows the Colombia icon.
2. Same for /hub/mx/ (Mexico) and /hub/us/ (USA).
3. Pages open before may need one reload to pick up cache v8.

Earlier release notes: see git history of this file.
