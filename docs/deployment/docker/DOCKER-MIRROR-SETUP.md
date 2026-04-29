# Docker Registry Mirror Setup for China

Pulling images from Docker Hub can be slow or time out in mainland China.
Configure Docker Desktop to use China-based registry mirrors.

## Configuration

Add the following JSON to Docker Desktop:

```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.1panel.live",
    "https://hub.rat.dev",
    "https://docker.mirrors.ustc.edu.cn"
  ]
}
```

## Where to paste

1. Open **Docker Desktop**
2. Click the **Settings** (gear) icon
3. Select **Docker Engine** from the left sidebar
4. In the JSON editor, add or merge the `registry-mirrors` array above
5. Click **Apply & Restart**

## Verification

After Docker Desktop restarts, run:

```bash
docker info | grep -A 10 "Registry Mirrors"
```

You should see the four mirror URLs listed.

## Notes

- Mirrors are tried in order; if one fails, Docker falls back to the next.
- These are public mirrors; no credentials are required.
- Do **not** commit proxy credentials or private mirror URLs to Git.
