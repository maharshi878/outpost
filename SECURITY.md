# Security

Outpost handles an API key that can send email from your domain, so security reports matter.

## Reporting a vulnerability

Please do **not** open a public issue. Use GitHub's private reporting instead:
open the **Security** tab of this repository and choose **Report a vulnerability**.

Include what you found, how to reproduce it, and which platform (desktop or Android). You should get a reply within a few days.

## Supported versions

Only the latest release gets fixes.

## What the design promises

These are the guarantees Outpost tries to keep. A bug that breaks one of them is a security bug.

- The UI layer has no network access. Only the core module talks to `api.resend.com`.
- The API key is stored with the OS keychain on desktop and is never sent anywhere except Resend.
- No telemetry, analytics, crash reporting, or update pings.
- Message bodies render in a sandboxed iframe with scripts disabled and remote images blocked.
- Android cloud backup is disabled so mail and keys are not copied to Google.

## Out of scope

- Anything that needs an attacker to already control your device or your Resend account.
- Debug APKs from CI are signed with a debug key. Build your own signed release if that matters to you.
