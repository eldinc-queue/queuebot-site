# Site release: branch claude/site-sales (Nov 10, 2026)

Already live on `main` (PR #1, merged Nov 6, 2026 from `claude/release-1-site`):
`/sales/`, `/hub/`, the root sign-in screen (`signin.js`, `signin-ui.js`, `signin.css`), shell cache v5.

What merging this branch adds:

| Change | Where |
| --- | --- |
| `/test/sales/`: Master Sales on the test copy (`page=sales`) | `test/sales/` |
| `/test/hub/`: My Hub on the test copy (`page=hub`, Eldin only) | `test/hub/` |
| Sign-in routing: someone whose roles are only claims and/or titles (no store, uw, closer, manager or admin permission) goes to Master Sales instead of "Coming soon": claims only `sales/?view=val`, titles only `sales/?view=titles`, both `sales/`. On a test page they go to `test/sales/`. Mixed roles keep today's routing; store-only on `/uw` still goes to `/store`; insurance or collections alone still "Coming soon". | `signin-ui.js` (root, live) and `preview/signin-ui.js` |
| Shell cache v6 with the two test pages | `sw.js` |

After GitHub Pages deploys, check:

1. https://queuebot.motorygroup.com/test/sales/ opens Master Sales on the TEST copy (tab title "QueueBot Sales TEST").
2. https://queuebot.motorygroup.com/test/hub/ opens My Hub on the TEST copy.
3. /uw/, /store/, /sales/ still open (pages that were open before may need one reload to pick up cache v6).
4. With a claims-only or titles-only test person, sign in on /test/uw/: lands on /test/sales/ with Valuation or Titles.
5. The test web app answers `page=sales` (Master Sales deployed on the TEST Apps Script project, new version).
