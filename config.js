/* Where each page points. Only public web app links live here: no keys, no data. */
window.QB_SITE = {
  // Push alerts (push.js, docs/notifications.md in the queuebot repo). Firebase console > Project settings:
  // General > Your apps (web app) for the first four, Cloud Messaging > Web Push certificates > Key pair for vapidKey.
  // Public values, not secrets. Left empty, push stays off and alerts still show inside QueueBot.
  firebase: { apiKey: "", projectId: "", messagingSenderId: "", appId: "", vapidKey: "" },
  // Google sign-in client (not a secret). Google Cloud > Google Auth Platform > Clients.
  clientId: "878847989346-q3fgt5pooha0l5dv5uj62pms3vorqt2h.apps.googleusercontent.com",
  // Demo copy web app link (QueueBot DEMO project), for /demo.
  demo: "https://script.google.com/macros/s/AKfycbymoHcLczZu3uIuq7cc9_6xgIOyB5fDKx3oDNLNovzBnNDq_WmEEPYevJyzJogBYk2lzA/exec",
  live: "https://script.google.com/macros/s/AKfycbwDmTJo7qqLT2c9HLK6xoxvirP5-uQ3DxSpo4WhQ-Hbpw6AugBHZq0xKCLYboZ05_5YrA/exec",
  // Test copy web app link (Apps Script TEST project > Deploy > Manage deployments > Web app URL).
  test: "https://script.google.com/macros/s/AKfycbwSx8bp03qtEHK_tEYkoN9O5XUMIDgXkMmZYPtMb9fSEyOjlmLlcrFSpQSbJCJrjoC1CA/exec"
};
