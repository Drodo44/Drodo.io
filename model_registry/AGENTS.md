# AGENTS

1. Preserve the canonical hierarchy: canonical_owner -> family_name -> variant_name.
2. Never make OpenRouter, Hugging Face, Bedrock, Azure AI Foundry, GitHub Models, NVIDIA NIM, Groq, Together, Fireworks, or local runtimes into canonical owners.
3. Add a new canonical variant only when the upstream vendor treats it as a distinct release.
4. Provider-specific aliases, hosting mirrors, fast tiers, snapshots, and regional handles belong in provider_mappings.ndjson unless the release itself is distinct.
5. Prefer null over guessing. Do not invent release dates, pricing, or token limits.
6. Every canonical model and provider mapping must reference at least one source id.
7. Keep routing domain-specific. Never add a universal best-model score.
8. Regenerate the package with `node scripts/generate-model-registry.mjs` after updates and review coverage_report.json plus missing_fields_report.json before finalizing.
