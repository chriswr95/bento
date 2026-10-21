# Agent-guided source setup

Use this runbook to build and install Bento for a first trial on the user's Windows PC or Mac. Build locally on the target computer. Do not use the unsigned release downloads or disable OS security controls. If a managed computer blocks installation or execution, report the specific policy/error and let the user involve IT.

## Scope and prerequisites

- Preserve existing repositories, installations, settings, and workspace files. Reuse a suitable checkout only after inspecting its Git status; never reset or discard local changes.
- Keep application source, installed application, and user workspace in separate folders. Use fictional example content for verification.
- Detect OS and CPU architecture. The package script builds for the current Node architecture; use a native Node installation rather than an emulated one.
- Use **Git**, **Node.js 24.x with npm**, and **pnpm 11.25.0**. Check `git --version`, `node --version`, `npm --version`, and `node -p process.arch` first. If missing, install Git and Node 24 from their official distributions using an available trusted package manager or official installer. Do not replace a working unrelated toolchain without explaining the change.
- The commands below use `npx` to select the pinned pnpm version, so no global pnpm installation is necessary. Network access is needed for the clone, npm dependencies, and Electron runtime download.
- GitHub authentication is not required for this public repository. A coding-agent account is separate from repository access.

## Get the tested source

Choose an unused development directory, such as a `bento` folder under the user's projects directory, then run:

```sh
git clone --branch v0.1.0-preview.1 --depth 1 https://github.com/chriswr95/bento.git bento
cd bento
git rev-parse HEAD
```

This tag includes the refreshed welcome and walkthrough. It should resolve to `7731e8225234e152bd5b805205f5567119711733`. A detached checkout is expected. Follow this runbook even though the README at that older tag leads with downloads. Read the checkout's `AGENTS.md` before working in it.

If reusing a checkout, preserve its changes and use a separate checkout for the tagged build if necessary. Record the revision; do not silently substitute a newer branch. Do not clone into or build inside the user's Bento workspace.

## Build and verify

These commands work in PowerShell or a Mac shell, from the repository root:

On Windows, invoke `npx.cmd` instead of `npx` if PowerShell blocks the `npx.ps1` shim; similarly use `npm.cmd` for prerequisite checks. Do not change execution policy to run these commands.

```sh
npx --yes pnpm@11.25.0 install --frozen-lockfile
npx --yes pnpm@11.25.0 setup:desktop
npx --yes pnpm@11.25.0 lint
npx --yes pnpm@11.25.0 test
npx --yes pnpm@11.25.0 package
node scripts/smoke-package.js
```

`package` builds the editor and a native app with its runtime dependencies. `smoke-package.js` launches that actual bundle in hidden/offscreen test mode and checks the welcome screen, example creation, editing, walkthrough navigation, and restart using disposable folders. Leave `BENTO_TEST_SHOW_WINDOW` unset. A nonzero exit is a failed check: investigate before installing. Do not claim that packaging alone proves the app launches.

If newly installed tools are missing from PATH, refresh the terminal environment and verify their versions again. If dependency or Electron downloads fail, retain the error and fix the network/tool issue; do not bypass certificate verification. Do not edit the lockfile just to get setup working.

## Install on Windows

Copy the **entire** `dist/Bento-win32-<arch>` folder, including its runtime files, to `%LOCALAPPDATA%\Programs\Bento`. Do not copy only Bento.exe. For a first installation, use PowerShell:

```powershell
$bentoArch = node -p process.arch
$bentoSource = Join-Path (Get-Location) "dist\Bento-win32-$bentoArch"
$bentoInstall = Join-Path $env:LOCALAPPDATA 'Programs\Bento'
if (Test-Path -LiteralPath $bentoInstall) { throw 'Bento already exists here. Follow the update procedure below.' }
$bentoShortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Bento.lnk'
if (Test-Path -LiteralPath $bentoShortcutPath) { throw 'A Bento shortcut already exists. Inspect it before choosing a shortcut name.' }
New-Item -ItemType Directory -Path (Split-Path $bentoInstall) -Force | Out-Null
Copy-Item -LiteralPath $bentoSource -Destination $bentoInstall -Recurse
$bentoExe = Join-Path $bentoInstall 'Bento.exe'
$bentoShortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($bentoShortcutPath)
$bentoShortcut.TargetPath = $bentoExe
$bentoShortcut.WorkingDirectory = $bentoInstall
$bentoShortcut.Save()
```

Check whether a Bento desktop shortcut already exists before creating it; preserve an unrelated shortcut rather than overwriting it. Verify `Bento.exe` exists, then open it for the user with `Start-Process -FilePath $bentoExe`. Future launches use the desktop shortcut; no terminal is needed.

## Install on Mac

Install into the user's Applications folder, without administrator privileges. For a first installation:

```sh
mkdir -p "$HOME/Applications"
if [ -e "$HOME/Applications/Bento.app" ]; then
  echo 'Bento already exists here. Follow the update procedure below.'
  exit 1
fi
bento_arch="$(node -p process.arch)"
ditto "dist/Bento-darwin-$bento_arch/Bento.app" "$HOME/Applications/Bento.app"
codesign --verify --deep --strict "$HOME/Applications/Bento.app"
open "$HOME/Applications/Bento.app"
```

`ditto` preserves the app's internal symlinks and signature. This local build uses ad-hoc integrity signing, not a verified Developer ID. Launch it from the user's Applications folder thereafter; the user can keep it in the Dock. Do not overwrite a different copy in `/Applications`; identify which copy the user intends to run.

## First launch and handoff

Open the installed app only after the hidden checks pass. Let the user choose **Try an example workspace**, then create/select an empty folder outside the source and installation directories. Do not choose a folder containing real project data for the sample. The tour ends with **Create my workspace** or **Keep exploring**.

Report:

- Source tag and full Git revision, OS, and build architecture.
- Which checks passed, and any remaining failure or OS restriction.
- The exact installed app/executable and shortcut locations.
- How to launch Bento again and where the user chose to store their workspace, if known.

The coding agent is being used to install the app. This does not configure an agent integration inside Bento or authorize access to the user's real project documents.

## Updating or recovering later

1. Quit Bento. Preserve the user's workspace folders and per-user settings.
2. Inspect the source checkout for changes. Use an explicitly selected revision and repeat the build and smoke checks.
3. Keep the previous installed app in a clearly named backup location before replacing it. Copy the whole new bundle/folder; do not merge Windows runtime files from different builds.
4. Verify the installed copy and update the existing shortcut if needed. Retain the old application until the user has tried the replacement.

Preview workspace formats can change. Make a separate copy of important workspace files before trying a different preview revision; keeping an old executable alone is not a data rollback. Do not remove settings, drafts, or workspaces to repair an installation.

For development without installing a separate app, `npx --yes pnpm@11.25.0 start` runs from the checkout. That development process must remain running; prefer the packaged installation above for Makena's trial.
