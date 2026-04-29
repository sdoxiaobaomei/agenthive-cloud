# WSL2 Network Setup for China Dev Environment

This guide configures WSL2 to use **mirrored networking mode**, which eliminates the extra NAT layer and improves network throughput between Windows, WSL2, and Docker Desktop.

## Prerequisites

- Windows 11 (Build 22000 or later) or Windows Server 2022
- WSL2 installed
- Docker Desktop with WSL2 backend

## Steps

### 1. Copy the template

```powershell
copy .wslconfig.template %USERPROFILE%\.wslconfig
```

Or manually copy the file contents to `%USERPROFILE%\.wslconfig`.

### 2. Shut down WSL2

Open PowerShell or CMD and run:

```powershell
wsl --shutdown
```

### 3. Restart Docker Desktop

- Quit Docker Desktop completely (right-click the tray icon → Quit)
- Restart Docker Desktop from the Start Menu

### 4. Verify

```powershell
wsl.exe cat /proc/version
```

Docker containers should now use the Windows host network stack directly, reducing NAT overhead.

## What the settings do

| Setting | Purpose |
|---------|---------|
| `networkingMode=mirrored` | Mirrors Windows network interfaces into WSL2 (no NAT) |
| `dnsTunneling=true` | Uses Windows DNS resolver inside WSL2 |
| `firewall=true` | Applies Windows firewall rules to WSL2 traffic |
| `autoProxy=true` | Automatically propagates Windows proxy settings |
| `memory=8GB` | Limits WSL2 VM memory to 8 GB |
| `processors=4` | Limits WSL2 VM to 4 vCPUs |

## Troubleshooting

- If Docker Desktop fails to start after applying `.wslconfig`, remove the file and restart:
  ```powershell
  del %USERPROFILE%\.wslconfig
  wsl --shutdown
  ```
- Ensure Windows is fully updated; mirrored networking requires recent WSL2 versions.
