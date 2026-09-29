# OpsPanel iOS build tools

Public build tooling for the OpsPanel mobile project. Application source stays in its private repository.

The manually triggered environment probe verifies availability of the standard GitHub-hosted macOS runner and its Xcode installation. It receives no private source, credentials or signing material and publishes no application artifacts.

Only the repository owner can execute this probe. It uses the standard `macos-15-intel` runner and has a five-minute timeout.

## iOS device build

`ios.yml` builds a source snapshot on the standard macOS runner with Xcode 26.2. It runs mobile tests, generates the iOS project, installs CocoaPods, archives without distribution signing and invokes the source repository's device-lab packager. This is for the owner's authorized iPhone lab, not an App Store or TestFlight upload.

Application source is supplied as an AES-256-GCM authenticated encrypted `source.enc` asset on a temporary `input-*` release. A fresh 32-byte key is kept in the owner's local private directory and in the `BUILD_BUNDLE_KEY` Actions secret. No private-repository access token, Apple account or signing credential is supplied to this repository.

Only the owner can dispatch the main-branch build. Compiler output goes to private files; both failure logs and successful packages are returned inside an encrypted `result.enc` release asset. Source snapshots and results are never committed to git. No shared caches or Actions artifacts are used. Run one input bundle at a time, verify and decrypt the result locally, then remove temporary input/result releases and the build-key secret. Retain the private key only until the result has been retrieved.

Local tool checks: `node --test ci/bundle.test.mjs` and `bash -n ci/build-ios.sh`. `ci/bundle.mjs seal INPUT OUTPUT` and `open INPUT OUTPUT` read a 64-character lowercase hex key from `BUILD_BUNDLE_KEY`; do not print or commit this key. The bundle tool limits plaintext to 256 MiB, authenticates before writing and refuses to overwrite output files.
