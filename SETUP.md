# Setting up Coin Ledger

Four things to set up once: a Firebase project to hold your ledger, two GitHub secrets, an Anthropic API key for reading invoices, and the app on your phone. Everything here is free except the API key, which is billed per read.

## 1. Firebase (where your ledger lives)

1. Go to <https://console.firebase.google.com>, choose **Create a project**, name it `Coin Ledger`. You can turn Google Analytics off.
2. **Sign-in:** Build → **Authentication** → Get started → Sign-in method → **Email/Password** → turn on the first switch → Save.
3. **Database:** Build → **Firestore Database** → Create database. Pick a location near you (for example `northamerica-northeast1 (Montréal)`), then **Start in production mode**.
4. **Rules:** in Firestore, open the **Rules** tab, replace everything with the contents of [`firestore.rules`](firestore.rules) from this repository, and press **Publish**. This lets each signed-in person see only their own ledger.
5. **The app's settings:** click the gear next to Project Overview → **Project settings** → General. Under "Your apps" click the web icon `</>`, name it `Coin Ledger`, leave Firebase Hosting unticked, and register it. Copy the `firebaseConfig = { ... }` block it shows.

## 2. GitHub secrets

In this repository: **Settings → Secrets and variables → Actions → New repository secret**. Add two:

| Name | Value |
| --- | --- |
| `FIREBASE_CONFIG` | The `firebaseConfig` block from step 1.5, pasted as it is. |
| `KEYSTORE_PASSPHRASE` | The passphrase Claude gave you in the chat. It unlocks the key that signs the app, so each update installs over the last one. |

Then open **Actions → Build Android app → Run workflow**. In about five minutes a new release appears under **Releases**.

## 3. Install the app

On your phone, open this repository's [latest release](../../releases/latest), download `CoinLedger-1.0.N.apk` and open it. Android asks once to allow installs from your browser or files app. Updates install the same way.

The first time, tap **Create an account** and choose an email and password. Use the same ones on your computer.

Optional: once your account exists, you can stop anyone else from creating one in your project. In Firebase → Authentication → **Settings** → User actions, untick **Enable create (sign-up)**.

## 4. Anthropic API key (reading invoices and receipts)

Slab labels are read on the phone for free. Invoices, receipts, PDFs and labels the phone can't read go to Claude using your own key:

1. Go to <https://console.anthropic.com>, sign up, and add a little credit under **Billing**.
2. Under **API keys**, create a key and copy it.
3. In the app, tap the gear at the top → paste it under **Anthropic API key** → **Check key** → **Save**.

Sonnet 5.5 is the default and the most accurate. Haiku 5.5 is cheaper; you can switch in Settings.

## 5. Optional: the ledger on your computer

1. Repository **Settings → Pages** → Source: **GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables** → New repository variable `WEB_VERSION` with the value `on`.
3. **Actions → Publish web version → Run workflow.** The ledger is then at `https://fntc2014.github.io/Coin-Ledger/`. Sign in with the same email and password.
4. In Firebase → Authentication → Settings → **Authorized domains**, add `fntc2014.github.io`.

## Moving your ledger from the Claude version

In the Claude version, open **Inventory → Back up everything** and save the file. In the app, open **Settings → Restore from a backup** and pick that file.
