import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { durableCreateJson, ProductError } from "../../product-core/src/index.js";
import {
  activitySources,
  type ActivitySource,
  type VerificationActivityEvent,
} from "./contracts.js";

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const kindPattern = /^[A-Z][A-Z0-9_]{0,63}$/u;
const eventPattern = /^event-(\d{8})\.json$/u;

function safeRunId(runId: string): string {
  if (!identifierPattern.test(runId)) {
    throw new ProductError("RUN_NOT_FOUND", "run identifier is invalid", { category: "STATE" });
  }
  return runId;
}

function parseEvent(value: unknown): VerificationActivityEvent {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("event must be an object");
  }
  const item = value as Record<string, unknown>;
  if (item.schemaVersion !== "1.0.0") throw new TypeError("unsupported event schema");
  if (typeof item.runId !== "string" || !identifierPattern.test(item.runId)) {
    throw new TypeError("invalid event runId");
  }
  if (
    typeof item.sequence !== "number" ||
    !Number.isSafeInteger(item.sequence) ||
    item.sequence < 1
  ) {
    throw new TypeError("invalid event sequence");
  }
  if (typeof item.occurredAt !== "string" || !Number.isFinite(Date.parse(item.occurredAt))) {
    throw new TypeError("invalid event timestamp");
  }
  if (!activitySources.includes(item.source as ActivitySource))
    throw new TypeError("invalid event source");
  if (typeof item.kind !== "string" || !kindPattern.test(item.kind))
    throw new TypeError("invalid event kind");
  if (typeof item.message !== "string" || item.message.length === 0 || item.message.length > 500) {
    throw new TypeError("invalid event message");
  }
  return item as unknown as VerificationActivityEvent;
}

export class FileEventStore {
  readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  async append(
    input: Omit<VerificationActivityEvent, "schemaVersion" | "sequence">,
  ): Promise<VerificationActivityEvent> {
    const existing = await this.read(input.runId);
    const event = parseEvent({
      schemaVersion: "1.0.0",
      ...input,
      sequence: existing.length + 1,
    });
    const target = path.join(
      this.root,
      safeRunId(input.runId),
      `event-${String(event.sequence).padStart(8, "0")}.json`,
    );
    try {
      await durableCreateJson(target, event);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new ProductError("RUN_CONFLICT", "activity event sequence conflict", {
          category: "STATE",
          retryable: true,
          cause: error,
        });
      }
      throw error;
    }
    return event;
  }

  async read(runId: string, after = 0): Promise<VerificationActivityEvent[]> {
    const directory = path.join(this.root, safeRunId(runId));
    let names: string[];
    try {
      names = (await readdir(directory))
        .filter((name) => eventPattern.test(name))
        .sort((left, right) => left.localeCompare(right, "en"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const events: VerificationActivityEvent[] = [];
    for (const name of names) {
      try {
        const event = parseEvent(JSON.parse(await readFile(path.join(directory, name), "utf8")));
        if (event.sequence !== events.length + 1) throw new TypeError("event sequence is invalid");
        events.push(event);
      } catch (error) {
        throw new ProductError("RUN_STORE_CORRUPT", `stored activity event is corrupt: ${name}`, {
          category: "INTERNAL",
          cause: error,
        });
      }
    }
    return events.filter((event) => event.sequence > after);
  }
}
