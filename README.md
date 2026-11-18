# Outpost

[![ci](https://github.com/maharshi878/outpost/actions/workflows/ci.yml/badge.svg)](https://github.com/maharshi878/outpost/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A local-only mail app for your own [Resend](https://resend.com) API key. Desktop and Android, one codebase.

No server, no account, no telemetry. Paste a key, send from your verified domain, browse everything you have sent.

<!-- Add a screenshot or short demo GIF here: docs/screenshot.png -->

## Why

Hosted mail tools charge you to put a nice interface on top of an API you already pay for. Outpost is that interface, running entirely on your machine. Your key and your mail never touch anyone's server but Resend's.

## Download

Grab the latest build from the [Releases](https://github.com/maharshi878/outpost/releases) page.

| Platform | File |
| --- | --- |
| Windows | `.exe` installer |
| macOS | `.dmg` |
| Linux | `.AppImage` |
| Android | `outpost-debug.apk` (sideload) |

The builds are unsigned, so Windows SmartScreen and macOS Gatekeeper will warn you on first launch. The Android APK is signed with a debug key. If that bothers you, build it yourself below.

## Setup

1. In Resend, [add and verify a domain](https://resend.com/domains).
2. Create an API key. Use **Full access** to sync sent history and see domains. A **Sending access** key can still send.
3. Open Outpost and paste the key.

## Build from source

Needs Node 20 or newer.

    npm install
    npm start          # run the desktop app
    npm run dist       # installer for your OS (dist/)

### Android

Easiest: fork this repo, open Actions, run **android**, and download the `outpost-apk` artifact.

Locally (JDK 21 and the Android SDK, or Android Studio):

    npm install
    npm run apk        # android/app/build/outputs/apk/debug/app-debug.apk

For a Play Store or signed release build, open `android/` in Android Studio and use Build > Generate Signed Bundle.

## How it works

- `app/core.js` holds all Resend logic and is shared by both builds. Only the storage, key and file-picker glue differs.
- Desktop: the Electron main process makes every request to `api.resend.com`. The key is encrypted by the OS keychain, held only in that process, and never given to the interface. With no keyring (some Linux setups) it stays in memory and is never written to disk.
- Android: the key is sealed by the Android Keystore and a small native plugin makes the requests, so the web layer never holds it. Mail cache lives in IndexedDB, and backup to Google is disabled.
- Remove your key any time in Settings with one click, or erase everything. See [SECURITY.md](SECURITY.md) for exactly what is and is not protected.
- Sending is paced for Resend's 2 requests per second, retried safely on network errors (sends carry an idempotency key, so no duplicates), and checked against your daily and monthly limits first. You can raise the limits in Settings if you are on a paid plan.
- The UI has no network access. Remote images in messages are blocked, so there are no tracking pixels.
- Message bodies render in a sandboxed iframe with scripts disabled.
- Usage meters count what Resend recorded for your key (free plan: 100 a day, 3,000 a month).

See [SECURITY.md](SECURITY.md) for the full list of guarantees and how to report a problem.

## Receiving

Outpost suggests Cloudflare Email Routing (free), which forwards to an inbox you already read.
To read replies inside Outpost, turn on Resend receiving for a domain or subdomain.

## Keyboard

`c` compose, `/` search, `j` `k` move, `Ctrl+Enter` send. On phone: pull down to sync, swipe back to leave a message.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first, it is short. The one rule that matters: nothing in this app may phone home.

## License

[MIT](LICENSE). Bundled fonts are under the SIL Open Font License, see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
Outpost is an independent project and is not affiliated with Resend.
