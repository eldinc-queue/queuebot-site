# queuebot-site

Front door for QueueBot at https://queuebot.motorygroup.com (GitHub Pages).

Static files only: no code that touches data, no keys, no customer data. Each page shows the
QueueBot Apps Script web app full screen in a frame and can be installed as an app.

| Page | Opens |
| --- | --- |
| `/uw/` | UW and Closing dashboard (live) |
| `/store/` | Store dashboard (live). Query strings pass through, e.g. `/store/?store=Bradenton` |
| `/test/uw/`, `/test/store/` | Same, on the test copy |

`config.js` holds the two web app links. `sw.js` caches only the page shell (these files and icons).

Check before pushing: `NODE_PATH=$(npm root -g) node test/site.page.js` (Playwright; uses a local stand-in for the web app).

GitHub Pages: Settings > Pages > Deploy from a branch > `main` / root, custom domain `queuebot.motorygroup.com`, Enforce HTTPS.

## /preview/ (testing the new front door)

`/preview/` holds the new front door from branch `sign-in` (sign-in, store pick, not set up, push bar, demo) so it
can be tried before it replaces the live pages. It is self-contained: its own copies of the scripts, its own
config.js with only the test and demo links (no live link), its own service worker scoped to /preview/. The live
`/uw`, `/store`, `/test/...` and the root files are not touched. Delete the folder when `sign-in` is merged.

- https://queuebot.motorygroup.com/preview/test/store/
- https://queuebot.motorygroup.com/preview/test/uw/
- https://queuebot.motorygroup.com/preview/demo/
