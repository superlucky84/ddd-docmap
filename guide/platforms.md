# Windows, Linux, and WSL

[README](../README.md) · [Document map](document-map.md) · [Configuration](configuration.md) · [Windows, Linux, and WSL](platforms.md)

docatlas needs Node.js 22+ and npm on the computer that runs it. The project it reads needs no
build or package installation.

## Verification status

| Environment | Verification status |
| --- | --- |
| macOS | Local CLI, collector, live updates, browser and installed-package checks pass; exact runs are recorded in the planning documents. |
| Windows | The platform workflow checks native paths, npm launchers and the browser; consult the latest CI run and verification notes. PowerShell/CMD, default-browser opening and physical Ctrl+C also need manual validation. |
| Linux | Node, platform, and browser tests pass on Ubuntu 24.04 with Node.js 22.22.0 (2026-10-28). Without a desktop browser, docatlas prints the address and keeps running; open it yourself or use `--no-open`. |
| WSL | Not tested directly. It runs as Linux; see [WSL](#wsl-ubuntu-on-windows) below. |
| UNC/network drives | No support claim from this work; validate separately. |

The declared minimum is Node.js 22. Packaged integration checks pass on Node.js
22.12.0 and 24.22.1 on macOS 15.6.1. Node.js 22.0 and environments not listed above remain
unverified. The [platform checks](../CONTRIBUTING.md#platform-checks) describe the macOS and
Windows CI.

## Windows

Use the same command from a native Windows PowerShell or Command Prompt:

~~~powershell
Set-Location 'C:\work\Spring 프로젝트'
npx docatlas
~~~

If PowerShell blocks the `npx.ps1` launcher, use `npx.cmd docatlas`.
`--root` accepts a native Windows path, including a drive letter and spaces:

~~~powershell
npx docatlas --root 'C:\work\다른 프로젝트' --docs-dir documentation
~~~

Use `/` for `--docs-dir`, JSON paths/globs, and Markdown links on every OS.
The reader and search display project-relative paths with `/`.
If the browser does not open, run `npx docatlas --no-open` and open the printed
loopback address yourself. Keep the terminal open and use Ctrl+C to stop it.

Windows path handling and the browser opener are designed for native Windows.
[Node supports terminal Ctrl+C on Windows](https://nodejs.org/api/process.html#signal-events),
but sending a test subprocess `SIGINT`/`SIGTERM` on Windows forcefully terminates it.
Our injected-signal tests check application cleanup without claiming native console validation.

## WSL (Ubuntu on Windows)

These notes come from how docatlas works, not from a WSL test run.

- Install Node.js 22+ inside WSL, for example with nvm. Ubuntu's own `nodejs` package is older
  (18 on Ubuntu 24.04), and a Windows Node.js on the PATH should not be used from WSL.
- docatlas opens your Windows default browser through PowerShell. If it does not open, paste the
  printed `http://127.0.0.1:<port>/` address into the browser. Use that address exactly:
  the server rejects `localhost`.
- Keep the project in the WSL file system, such as `~/project`. Projects under `/mnt/c` should
  work, but change detection polls files and can be slower there.
- `docatlas agents install` run inside WSL installs into the WSL home folder. If Claude Code or
  Codex runs on the Windows side, run the install command on Windows instead.
