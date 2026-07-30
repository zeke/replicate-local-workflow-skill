# AGENTS.md

## Project purpose

This repository publishes the `replicate-local-workflow` Agent Skill. It captures Zeke's process for running Replicate models, downloading every output, preserving prediction metadata, reviewing batches locally, and archiving generated media.

## Structure

- `replicate-local-workflow/SKILL.md`: compact, task-oriented instructions loaded by agents.
- `replicate-local-workflow/scripts/save-prediction.mjs`: dependency-free Node.js downloader and filename/provenance helper.
- `test/`: offline tests for helper behavior.
- `script/lint`: Agent Skills validation and JavaScript syntax checks.
- `script/test`: offline Node.js tests.
- `README.md`: concise human-facing description and installation instructions.

## Development

Run the repository scripts rather than invoking their underlying tools directly:

```sh
script/lint
script/test
```

The downloader must remain dependency-free at runtime except for invoking `npx media-provenance` when it processes JPG, PNG, or WebP files. Tests must remain offline and avoid image provenance so they do not require npm downloads.

## Conventions

- Keep `replicate-local-workflow/SKILL.md` below 500 lines and focused on reusable behavior.
- Keep personal workflow preferences, but do not include tokens, private prompts, session transcripts, or machine-specific absolute paths.
- Never allow the downloader to overwrite an existing output.
- Keep filenames prediction-first: prediction ID, owner-model, descriptive slug, output number.
- Treat current Replicate schemas and MCP documentation as authoritative. Do not hardcode model input fields that vary by model.

## Maintenance

Revise this file whenever meaningful project structure, tooling, validation commands, or workflow conventions change. Add generally useful lessons from real Replicate runs to the skill without exposing private session details.
