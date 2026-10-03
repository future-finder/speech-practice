# Contributing to Speech Practice

Thank you for helping improve the public beta.

## Before opening an issue

Search existing issues first. Do not post API keys, tokens, credentials, private recordings, or personal data. For a bug, include the app version, Windows version, selected model/provider, and concise reproduction steps.

## Pull requests

Keep changes focused on the current desktop practice workflow. Preserve the local-first behavior and do not add data collection or research-participant features without a separate design decision. Run the relevant Python tests and `npm.cmd run build` before opening a pull request.

## Model and dependency changes

Do not commit model weights, caches, installers, or user recordings. Update `THIRD_PARTY_NOTICES.md` and the model manifest when changing distributed dependencies or download sources.
