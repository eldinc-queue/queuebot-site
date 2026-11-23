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
# Site release: branch claude/test-icons (Nov 23, 2026)

Already live on `main`: everything up to PR #3 (`claude/site-apps`: own icon per app, shell cache v7).

What merging this branch adds (approved mockup, option A "TEST sash": queuebot repo, branch claude/mockups-test-icons,
docs/design/mockups/test-icons/, made by make_test_icons.py there):

| Change | Where |
| --- | --- |
| New test app icons: the live icon with the MG circle a little smaller and up-left, and a black sash with TEST in gold across the lower-right corner (a shape that still shows in iOS Tinted and Clear). 512, 192 (any and maskable) and 180 apple-touch-icon, solid RGB, no alpha. Same file names, so manifests and pages are unchanged | `icons/store-test-*`, `icons/uw-test-*`, `icons/hub-test-*`, `icons/sales-test-*` (12 files replaced) |
| Shell cache v9 (v8 is taken by `claude/hub-icons`; when both merge, keep v9 and the file lists of both) | `sw.js` |
| Check that the test icons are solid RGB at the right sizes | `test/site.page.js` |

Live icons, `/preview/` and the manifests are not changed.

After GitHub Pages deploys, check:

1. https://queuebot.motorygroup.com/test/uw/ (and /test/store/, /test/hub/, /test/sales/): Safari > Share > Add to Home
   Screen shows the TEST sash icon.
2. On iPhone, testers remove each saved test app (press and hold > Remove App > Delete from Home Screen) and add it
   again from Safari: iPhone keeps the old icon until then. Turn alerts on again after adding it back.
3. On Android, an installed test app picks up the new icon within about a day (no reinstall).
4. Pages open before may need one reload to pick up cache v9.

Earlier release notes: see git history of this file.
