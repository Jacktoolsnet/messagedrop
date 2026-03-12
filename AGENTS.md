# Repository notes for Codex

- For commands in `frontend/`, do **not** rely on the default `node`/`npm` on `PATH`.
- This environment uses `nvm` from `~/.config/nvm`, but non-interactive shells do not load it automatically because `~/.bashrc` returns early.
- Always run frontend Node/Angular commands like this:

```bash
bash -lc 'export NVM_DIR="$HOME/.config/nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22.12.0 >/dev/null; <command>'
```

- Prefer Node `v22.12.0` for this repo's Angular frontend builds.
- Example:

```bash
bash -lc 'export NVM_DIR="$HOME/.config/nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22.12.0 >/dev/null; npm run build'
```
