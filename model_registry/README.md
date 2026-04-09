# Model Registry

Canonical identity stays in canonical_models.ndjson. Provider-specific access data stays in provider_mappings.ndjson.

## Rules

- Canonical hierarchy is canonical_owner -> family_name -> variant_name.
- OpenRouter, Hugging Face, Ollama, Azure, Bedrock, GitHub Models, vLLM, and TGI are access providers, not canonical owners.
- Provider-specific ids, preview aliases, mirrors, and serving tiers stay in provider_mappings.ndjson unless the upstream vendor treats them as a distinct release.
- The generator keeps stable ordering, merges onto the existing registry, and enriches selected open-weight records from Hugging Face metadata plus verified OpenRouter catalog mappings.

## Regeneration

Run: `node scripts/generate-model-registry.mjs`

## Files

- `canonical_models.ndjson`: canonical model identities for routing.
- `provider_mappings.ndjson`: provider/runtime-specific model handles and pricing/context metadata.
- `sources_catalog.json`: source registry used by canonical and provider records.
- `coverage_report.json`: machine-readable summary of owner, provider, and modality coverage.
- `missing_fields_report.json`: machine-readable completeness gaps.
- `unresolved_duplicates.json`: unresolved alias collisions that still need manual review.

## Coverage

- Canonical models: 127
- Represented owners: 39
- Provider mappings: 188
- Represented access providers: 36
- Missing release dates: 55 (43.3%)
- Missing pricing blocks: 126 (67%)
- Missing context windows: 115 (61.2%)
- Missing max output tokens: 137 (72.9%)
- Low-confidence score cells: 16
- Benchmark-backed score cells by domain: see `coverage_report.json`
- Unresolved duplicates: 0

## Ranking

Routing remains domain-specific. There is no universal best-model score. Use required capabilities first, then domain rank and confidence, then provider constraints and latency/cost tie-breakers.

## Known limits

- Some proprietary release dates remain null where official model pages do not expose clean dated release markers.
- Direct-provider pricing is still incomplete outside providers with public catalogs or explicit pricing docs.
- Provider mappings are intentionally conservative where deployment-specific IDs vary by tenant or cloud region.
- Several routing domains such as creative writing, general chat, long-context, and cost efficiency still rely more on curated evidence than shared cross-vendor benchmarks.
