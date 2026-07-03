# ToolKit Chrome Extension

A lightweight collection of developer utilities, right in your browser side panel.

## Features

- **JSON viewer** — collapsible tree view, Beautify/Minify, search, side-by-side diff & compare
- **Cookie inspector** — view all cookies for the current site, search, export as JSON
- **Markdown reader** — Source / Split / Preview views with live rendering; auto-detects the current page's Markdown (raw `.md` files incl. local `file://`, `raw.githubusercontent.com`, `text/plain`). When you open the panel on a Markdown page it jumps to this tab in **Preview**; a **Load page** button re-fetches on demand. Reading local files needs *Allow access to file URLs* enabled for the extension
- **AI Chat** — quick prompts for page analysis, multi-turn conversation

## Install

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `tools/toolkit-extension/` directory
4. Pin the extension to your toolbar

## Usage

- Click the ToolKit icon in your toolbar to open the side panel
- Or press `Cmd+Shift+K` (Mac) / `Ctrl+Shift+K` (Windows/Linux)
- Switch between JSON, Cookies, Markdown, and AI Chat tabs

## Keyboard Shortcut

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+Shift+K` | Open ToolKit side panel |

## Build (for distribution)

```bash
# From the toolkit monorepo root
make build-toolkit-extension
# Output: dist/toolkit-extension/toolkit-extension.zip
```

## Permissions

| Permission | Used for |
|------------|----------|
| `sidePanel` | Side panel display |
| `cookies` | Cookie inspector tab |
| `activeTab` | Context-aware AI Chat |
| `tabs` | Current page URL |
| `scripting` | Read the current page's content for the Markdown reader |