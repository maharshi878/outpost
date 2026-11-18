# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com), and versions follow [Semantic Versioning](https://semver.org).

## [Unreleased]

### Security
- API key is now sealed by the OS: Keychain, DPAPI, or libsecret and kwallet on desktop, and the Android Keystore on Android. Before, Android kept it in WebView storage and desktop could fall back to plain text.
- No keyring on Linux means the key is held in memory only, never written to disk. A plain text key left by 0.2.0 is upgraded or deleted on first launch.
- Android requests now run in a native plugin, so the web layer never holds the key. Requests are limited to api.resend.com with redirects off.
- The desktop IPC channel only accepts calls from the app's own window, and dev tools are off in packaged builds.
- Settings gets **Remove key** (one click) and **Erase everything**.

### Added
- Sending limits you can set in Settings, a pre-send check with a "Send anyway" option, and quota errors that are no longer retried pointlessly.
- Sends use an idempotency key and retry on network errors and 5xx without duplicating.
- Tests for the core and the key vault (`npm test`), run in CI.
- LICENSE, CONTRIBUTING, SECURITY, code of conduct, and third party notices.
- Issue and pull request templates, Dependabot, and a CI check for pull requests.
- GitHub Releases are now created automatically from version tags.

### Fixed
- Desktop release workflow uploaded no installers because of a bad artifact path.
- Removed a stray duplicate workflow file and leftover Android template tests.

## [0.2.0]

- Desktop (Electron) and Android (Capacitor) builds from one codebase.
- Send, sync sent history, usage meters, and optional receiving through Resend.
