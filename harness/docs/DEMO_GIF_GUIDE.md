# Recording the MCP Shield Demo (15s GIF / SVG)

Record `scripts/demo_terminal_sim.py` into a crisp hero asset for the README.

## Option A — VHS (Charmbracelet) — recommended

### 1. Install tools

```bash
# macOS / Linux
brew install charmbracelet/tap/vhs ffmpeg

# Windows (scoop)
scoop install vhs ffmpeg
```

### 2. Create tape file `docs/assets/demo.tape`

```tape
Output docs/assets/mcp-shield-demo.gif
Set FontSize 16
Set Width 1100
Set Height 520
Set Theme "Catppuccin Mocha"
Set Padding 24

Type "python scripts/demo_terminal_sim.py --speed fast"
Enter
Sleep 500ms

# Paste pre-recorded cast OR run live:
# Source demo.cast
```

For live recording with VHS + asciinema:

```bash
asciinema rec docs/assets/demo.cast -c "python scripts/demo_terminal_sim.py --speed fast"
vhs docs/assets/demo.tape
```

### 3. Export settings for ~15 seconds

- Target duration: **12–15s** (`--speed fast` ≈ 8s playback; add 2s intro/outro in tape)
- Resolution: **1100×520** (README hero width)
- FPS: **12–15** (keeps GIF under 2MB)

```tape
Output docs/assets/mcp-shield-demo.gif
Set Framerate 12
Set PlaybackSpeed 1.2
```

---

## Option B — asciinema + agg

```bash
pip install agg-python  # or use agg binary from asciinema/agg
asciinema rec demo.cast -c "python scripts/demo_terminal_sim.py --speed fast"
agg demo.cast docs/assets/mcp-shield-demo.gif --font-size 16 --theme monokai
```

Convert to SVG (optional):

```bash
agg demo.cast docs/assets/mcp-shield-demo.svg --font-size 16
```

---

## Option C — Screen recorder fallback

1. Run `python scripts/demo_terminal_sim.py --speed normal`
2. Record terminal window (OBS / macOS Cmd+Shift+5)
3. Trim to 15s, export WebM → GIF via ffmpeg:

```bash
ffmpeg -i demo.webm -vf "fps=12,scale=1100:-1:flags=lanczos" -loop 0 docs/assets/mcp-shield-demo.gif
```

---

## Commit checklist

- [ ] `docs/assets/mcp-shield-demo.gif` added (< 2MB)
- [ ] README hero image renders on GitHub dark theme
- [ ] Demo script runs without `rich` (colorama/ANSI fallback)

## Styling tips

| Moment | Color |
|---|---|
| Poisoned file / SQL injection | Red |
| Nexus Shield intercept | Cyan |
| BLOCKED / Security log | Emerald green |
| Benign user intent | Dim white |

Install vivid output:

```bash
pip install rich colorama
```
