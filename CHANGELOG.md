# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com), and versions follow [Semantic Versioning](https://semver.org).

## [Unreleased]

### Added
- LICENSE, CONTRIBUTING, SECURITY, code of conduct, and third party notices.
- Issue and pull request templates, Dependabot, and a CI check for pull requests.
- GitHub Releases are now created automatically from version tags.

### Fixed
- Desktop release workflow uploaded no installers because of a bad artifact path.
- Removed a stray duplicate workflow file and leftover Android template tests.

## [0.2.0]

- Desktop (Electron) and Android (Capacitor) builds from one codebase.
- Send, sync sent history, usage meters, and optional receiving through Resend.
