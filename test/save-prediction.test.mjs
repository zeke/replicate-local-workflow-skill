import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("downloads nested outputs and never overwrites existing files", async (t) => {
  const server = createServer((request, response) => {
    response.setHeader("content-type", "text/plain");
    response.end(request.url === "/one" ? "one" : "two");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());

  const root = await mkdtemp(join(tmpdir(), "replicate-local-workflow-"));
  const predictionPath = join(root, "prediction.json");
  const outputDir = join(root, "files");
  const { port } = server.address();
  await writeFile(
    predictionPath,
    JSON.stringify({
      id: "abc123",
      status: "succeeded",
      input: { prompt: "Orange cat reading on a train" },
      output: [`http://127.0.0.1:${port}/one`, { second: `http://127.0.0.1:${port}/two` }],
    }),
  );

  const command = [
    "replicate-local-workflow/scripts/save-prediction.mjs",
    "--prediction",
    predictionPath,
    "--model",
    "owner/model",
    "--dir",
    outputDir,
  ];
  await execFileAsync(process.execPath, command);
  await execFileAsync(process.execPath, command);

  const files = (await readdir(outputDir)).sort();
  assert.deepEqual(files, [
    "abc123__owner-model__orange-cat-reading-on-a-train__01.txt",
    "abc123__owner-model__orange-cat-reading-on-a-train__01__v002.txt",
    "abc123__owner-model__orange-cat-reading-on-a-train__02.txt",
    "abc123__owner-model__orange-cat-reading-on-a-train__02__v002.txt",
  ]);
});
