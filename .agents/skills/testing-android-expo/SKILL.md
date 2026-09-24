---
name: testing-android-expo
description: Test GradeSmart Android startup and guest navigation in Expo Go or an isolated local standalone release, safely disabling real AI credentials.
---

# GradeSmart Android runtime testing

## Safety and Devin Secrets Needed

- No secrets are required for guest mode.
- Authenticated language settings require a dedicated test account: suggested
  secret names `GRADESMART_TEST_EMAIL` and `GRADESMART_TEST_PASSWORD`, plus any
  required OTP access. These are not currently configured.
- Inspect AIProvider and openaiService before launch: startup may automatically
  call a chat-completions endpoint, even on the signup screen.
- Never display app.json or raw Expo config when it contains credentials.
- For non-AI testing, supply a clearly invalid nonempty
  `EXPO_PUBLIC_OPENROUTER_API_KEY=invalid-gradesmart-runtime-test-no-billing`.
  Verify app.config.js and all API consumers still honor this override and
  verify the resolved manifest contains it without printing secrets. Check
  for other provider keys, especially `EXPO_PUBLIC_OPENAI_API_KEY`.
  An empty override can fall back to a committed key.

## Runtime prerequisites

Read the current environment blueprint first; it includes Node/npm and Android
command-line tools, SDK/AVD setup, and pinned Expo Go installation:

```sh
source "$HOME/.nvm/nvm.sh"
nvm use 24.19.0
```

On Linux, use Java17 and an accessible /dev/kvm. Verify emulator acceleration
with `emulator -accel-check`. Grant only the required local user access if needed;
do not make KVM world-writable.

Verified runtime: Android15/API35 Google APIs x86_64, Pixel5 AVD, Expo Go54.0.8.
Install Android command-line tools under `$HOME/Android/Sdk/cmdline-tools/latest`.
Install SDK packages `platform-tools`, `emulator`, and
`system-images;android-35;google_apis;x86_64`; accept licenses as appropriate.
Create an AVD with `avdmanager create avd -n GradeSmart_API35
-k 'system-images;android-35;google_apis;x86_64' -d pixel_5`.

Launch with:

```sh
"$HOME/Android/Sdk/emulator/emulator" -avd GradeSmart_API35 \
  -no-snapshot -no-boot-anim -gpu swiftshader_indirect -no-audio
```

First boot may take several minutes under nested virtualization.
`adb wait-for-device` alone does not establish readiness; wait until
`adb shell getprop sys.boot_completed` is `1` before `adb install`.
An early install may fail with "Can't find service: package".

Resolve the SDK-compatible Expo Go APK via
`https://api.expo.dev/v2/versions/latest`, field
`sdkVersions["54.0.0"].androidClientUrl`, rather than installing latest Go blindly.
Install APK with adb and set `adb reverse tcp:8081 tcp:8081`.

## Metro and connectivity

From the repo root:

```sh
EXPO_OFFLINE=1 \
EXPO_PUBLIC_OPENROUTER_API_KEY=invalid-gradesmart-runtime-test-no-billing \
CI=1 npx expo start --localhost --clear
```

If Expo Go reports "Failed to download remote update", inspect Metro output.
In CI, Expo project metadata lookup may require an Expo login. `EXPO_OFFLINE=1`
avoids that lookup while leaving Android/backend network access intact.
Do not combine `--offline` and `--localhost` (mutually exclusive CLI flags).
Verify local `/status` and Android manifest response without printing config keys.

Open `exp://127.0.0.1:8081` in Expo Go. Dismiss its initial developer-menu tutorial.
For input, `adb shell input text` can type URLs if desktop clipboard paste does
not reach Android. Prefer GUI taps for ordinary app interactions.

## Relevant UI paths and coverage

- First installation: Create Account → scroll down → Continue as Guest.
- Dashboard top-right person icon → guest profile.
- Dashboard View Results → Test History.
- Guest profile has no Language setting. Authenticated path is
  Profile → Settings → Language; do not claim it was tested via guest mode.
- Language default/storage lives in src/i18n/index.js. Confirm whether source
  actually calls expo-localization before claiming device locale coverage.
- Entering guest mode marks the app seen; after force-stopping Expo Go and
  reopening the project, Login rather than Signup is expected.
- Compare guest-limit copy against `GUEST_TEST_LIMIT` in ScansContext rather
  than assuming signup/profile text matches the enforced limit.
- Expo Go runtime evidence does not validate a standalone release APK,
  native config plugins, file operations, camera, or AI workflows.

## Isolated local standalone diagnostic release

Use for approved UI testing that requires a standalone build. Do not substitute
this build for a specific EAS artifact; distinguish missing artifact access
from an app launch failure. Build without cloud credentials or upload signing.

- Export the exact requested commit with git archive into a separate persistent
  home directory. Run npm ci there. Keep the root checkout and cloud settings
  untouched. State any diagnostic configuration differences.
- Set BOTH `EXPO_PUBLIC_OPENROUTER_API_KEY` and
  `EXPO_PUBLIC_OPENAI_API_KEY` to invalid nonempty placeholders before config,
  prebuild, and Gradle. Verify resolved `npx expo config --json` using assertions
  without printing it. If a key is not forwarded by app.config.js, apply the
  diagnostic override only in the isolated copy and report that difference.
- Run `npx expo prebuild --platform android --no-install` only in that copy.
  Prebuild may alter package.json scripts; verify dependency/lockfile identity.
- Set ANDROID_HOME and ANDROID_SDK_ROOT to `$HOME/Android/Sdk`.
  SDK54/RN0.81.5 resolved compile/target36, build-tools36.0.0,
  NDK27.1.12297006, CMake3.22.1, Java17 and Gradle8.14.3 in this environment.
  Gradle can install missing accepted-license SDK packages automatically.
- Inspect generated release signing: diagnostic builds can use
  `signingConfig signingConfigs.debug`; never present this as store signing.
  From android/, build `./gradlew app:assembleRelease
  -PreactNativeArchitectures=x86_64 --max-workers=4
  -Dorg.gradle.jvmargs='-Xmx4g -XX:MaxMetaspaceSize=1g' --console=plain`.
  Keep the invalid AI-key environment set during Gradle; it invokes Metro
  bundling and Expo config evaluation. No running Metro server is required.
- If Maven Central returns429, do not repeatedly retry. Check reachability of
  official hostnames and the Google-hosted Maven Central mirror at
  `https://maven-central.storage-download.googleapis.com/maven2`.
  A temporary external Gradle init script may redirect MavenArtifactRepository
  URLs for repo.maven.apache.org/repo1.maven.org. Cover beforeSettings
  pluginManagement/dependencyResolutionManagement and allprojects buildscript
  and project repositories. Keep Google Maven and plugin portal otherwise
  intact; do not rewrite source or generated project repository declarations.
  The blueprint can provision `$HOME/Android/central-mirror.init.gradle`;
  when present, pass `-I "$HOME/Android/central-mirror.init.gradle"` to Gradle.
- APK is normally android/app/build/outputs/apk/release/app-release.apk.
  Inspect with build-tools aapt and apksigner, compute SHA256, verify both
  placeholders in assets/app.config, and assert original key bytes are absent
  from APK assets without printing them. Keep APK/config/build logs private.
- `adb install` after boot completion; run com.gradesmart.app/.MainActivity.
  For unknown production APKs, first launch with airplane mode on and Wi-Fi/
  mobile data disabled; environment variables cannot override compiled keys.
  Only restore networking after safe embedded keys are verified and network
  behavior is in scope. Explicitly label offline UI evidence.
- Clear logcat immediately before the test. Verify signup, guest dashboard,
  profile/history and force-stop/reopen. Guest state is in memory; relaunch
  shows Login. Collect AndroidRuntime/ReactNativeJS/ReactNative errors and
  crash buffer after testing, sanitizing original config values before output.
- x86_64-only/API35 evidence does not prove ARM hardware, EAS production
  environment, store signing, authenticated language or live backend behavior.

## Evidence

Record the emulator GUI with annotations. Capture legible native screenshots
using `adb exec-out screencap -p > /absolute/path.png`.
Inspect filtered `AndroidRuntime:E` and `ReactNativeJS:W` logs; raw ReactNativeJS
startup logs can include full manifests and credentials, so avoid dumping them.

## Auth restoration and bogus-login smoke testing

- When switching branches, run npm ci against the checked-out lockfile before
  starting a fresh Metro cache; do not reuse another branch's node_modules.
- For Expo Go, set BOTH AI provider environment variables to invalid nonempty
  values. Verify manifest fallback values and the served Android bundle before
  restoring emulator networking. Some Babel versions use an Expo virtual env
  module instead of literal replacement at each process.env reference; inspect
  the generated environment definitions rather than assuming one transform.
  Fail closed: chain safety verification and network enablement with &&.
- Timestamp and allowlist Metro lines containing [AUTH], [LOGIN], [DASHBOARD]
  and relevant bundling/error messages. Never publish full manifest dumps.
  Metro receipt timestamps measure observed log intervals, not precise internal
  instrumentation latency. Display sanitized logs beside the emulator when
  documenting hangs or timeouts.
- A no-session launch should log Restoring session... then No session found,
  not Session restoration timed out. Guest dashboard should show numeric stats.
  Guest state is not a stored authenticated session; this flow does not exercise
  authenticated role/notifications queries or server tests/scans hydration.
- After force-stop, an Expo Go VIEW intent can return to Android Home without
  new JS logs. Capture this failure, inspect crash buffer and PID, then try one
  second intent to the same exp URL. Distinguish LauncherActivity routing from
  an app auth spinner; report the retry instead of silently calling it a pass.
- An explicitly authorized bogus email/password using example.invalid can
  exercise login rejection without a real account. Do not trigger OTP, signup,
  forgot-password or social login as substitutes.
- Error toasts last roughly2s. Prepare screenshot capture triggered by the
  [LOGIN] Login failed log, delayed about0.4s for toast animation, before clicking
  Sign In; also verify pixels and return of the Sign In button. Then enter guest
  mode to prove the app remains usable. Do not resubmit just to recapture a toast.
- Without authenticated credentials, report persisted-session deadlock,
  authenticated15s request timeout and sync-error banner as UNTESTED even if
  no-session restoration and bogus-login rejection pass.
