# OpsPanel iOS build tools

Public build tooling for the OpsPanel mobile project. Application source stays in its private repository.

The manually triggered environment probe verifies availability of the standard GitHub-hosted macOS runner and its Xcode installation. It receives no private source, credentials or signing material and publishes no application artifacts.

Only the repository owner can execute this probe. It uses the standard `macos-15-intel` runner and has a five-minute timeout.
