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
- The API key is only ever stored encrypted by the operating system (see below), is never handed back to the interface, and is never sent anywhere except `api.resend.com`.
- No telemetry, analytics, crash reporting, or update pings.
- Message bodies render in a sandboxed iframe with scripts disabled and remote images blocked.
- Android cloud backup is disabled so mail and keys are not copied to Google.

## Where the key lives

| Platform | Storage | Notes |
| --- | --- | --- |
| macOS | Keychain via Electron `safeStorage` | Encrypted file, key held by the Keychain |
| Windows | DPAPI via `safeStorage` | Tied to your Windows account |
| Linux | GNOME Keyring or KDE Wallet via `safeStorage` | With no keyring the key is kept in memory only and never written to disk. You re-enter it each launch. Electron would otherwise fall back to plain text, Outpost refuses to. |
| Android | Android Keystore, AES-256-GCM, non-exportable (hardware backed where the device has it) | The web layer only holds the placeholder `@vault`. A native plugin adds the real key and talks only to `api.resend.com`, with redirects off. |

Only Outpost's own code reads the key. On desktop the main process owns it and refuses requests from anything but the app window. On Android the Keystore key can only be used by this app.

**Removing it.** Settings, Your key, **Remove key** deletes the stored key in one click (the encrypted file and memory copy on desktop, the ciphertext and the Keystore key on Android). **Erase everything** also wipes cached mail and drafts. To fully kill a key, also delete it in the Resend dashboard, since a key you pasted elsewhere stays valid until revoked.

**What this does not cover.** On Windows and Linux, any program running as your own user can in principle ask the OS to decrypt what Outpost encrypted, the same as for any desktop app. Malware with root, or a rooted phone, defeats all of this. The cached mail (not the key) is stored unencrypted inside Outpost's private data folder, readable only by your user (desktop) or the app sandbox (Android). Use disk encryption.

## Out of scope

- Anything that needs an attacker to already control your device or your Resend account.
- Debug APKs from CI are signed with a debug key. Build your own signed release if that matters to you.
