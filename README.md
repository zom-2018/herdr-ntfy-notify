# 📣 herdr-ntfy-notify

> Stop babysitting your AI agents. Let them text you when they need help or finish the job.

A lightweight, zero-dependency Herdr v1 plugin that sends structured push notifications to your [ntfy](https://ntfy.sh) topic on terminal agent status changes (`done` & `blocked`).

---

## ⚡ The Cool Stuff (Features)

- **🎭 Situation-Aware Emojis**: ntfy renders multi-emoji tags based on who is talking and what they did:
  - **Codex** gets a scroll 📜 | **OMP / Pi** get tools 🛠️ | **Hermes** gets a chat balloon 💬 | **Librarian** gets books 📚.
  - Success gets a check ✅ | Questions get a question mark ❓ | Errors get a cross ❌.
- **🚀 Sub-millisecond Local Bypass**: Auto-detects if a local ntfy server is up (e.g. `localhost:10081`) and fires alerts instantly via `curl` bypassing TLS/network lag. Falls back to Tailscale smoothly.
- **📍 Location Pings**: Pushes the exact workspace, tab, and pane ID (e.g. `Loc: app · test (pane p3)`), so you know exactly where to run `herdr` to take over.

---

## ⚙️ Quick Start

### 1. Link the Plugin
Tell your local Herdr daemon about this plugin:
```bash
herdr plugin link /opt/herdr-ntfy-notify
```

### 2. Configure
Copy the configuration template and edit it:
```bash
CONFIG_DIR="$(herdr plugin config-dir local.agent-ntfy-notify)"
cp /opt/herdr-ntfy-notify/.env.example "$CONFIG_DIR/.env"
```

Configure your `.env` variables:
```dotenv
HERDR_NTFY_EXTERNAL_URL=http://localhost:10081
HERDR_NTFY_LOCAL_URL=http://127.0.0.1:10081
HERDR_NTFY_TOPIC=herdr-alerts
HERDR_NTFY_ENABLED=1
```

### 3. Test Drive
Send a mock notification to verify the piping:
```bash
herdr plugin action invoke test --plugin local.agent-ntfy-notify
```

---

## 🔬 Deterministic Verification

Run the built-in test suite to see how different statuses and agent formats render:
```bash
cd /opt/herdr-ntfy-notify && node test_cases.js
```

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
