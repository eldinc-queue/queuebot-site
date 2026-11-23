# queuebot-site

Front door for QueueBot at https://queuebot.motorygroup.com (GitHub Pages).

Static files only: no code that touches data, no keys, no customer data. Each page shows the
QueueBot Apps Script web app full screen in a frame and can be installed as an app.

| Page | Opens | App name (under the icon) / full name | Icon and `theme_color` |
| --- | --- | --- | --- |
| `/store/` | Store dashboard (live). Query strings pass through, e.g. `/store/?store=Florence` | QB Store / QueueBot Store | gold #e6a51a, navy letters |
| `/uw/` | UW and Closing dashboard (live) | QB UW / QueueBot UW | navy #004781 |
| `/hub/` | My Hub (live, `page=hub`; Eldin only) | My Hub / My Hub | blue #0e76bc |
| `/hub/co/`, `/hub/mx/`, `/hub/us/` | My Hub, same page, with a flag icon (Colombia, Mexico, USA). QueueBot shows each person their own link from the Hub icon column on Users | My Hub / My Hub | the flag with the MG circle (`icons/hub-co-*`, `hub-mx-*`, `hub-us-*`) |
| `/sales/` | Master Sales Dashboard (live, `page=sales`) | QB Sales / QueueBot Master Sales | charcoal #444444 |
| `/test/store/`, `/test/uw/`, `/test/hub/`, `/test/sales/` | Same, on the test copy | QB Store T, QB UW T, My Hub T, QB Sales T / name + " TEST" | same icons with a "TEST" band |
| `/demo/` | The demo copy: password, role picker, gold DEMO bar | | |

## Home screen apps

Each page above is its own app with its own manifest (`id`, `start_url`, `scope` all `./`), icon and color, so a
phone can hold QB Store, QB UW, My Hub and QB Sales side by side. Icons are in `icons/`: `<app>-192.png`,
`<app>-512.png` (also the maskable icon: the color runs to the edge, the MG roundel sits inside the safe zone),
`<app>-apple-180.png` (iPhone), and `<app>-test-*` for the test pages. The old `icon-*`, `maskable-512.png` and
`apple-touch-icon.png` stay for the root page, the favicon and `/preview/`. The root page lists the four apps.

Getting the new icon on a phone that already has the app:

- **Android:** nothing to do. Chrome checks the manifest now and then and updates the name and icon by itself
  (the `id` did not change, so it is the same app).
- **iPhone / iPad:** the icon and name are fixed when the app is added. Press and hold the old icon > Remove App >
  Delete from Home Screen, then open the address in Safari > Share > Add to Home Screen. Alerts on iPhone belong to
  the saved app, so turn them on again after adding it back.

My Hub icon per person: the icon is fixed by the page the person saves, so each flag is its own folder. `hub/co/`,
`hub/mx/` and `hub/us/` hold only an `index.html` (a copy of `hub/index.html` with `../../` paths and its own
apple-touch-icon and loading image) and a `manifest.webmanifest` (own `id`/`start_url`/`scope`, flag icons). Scripts and
styles are the shared root files. A change to `hub/index.html` goes into the three copies too. Changing someone's flag
later: they remove My Hub from the home screen and add it again from the new link.

The test apps use short names with " T" ("QB Store T", "QB UW T", "My Hub T", "QB Sales T") because iPhone cuts
names longer than about 10 letters.

Sign-in: `signin.js` hands the session or Google's ID token to the web app in the frame; `signin-ui.js` and
`signin.css` are the screens (sign in, store pick, not set up; "Open in Chrome to sign in" inside apps' own
browsers, the list is `IN_APP` in `signin-ui.js`; "Continue without signing in" in audit mode). Details in the
queuebot repo, docs/sign-in.md and docs/demo.md.

`config.js` holds the web app links (live, test, demo) and the Google sign-in client ID. `sw.js` caches only the page shell (these files and icons).

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
