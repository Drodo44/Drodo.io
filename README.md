<div align="center">

# 🤖 Drodo
### The AI Agent Platform Built for Everyone

**Connect any AI model. Deploy any agent. Automate anything.**
*No technical knowledge required.*

[![Download](https://img.shields.io/badge/Download-Windows%20Installer-7f77dd?style=for-the-badge&logo=windows)](https://github.com/Drodo44/Drodo.io/releases/download/v1.0.0/Drodo_1.0.0_x64-setup.exe)
[![Release](https://img.shields.io/badge/Version-1.0.0-1d9e75?style=for-the-badge)](https://github.com/Drodo44/Drodo.io/releases/tag/v1.0.0)
[![License](https://img.shields.io/badge/License-BUSL%201.1-f97316?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Mac%20%7C%20Linux-4285f4?style=for-the-badge)](https://github.com/Drodo44/Drodo.io/releases)

</div>

---

## What is Drodo?

Drodo is the first AI agent platform that combines the power of autonomous multi-agent orchestration, a one-click skill marketplace, built-in workflow automation, and real-time mission control — packaged into a beautiful desktop app that anyone can install and use in under 3 minutes.

Think Claude Code meets Agent Zero meets OpenClaw — but stable, beautiful, model-agnostic, and with zero setup complexity.

## Why Drodo?

| Feature | Drodo | ChatGPT | Claude.ai | OpenClaw | Agent Zero |
|---|---|---|---|---|---|
| Any AI model | ✅ | ❌ | ❌ | ✅ | ✅ |
| No subscription required | ✅ | ❌ | ❌ | ✅ | ✅ |
| One-click install | ✅ | ✅ | ✅ | ❌ | ❌ |
| Live agent mission control | ✅ | ❌ | ❌ | ⚠️ | ⚠️ |
| Multi-agent orchestration | ✅ | ❌ | ❌ | ⚠️ | ✅ |
| Built-in workflow automation | ✅ | ❌ | ❌ | ❌ | ❌ |
| Skill packages marketplace | ✅ | ❌ | ❌ | ❌ | ❌ |
| Telegram/Slack/Discord bots | ✅ | ❌ | ❌ | ⚠️ | ❌ |
| Non-technical friendly | ✅ | ✅ | ✅ | ❌ | ❌ |
| Cloud sync | ✅ | ✅ | ✅ | ❌ | ❌ |

## Features

### 🤖 Multi-Agent Orchestration

Drodo uses an Orchestrator → Specialist pattern built for real work, not toy demos. You give the orchestrator a goal, and it decides when to fan that work out into focused specialists such as research agents, software architects, analysts, writers, or operators.

Each specialist gets a scoped task, runs independently, and feeds its output back into the larger mission. The result is a clean chain of reasoning where one agent researches, another plans, another executes, and another reviews. Instead of a single monolithic conversation, you get visible, modular execution that is easier to trust, debug, and improve.

Because every agent is tied into Drodo’s live swarm interface, you can watch the work unfold in real time, see status changes, inspect intermediate outputs, and stop bad runs before they waste tokens.

### 🎯 70+ Agent Templates

Drodo ships with 70+ one-click agent templates across 19 categories:

- Business
- Marketing
- Content & Creative
- Research
- Engineering
- Finance
- Legal
- Sales
- HR & Recruiting
- Customer Support
- Education
- Health & Wellness
- Real Estate
- E-commerce
- Social Media
- SEO
- Data & Analytics
- Productivity
- Personal

Every template is designed to make an agent feel like an expert in its domain from the first message. Instead of starting with a blank prompt, you can launch a CEO Advisor, Sales Coach, Research Analyst, Senior Software Architect, Technical Writer, Financial Analyst, Resume Writer, or dozens more with one click.

This matters for both speed and quality. Non-technical users can launch something useful immediately, while power users can use templates as strong starting points for more specialized workflows.

### 🔴 Live Mission Control

Drodo’s Agent Swarm view is a live control room for autonomous work.

You can:

- Watch every active agent update in real time
- See tool calls and execution progress as they happen
- Inspect per-agent status, summaries, and timing
- Track the entire swarm from a global feed
- Abort individual runs when something goes off course

Most AI apps hide the work. Drodo makes it observable. That visibility is what makes autonomous agents usable by real people doing real tasks.

### ⚡ Built-in Workflow Automation (n8n)

Drodo does not stop at “here’s an answer.” It turns successful work into repeatable automation.

The built-in workflow builder lets you design multi-step workflows, choose models per step, pass outputs between steps, and run them sequentially with a live output panel. Once a workflow works, agents can hand that logic off into n8n-compatible JSON so it can run permanently and repeatedly.

You also get workflow definitions, saved runs, run history, and an Agent → n8n handoff flow that converts completed agent work into production-ready automation scaffolding.

### 🧠 AI Skills

Drodo’s AI skills inject powerful capabilities directly into agent conversations so agents can work with more than just text.

Included skills:

- Web Search (Tavily)
- Web Scraper
- Persistent Memory
- Code Execution
- File Reader
- Image Analysis
- Voice Input
- Email Integration

These skills are designed to feel native. When enabled, they become part of the agent’s working environment, allowing agents to search, inspect, recall, execute, read, analyze, listen, and communicate without forcing users to stitch tools together manually.

### 📦 Skill Packages Marketplace

Drodo includes a built-in skill packages marketplace so users can extend agents with curated capabilities from the open-source ecosystem.

Current featured packages include:

- Agent Orchestration Suite
- Business Skills Library
- Superpowers
- Awesome Agent Skills
- Awesome Claude Skills Directory
- Claude Code Best Practices

The marketplace also includes conflict detection. If a package overlaps heavily with something already installed, Drodo warns the user before proceeding. That extra guardrail is critical for non-technical users who want more power without accidentally creating duplicate or conflicting agent behavior.

### 🔌 9 Featured MCP Integrations

Drodo includes one-click featured MCP integrations for:

- Google Workspace
- n8n-MCP
- Supabase
- GitHub
- Filesystem
- Brave Search
- PostgreSQL
- Slack
- Puppeteer

These integrations give agents secure, structured access to external tools and data sources. In practice, that means agents can work with source code, cloud databases, browser sessions, files, search engines, automation nodes, and productivity platforms without leaving the app.

### 💬 Messaging Bot Integration

Drodo can connect to Telegram, Slack, and Discord so your agents are reachable far beyond the desktop app.

Once connected, Drodo polls for incoming messages, routes them through the active AI provider, streams a response, and sends the answer back to the same chat. That means you can control your agents from anywhere in the world — from your phone, your team workspace, or a Discord server.

### 🌐 Model Agnostic — Every Provider

Drodo is built around BYOK: bring your own key.

You are never locked to a single model vendor, subscription, or cloud. Connect the provider you want, use the model you trust, and switch whenever you need to. Out of the box, Drodo supports OpenAI, Anthropic, Google Gemini, NVIDIA NIM, OpenRouter, Mistral, Groq, Together AI, Fireworks AI, DeepSeek, Hugging Face, Ollama, LM Studio, and any custom base URL.

### ☁️ Cloud Sync

Drodo includes optional Supabase authentication and cloud sync for users who want their data available across devices.

Sessions, workflows, and prompt library data can be synced to the cloud while the core experience still works in guest mode. Sensitive key material is encrypted before storage, and the app is built with a privacy-first, local-first mindset: your providers stay yours, your keys stay yours, and your data is not routed through Drodo servers.

## Getting Started

### Installation (Windows)
1. Download the installer below
2. Run `Drodo_1.0.0_x64-setup.exe`
3. Follow the setup wizard
4. Connect your first AI model
5. Deploy your first agent

> **Note:** Windows may show a SmartScreen warning on first run. Click "More info" → "Run anyway". This is normal for new applications and will be resolved with code signing in a future release.

### System Requirements
- Windows 10 or later (64-bit)
- 4GB RAM minimum
- Internet connection for AI model API calls
- Node.js (optional — required for n8n automation engine)

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Framework | Tauri 2 |
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS |
| State Management | Zustand |
| Backend/Auth | Supabase |
| Automation Engine | n8n |
| AI Streaming | Custom multi-provider streaming engine |
| UI Components | Radix UI + Lucide React |

## Supported AI Providers

| Provider | Example Model |
|---|---|
| NVIDIA NIM | `meta/llama-3.1-70b-instruct` |
| OpenRouter | `openai/gpt-4o` |
| Anthropic | `claude-sonnet-4-6` |
| OpenAI | `gpt-4o` |
| Google Gemini | `gemini-2.0-flash` |
| Mistral | `mistral-large-latest` |
| Groq | `llama-3.3-70b-versatile` |
| Together AI | `meta-llama/Llama-3-8b-chat-hf` |
| Fireworks AI | `accounts/fireworks/models/llama-v3-8b-instruct` |
| DeepSeek | `deepseek-chat` |
| Hugging Face | `HuggingFaceH4/zephyr-7b-beta` |
| Ollama | `llama3.2` |
| LM Studio | `local-model` |
| Custom Endpoint | Any OpenAI-compatible model |

## Roadmap

- [ ] macOS and Linux installers
- [ ] Code signing (removes Windows SmartScreen warning)
- [ ] Pro tier with advanced features
- [ ] Mobile companion app
- [ ] More messaging platforms (WhatsApp, Google Chat, Teams)
- [ ] Agent-to-agent memory sharing
- [ ] Marketplace for user-created agent templates

## License

This project is licensed under the Business Source License 1.1. Personal and non-commercial use is permitted. Commercial use requires written permission from the author. See LICENSE for details.

## Download

<div align="center">

### [⬇️ Download Drodo v1.0.0 for Windows](https://github.com/Drodo44/Drodo.io/releases/download/v1.0.0/Drodo_1.0.0_x64-setup.exe)

**Free forever · No account required to start · Your keys, your models, your data**

[🌐 Visit Website](https://drodo44.github.io/drodo-landing/) · [🐛 Report a Bug](https://github.com/Drodo44/Drodo.io/issues) · [📋 View Releases](https://github.com/Drodo44/Drodo.io/releases)

</div>
