# Coin Ledger

An Android app for a coin business: inventory from purchase through grading, consignment and sale, with cost basis, profit, expenses, and Cash and EQ Bank balances.

- Add coins by hand, or by photographing a slab label (read on the phone, free and offline) or an invoice, receipt or PDF (read by Claude with your own API key)
- Every coin's cost includes its share of fees, buyer's premium, shipping and tax, spread by price
- Grading submissions with ICCS pricing and 13% HST, consignments to auction houses, auction results
- Sales that are paid later, collected by buyer
- Syncs through your own Firebase project, works offline, and runs in a browser on your computer too

## Install

Open the [latest release](../../releases/latest) on your phone, download the APK and open it. First-time setup is in [SETUP.md](SETUP.md).

## Build

Every push to `main` builds a signed APK with GitHub Actions and publishes it as a release. The page lives in `src/` and is built three ways by `npm run build`:

- `www/` — the Android app (Capacitor)
- `site/` — the same app for a browser, published to GitHub Pages when turned on
- `dist/coin-ledger.html` — the claude.ai artifact version

`src/core.js` is the ledger itself and is shared by all three. `src/platform-app.js` and `src/platform-artifact.js` connect it to Firebase and the phone, or to the artifact's own storage.
