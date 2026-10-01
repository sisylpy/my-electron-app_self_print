# Bundled WeChat UI automation

This directory is the single runtime source for GrainPrint's visible WeChat
automation:

- `mac/` contains the Python implementation used on macOS.
- `windows/` contains the PowerShell implementation used on Windows.

Production code must resolve these files relative to
`src/wechat/ui-automation-service.js`. It must not load a sibling repository at
runtime. Electron Builder already packages this directory through the existing
`src/**/*` rule.

The macOS runtime still requires a compatible `python3` with the packages in
`mac/requirements.txt`. Windows uses the PowerShell runtime included with the
operating system.
