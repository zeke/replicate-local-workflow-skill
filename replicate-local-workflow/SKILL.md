---
name: replicate-local-workflow
description: Run Replicate models and manage their outputs on the local machine. Use whenever a user asks to run, test, or compare a Replicate model; provides a replicate.com model or prediction URL; generates one or many Replicate images, videos, audio files, or other predictions; saves or downloads Replicate outputs locally; organizes generated media; preserves prediction IDs and manifests; embeds provenance metadata; builds galleries or contact sheets; retries or resumes batches; or commits Replicate outputs to Git.
compatibility: Requires internet access and Node.js. Replicate MCP Code Mode optionally requires Deno. Replicate API access requires REPLICATE_API_TOKEN. Image provenance uses npx media-provenance.
metadata:
  author: zeke
  version: "1.0"
---

# Replicate local workflow

Use Replicate's official skills for model-specific work. This skill adds the local workflow around them: planning batches, preserving prediction records, downloading every output, naming files, embedding image metadata, reviewing candidates, and archiving results.

## Before running

1. Confirm the requested output directory. If none was given, use `outputs/<concise-task-slug>/` under the current project.
2. Confirm the model, prompt or inputs, output count, format, and any cost or quality constraint that is unclear.
3. Show the user the prompts and batch plan before creating predictions when the task is exploratory, expensive, or asks for multiple variants.
4. Check that `REPLICATE_API_TOKEN` exists without printing its value.
5. Load the relevant installed Replicate skills:
   - `find-models` to search and inspect schemas
   - `compare-models` to evaluate candidates
   - `run-models` to create and monitor predictions
   - `prompt-images` or `prompt-videos` for media prompting
6. If those skills are unavailable, install them globally with:

```sh
npx skills add replicate/skills --global --all --yes
```

Always fetch the current model schema before constructing inputs. Request JPG with the model's supported `output_format`, `format`, or equivalent input when available. Do not invent a format input that is absent from the schema.

## Prefer MCP Code Mode

When the local Replicate MCP Code Mode tools are already available, prefer them for workflows involving several API calls. Use the MCP documentation-search tool first, then its TypeScript execution tool. Code Mode can create predictions concurrently, poll them, and return only compact prediction records and output URLs.

Do not block the task to configure Code Mode unless the user asks. Fall back to the Replicate skills and HTTP API when it is unavailable.

Current local server command:

```sh
npx -y replicate-mcp@alpha --tools=code
```

It requires Node.js, Deno, and `REPLICATE_API_TOKEN`. It is experimental, so search its current SDK documentation rather than relying on remembered method names.

## Run predictions

- Create independent predictions concurrently. Never create one, wait for it, and then create the next.
- Use `Promise.all` or an equivalent bounded concurrent batch. Replicate can accept parallel predictions.
- For large or slow batches, cap local polling concurrency when needed, but do not serialize prediction creation.
- Log each prediction ID immediately after creation so work can be recovered if the process exits.
- Poll each prediction to a terminal state: `succeeded`, `failed`, or `canceled`.
- Download successful outputs as each prediction finishes. Replicate output URLs expire.
- Make long-running scripts resumable. Skip outputs whose prediction record and local file already exist.
- Retry only failed or missing slots. Record the replacement prediction separately.
- Save the one-off generation script when a batch is substantial or likely to be rerun.

For deterministic media operations such as conversion, resizing, concatenation, reversing, or contact sheets, prefer local tools such as FFmpeg or ImageMagick over another prediction.

## Save prediction records and outputs

Use this structure unless the project already has a stronger convention:

```text
outputs/<task-slug>/
├── predictions/        # complete prediction JSON, one file per prediction ID
├── files/              # downloaded outputs
├── scripts/            # one-off batch scripts when useful
├── manifest-001.json   # batch inputs, prediction IDs, statuses, and local paths
├── gallery.html        # optional visual review page
└── contact-sheet.jpg   # optional compact overview
```

Never overwrite an existing file. Use the next numeric manifest name and collision-safe output names.

Save each complete prediction response to `predictions/<prediction-id>.json`. Keep the exact inputs, outputs, model/version, timestamps, metrics, and errors. A batch manifest should map every requested slot to its prediction ID, status, remote output, and local path.

Download every file URL in a successful prediction output, including URLs nested in arrays or objects. Keep textual or structured outputs in the prediction JSON and manifest.

Use the bundled downloader after saving a prediction response:

```sh
node <skill-directory>/scripts/save-prediction.mjs \
  --prediction outputs/<task-slug>/predictions/<prediction-id>.json \
  --model owner/model \
  --dir outputs/<task-slug>/files
```

Optional `--slug <description>` overrides the slug inferred from `input.prompt` or other inputs.

## Filename rules

Name downloaded files in this order:

```text
<prediction-id>__<owner>-<model>__<input-or-prompt-slug>__<output-number>.<ext>
```

Example:

```text
abc123__google-nano-banana-2__orange-cat-reading-on-train__01.jpg
```

Rules:

- Put the complete prediction ID first.
- Follow it with a concise owner-model slug.
- Follow that with a short, descriptive slug derived from the prompt or distinguishing inputs.
- Add a two-digit output number when a prediction has one or more file outputs.
- Keep names lowercase, ASCII, and reasonably short.
- Determine the extension from the response content type, then the URL. Do not label PNG or WebP bytes as JPG.
- If a path already exists, append `__v002`, `__v003`, and so on. Never replace it.

Favor JPG by requesting it from the model. Convert an existing PNG or WebP to JPG only when transparency and lossless fidelity are unimportant, and preserve the original unless the user says otherwise.

## Embed image provenance

For every downloaded JPG, PNG, or WebP, use `media-provenance` to embed:

- provider: Replicate
- model owner/name
- exact prediction input
- original output value
- prediction ID, version, status, timestamps, metrics, and API URLs

The bundled downloader does this automatically with `npx -y media-provenance`. Verify at least one image from each batch:

```sh
npx -y media-provenance path/to/output.jpg | jq
```

Do not put tokens, authorization headers, local secrets, or environment contents in metadata or manifests.

## Review and verify

After downloading:

1. Compare requested slots, succeeded predictions, downloaded URLs, and local files. Explain any mismatch.
2. Verify files are non-empty and inspect their actual media type.
3. Check image dimensions with `magick identify` and audio/video properties with `ffprobe` when relevant.
4. For visual batches, create a local HTML gallery or contact sheet and open it for review.
5. Preserve source and style reference files in the project when the run should be reproducible and the user has permission to retain them.
6. Invite the user to choose candidates. Generate broadly, review side by side, then cull aggressively rather than assuming the first result is final.

## Git bookkeeping

Replicate outputs may be committed to Git when they are useful project artifacts.

Before committing, check for oversized files:

```sh
find outputs -type f -size +99M -print
```

Do not commit any individual file at or above 100 MB to ordinary Git. Use Git LFS or external object storage when required. Also inspect manifests and staged changes for secrets before committing.
