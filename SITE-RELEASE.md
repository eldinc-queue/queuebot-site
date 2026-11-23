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
