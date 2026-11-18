# Contributing to Outpost

Thanks for helping. Outpost is small on purpose, so a short read here saves everyone time.

## Principles

Changes that break these will not be merged.

1. **Local only.** No servers, accounts, analytics, or update pings. The only network call is to `api.resend.com`, and it lives in `app/core.js`.
2. **The UI stays offline.** The Content Security Policy in `app/index.html` and the request blocker in `main.js` are there on purpose. Do not loosen them.
3. **No runtime dependencies.** `app/` is plain JavaScript and CSS. Dev tooling is fine, bundled libraries need a strong reason.
4. **Stay practical.** Fast, keyboard friendly, and calm. New features should earn their space.

## Layout

    main.js, preload.js   Electron main process and bridge (storage, file picker)
    vault.js              Desktop key storage (the only place the key is read or written)
    android/.../SecureKeyPlugin.java   Android key storage and native requests
    app/core.js           All Resend logic, shared by desktop and Android
    app/platform.js       Platform glue for the UI
    app/app.js, app.css   The interface
    android/              Capacitor Android project

## Running it

    npm install
    npm start

For Android you need JDK 21 and the Android SDK, then `npm run apk`.

## Before you open a pull request

- Open an issue first for anything big, so we can agree on the approach.
- Keep each pull request to one change.
- Run `npm test` and `node --check` on any JavaScript file you touched. CI does the same.
- Test on the platform you changed, and mention which one in the description.
- Do not commit keys, keystores, `local.properties`, or build output.

## Commit style

Short, present tense, one idea per commit: `Fix sync stopping after the first page`.

By contributing you agree that your work is released under the MIT license.
