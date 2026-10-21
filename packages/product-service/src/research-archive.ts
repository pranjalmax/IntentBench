import manifest from "../research-manifest.json" with { type: "json" };
import { ProductError } from "../../product-core/src/index.js";
import { readVerifiedFile } from "./read-only-files.js";

const studies = [
  {
    id: "final-holdout-evaluation",
    title: "Sealed final evaluation",
    context: "Generalization · same 12 candidates · no post-holdout tuning",
  },
  {
    id: "hard-dev-verification-a1.1",
    title: "HARD-DEV / A1.1",
    context: "Development evidence · second and final iteration",
  },
  {
    id: "hard-dev-verification-a1",
    title: "HARD-DEV / A1.0",
    context: "Development evidence · includes five UNKNOWN outputs",
  },
  {
    id: "hard-dev-verification-baseline",
    title: "HARD-DEV / V0",
    context: "Development evidence · general-purpose reviewer",
  },
  {
    id: "dev-verification-baseline",
    title: "DEV / V0",
    context: "Initial verification baseline · eight candidates",
  },
  {
    id: "dev-baselines",
    title: "DEV / builders",
    context: "Generation experiment · B0 versus same-agent self-review B1",
  },
] as const;
type Decision = { arm: string; verdict: string; correct: boolean | null; runtimeMs: number };
export interface ResearchRow {
  candidateId: string;
  taskId: string;
  truthClass: string;
  visible: string;
  oracle: string;
  failureCode: string | null;
  decisions: Decision[];
}
export interface ResearchStudy {
  id: string;
  title: string;
  context: string;
  mode: "REPLAY";
  completedAt: string;
  sha256: string;
  arms: { name: string; metrics: Record<string, number> }[];
  rows: ResearchRow[];
  traces: { id: string; label: string; sha256: string }[];
}
interface RecordedDecision {
  verdict: string;
  correct: boolean | null;
  runtimeMs: number;
}
interface RecordedRow {
  candidateId?: string;
  taskId: string;
  truthClass?: string;
  arm?: string;
  agentStatus?: string;
  verdict?: string;
  correct?: boolean;
  wallClockDurationMs?: number;
  visibleTests: { status: string };
  semanticOracle: { status: string; failureCode?: string };
  semanticFailureCode?: string | null;
  V0?: RecordedDecision;
  "A1.1"?: RecordedDecision;
}
interface RecordedResult {
  completedAt: string;
  metrics?: Record<string, number> | Record<string, Record<string, number>>;
  arms?: Record<string, { metrics: Record<string, number> }>;
  runs?: RecordedRow[];
  candidates?: RecordedRow[];
}
function unavailable(): never {
  throw new ProductError("RUN_NOT_FOUND", "Published research artifact not found.", {
    category: "INPUT",
  });
}

/** Explicitly allowlisted published artifacts only. No oracle or raw runtime paths. */
export class ResearchArchive {
  constructor(private readonly repositoryRoot: string) {}
  catalog() {
    return { mode: "REPLAY" as const, studies };
  }
  private async bytes(relativePath: string) {
    const entry = manifest.files.find((file) => file.path === relativePath);
    if (!entry) return unavailable();
    return await readVerifiedFile(
      this.repositoryRoot,
      entry.path,
      16 * 1024 * 1024,
      entry.sha256,
      true,
    );
  }
  async study(id: string): Promise<ResearchStudy> {
    const definition = studies.find((study) => study.id === id);
    if (!definition) return unavailable();
    const file = `research/results/${id}.json`;
    const recorded = JSON.parse((await this.bytes(file)).toString("utf8")) as RecordedResult;
    let arms: ResearchStudy["arms"];
    if (recorded.arms)
      arms = Object.entries(recorded.arms).map(([name, value]) => ({
        name,
        metrics: value.metrics,
      }));
    else if (id === "dev-baselines")
      arms = Object.entries(recorded.metrics as Record<string, Record<string, number>>).map(
        ([name, metrics]) => ({ name, metrics }),
      );
    else
      arms = [
        {
          name: id.endsWith("a1.1") ? "A1.1" : id.endsWith("a1") ? "A1.0" : "V0",
          metrics: recorded.metrics as Record<string, number>,
        },
      ];
    const rows = (recorded.candidates ?? recorded.runs ?? []).map((row, index): ResearchRow => ({
      candidateId: row.candidateId ?? `${row.arm ?? "run"}-${String(index + 1)}`,
      taskId: row.taskId,
      truthClass: row.truthClass ?? "Builder seed",
      visible: row.visibleTests.status,
      oracle: row.semanticOracle.status,
      failureCode: row.semanticFailureCode ?? row.semanticOracle.failureCode ?? null,
      decisions: recorded.arms
        ? arms.map((arm) => {
            const decision = row[arm.name as "V0" | "A1.1"];
            if (!decision) throw new Error("Published decision missing");
            return {
              arm: arm.name,
              verdict: decision.verdict,
              correct: decision.correct,
              runtimeMs: decision.runtimeMs,
            };
          })
        : [
            {
              arm: row.arm ?? arms[0]?.name ?? "",
              verdict: row.verdict ?? row.agentStatus ?? "UNKNOWN",
              correct: row.correct ?? null,
              runtimeMs: row.wallClockDurationMs ?? 0,
            },
          ],
    }));
    return {
      ...definition,
      mode: "REPLAY",
      completedAt: recorded.completedAt,
      sha256: manifest.files.find((entry) => entry.path === file)?.sha256 ?? "",
      arms,
      rows,
      traces:
        id === "final-holdout-evaluation"
          ? manifest.files
              .filter((entry) => entry.path.startsWith("trajectories/final-holdout-evaluation/"))
              .map((entry) => {
                const segments = entry.path.split("/");
                return {
                  id: `${segments[2] ?? ""}-${segments[3] ?? ""}`,
                  label: `${segments[2] ?? ""} / ${segments[3] ?? ""}`,
                  sha256: entry.sha256,
                };
              })
          : [],
    };
  }
  async trajectory(id: string, offset: number) {
    const match = /^(V0|A1\.1)-(CAND-\d{3})$/u.exec(id);
    if (!match || !Number.isSafeInteger(offset) || offset < 0) return unavailable();
    const relativePath = `trajectories/final-holdout-evaluation/${match[1] ?? ""}/${match[2] ?? ""}/trace.jsonl`;
    const lines = (await this.bytes(relativePath)).toString("utf8").trimEnd().split(/\r?\n/u);
    return {
      mode: "REPLAY" as const,
      id,
      offset,
      total: lines.length,
      lines: lines.slice(offset, offset + 10),
      sha256: manifest.files.find((file) => file.path === relativePath)?.sha256 ?? "",
    };
  }
}
