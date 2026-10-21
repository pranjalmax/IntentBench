import { pathToFileURL } from "node:url";

import { createProductRuntime, loadProductRuntimeConfig } from "./runtime.js";

export async function main(): Promise<void> {
  const config = loadProductRuntimeConfig(process.env, process.cwd());
  const { service, server } = createProductRuntime(config);
  await service.initialize();
  await new Promise<void>((resolve) => server.listen(config.port, config.host, resolve));
  process.stdout.write(
    `IntentBench API listening on http://${config.host}:${String(config.port)}\n`,
  );

  let stopping = false;
  const shutdown = (): void => {
    if (stopping) return;
    stopping = true;
    void (async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await service.shutdown();
    })().catch((error: unknown) => {
      process.exitCode = 1;
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

const entrypoint = process.argv[1];
if (entrypoint !== undefined && import.meta.url === pathToFileURL(entrypoint).href) {
  await main();
}
