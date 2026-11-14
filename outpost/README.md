# Outpost

A local-only mail app for your own [Resend](https://resend.com) API key. Desktop and Android, one codebase.
No server, no account, no telemetry. Paste a key, send from your verified domain, browse everything you have sent.

## Desktop

    npm install
    npm start          # run
    npm run dist       # installer for your OS (dist/)

## Android APK

Easiest: push this folder to GitHub, open Actions, run **android**, download `outpost-apk` (a debug APK you can sideload).

Locally (needs JDK 21 and the Android SDK, or just Android Studio):

    npm install
    npm run apk        # android/app/build/outputs/apk/debug/app-debug.apk

For a Play Store or signed release build, open `android/` in Android Studio and use Build > Generate Signed Bundle.

## How it works

- `app/core.js` holds all Resend logic and is shared by both builds. Only the storage, key and file-picker glue differs.
- Desktop: the Electron main process makes every request to `api.resend.com`, key encrypted with the OS keychain.
- Android: Capacitor's native HTTP carries the same requests (no CORS), mail cache in IndexedDB, backup to Google disabled.
- The UI has no network access. Remote images in messages are blocked, so there are no tracking pixels.
- Use a **Full access** key to sync sent history. A Sending access key still sends.
- Usage meters count what Resend recorded for your key (free plan: 100 a day, 3,000 a month).

## Receiving

Outpost suggests Cloudflare Email Routing (free), which forwards to an inbox you already read.
To read replies inside Outpost, turn on Resend receiving for a domain or subdomain.

Keys: `c` compose, `/` search, `j` `k` move, `Ctrl+Enter` send. On phone: pull down to sync, swipe back to leave a message.
