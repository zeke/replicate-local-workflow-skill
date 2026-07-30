#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";

const args = parseArgs(process.argv.slice(2));
if (!args.prediction || !args.model || !args.dir) {
  fail("Usage: save-prediction.mjs --prediction <json> --model <owner/model> --dir <directory> [--slug <text>]");
}

const [owner, model, ...extra] = args.model.split("/");
if (!owner || !model || extra.length > 0) fail("--model must use owner/model format");

const predictionPath = resolve(args.prediction);
const outputDir = resolve(args.dir);
const prediction = JSON.parse(await readFile(predictionPath, "utf8"));
if (!prediction.id) fail("Prediction JSON is missing id");
if (prediction.status !== "succeeded") fail(`Prediction ${prediction.id} has status ${prediction.status ?? "unknown"}`);

const urls = [...new Set(findUrls(prediction.output))];
if (urls.length === 0) {
  console.log(JSON.stringify({ prediction: prediction.id, files: [] }, null, 2));
  process.exit(0);
}

await mkdir(outputDir, { recursive: true });
const description = args.slug || inferDescription(prediction.input);
const stem = [slug(prediction.id, 64), slug(`${owner}-${model}`, 60), slug(description, 72)].join("__");
const saved = [];

for (const [index, url] of urls.entries()) {
  const response = await fetch(url);
  if (!response.ok) fail(`Download failed for ${url}: ${response.status}`);

  const extension = extensionFor(response.headers.get("content-type"), url);
  const numberedStem = `${stem}__${String(index + 1).padStart(2, "0")}`;
  const temporary = join(outputDir, `.${numberedStem}.${randomUUID()}.tmp${extension}`);

  try {
    await writeFile(temporary, Buffer.from(await response.arrayBuffer()), { flag: "wx" });
    if (isProvenanceImage(extension)) {
      const metadataPath = `${temporary}.json`;
      await writeFile(metadataPath, JSON.stringify(provenance(prediction, args.model), null, 2));
      try {
        execFileSync("npx", ["-y", "media-provenance", "set", temporary, metadataPath], {
          stdio: "inherit",
        });
      } finally {
        await rm(metadataPath, { force: true });
      }
    }
    const destination = await persistWithoutOverwrite(temporary, outputDir, numberedStem, extension);
    saved.push(destination);
    console.error(`saved: ${destination}`);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

console.log(JSON.stringify({ prediction: prediction.id, files: saved }, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || value === undefined) fail(`Invalid argument: ${key ?? ""}`);
    parsed[key.slice(2)] = value;
  }
  return parsed;
}

function findUrls(value) {
  if (typeof value === "string") return /^https?:\/\//.test(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(findUrls);
  if (value && typeof value === "object") return Object.values(value).flatMap(findUrls);
  return [];
}

function inferDescription(input) {
  if (typeof input?.prompt === "string" && input.prompt.trim()) return input.prompt;
  if (!input || typeof input !== "object") return "output";
  const values = Object.entries(input)
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 4)
    .map(([key, value]) => `${key}-${value}`);
  return values.join("-") || "output";
}

function slug(value, maxLength) {
  const result = String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength)
    .replace(/-$/g, "");
  return result || "output";
}

function extensionFor(contentType, url) {
  const type = contentType?.split(";", 1)[0].trim().toLowerCase();
  const byType = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/ogg": ".ogg",
    "application/pdf": ".pdf",
    "application/json": ".json",
    "text/plain": ".txt",
  };
  if (byType[type]) return byType[type];

  const pathname = new URL(url).pathname;
  const fromUrl = extname(pathname).toLowerCase();
  if (/^\.[a-z0-9]{1,8}$/.test(fromUrl)) return fromUrl === ".jpeg" ? ".jpg" : fromUrl;
  return ".bin";
}

async function persistWithoutOverwrite(temporary, directory, stem, extension) {
  for (let version = 1; ; version += 1) {
    const suffix = version === 1 ? "" : `__v${String(version).padStart(3, "0")}`;
    const candidate = join(directory, `${stem}${suffix}${extension}`);
    try {
      await link(temporary, candidate);
      await rm(temporary);
      return candidate;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
}

function isProvenanceImage(extension) {
  return [".jpg", ".png", ".webp"].includes(extension);
}

function provenance(prediction, modelName) {
  const {
    id,
    version,
    status,
    created_at,
    started_at,
    completed_at,
    metrics,
    urls,
  } = prediction;
  return {
    provider: "Replicate (https://replicate.com/)",
    model: modelName,
    input: prediction.input ?? {},
    output: prediction.output,
    meta: { id, version, status, created_at, started_at, completed_at, metrics, urls },
  };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
