# replicate-local-workflow-skill

An [Agent Skill](https://agentskills.io) for running Replicate models and keeping their outputs organized on a local machine.

It layers a local asset workflow on top of Replicate's official model skills:

- Find, compare, prompt, and run models with [`replicate/skills`](https://github.com/replicate/skills).
- Prefer Replicate MCP Code Mode when it is available.
- Start independent predictions in parallel.
- Download every file output before its URL expires.
- Put prediction IDs, model names, and concise input slugs in filenames.
- Embed prediction metadata in JPG, PNG, and WebP files with [`media-provenance`](https://github.com/zeke/media-provenance).
- Preserve prediction JSON, manifests, generation scripts, galleries, and contact sheets.
- Never overwrite existing outputs.
- Allow useful generated artifacts in Git when each file is under 100 MB.

## Install

Install globally for all supported agents:

```sh
npx skills add zeke/replicate-local-workflow-skill --global --all --yes
```

Install Replicate's official skills too:

```sh
npx skills add replicate/skills --global --all --yes
```

## Requirements

- Node.js
- A `REPLICATE_API_TOKEN` environment variable
- Internet access
- Deno, optional, for Replicate MCP Code Mode
- FFmpeg and ImageMagick, optional, for local media processing and review assets

The included downloader invokes `npx media-provenance` automatically for supported image formats.

## Development

See [AGENTS.md](AGENTS.md).
