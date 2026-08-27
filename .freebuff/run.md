# BOLIVAR Coffee — preview run doc

Static site, no build step, no dependencies, no env files. The worktree IS the
main checkout (no separate artifacts to copy).

## Reproduce uncommitted artifacts

None. The site is plain `index.html` + `css/style.css` + `js/main.js`.
There is no `package.json`, no lockfile, no `.env.local` — nothing to copy or
install. A fresh checkout of this folder is directly servable.

A helper script exists at `.freebuff/server.js` — a dependency-free Node static
file server on `127.0.0.1:8088`.

## Run the server

Start it detached using the Windows PowerShell detach recipe:

```powershell
(Start-Process -FilePath 'node.exe' -ArgumentList '.freebuff\server.js' `
  -RedirectStandardOutput '.freebuff\preview-03ccd3c9-95ce-4b74-8cf6-618c61a1bae3.log' `
  -RedirectStandardError '.freebuff\preview-03ccd3c9-95ce-4b74-8cf6-618c61a1bae3.log.err' `
  -WindowStyle Hidden -PassThru).Id
```

stdout and stderr go to **different** files (PowerShell fails if both point at
one path).

Wait until it answers:

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8088/index.html   # expect 200
```

Find the PID with:

```powershell
(Get-NetTCPConnection -LocalPort 8088).OwningProcess
```

Then `register_preview { url: "http://127.0.0.1:8088/index.html", pid: <pid> }`.

If port 8088 is taken, pick another free port and change the `.listen(...)`
arguments in `.freebuff/server.js`.

Known caveat: the `register_preview` `htmlPath` mode serves ONLY the single
HTML file (relative `css/` and `js/` return 404), so it must NOT be used for
this project — the static server above is the correct mode.
