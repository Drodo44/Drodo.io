# Drodo

Drodo is a desktop AI agent platform for building, running, and orchestrating work across any model you connect. It combines chat, workflows, prompt management, agent swarms, automations, local-first storage, and optional cloud sync in a single Tauri app.

## Screenshot

Screenshot placeholder: add the latest product screenshot here before release.

## Features

- Bring your own providers with local API key storage and connection testing
- Chat with connected models using a persistent session history
- Organize work into projects and saved sessions
- Build multi-step workflows with sequential execution and live output panels
- Review workflow run history and reusable workflow definitions
- Launch agent swarms and hand completed work off into n8n JSON
- Manage a reusable prompt library and agent templates
- Track analytics for usage, providers, token totals, and cost estimates
- Configure skills, automations, connectors, and app-wide settings
- Sign in with Supabase auth or continue in guest mode
- Sync sessions, workflows, and prompt data to Supabase
- Desktop packaging with Tauri, updater support, and installer targets

## Installation

Download the latest release from the [releases page](https://github.com/Drodo44/Drodo.io/releases).

## Development

1. Install dependencies:

```bash
npm install
```

2. Start the desktop app in development mode:

```bash
npm run tauri dev
```

## Tech Stack

- Tauri 2
- React 19
- TypeScript
- Zustand
- Tailwind CSS 4
- Supabase
- Lucide React

## License

MIT
