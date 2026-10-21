import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import yazl from "yazl";

import type { AgentReview } from "../../advanced-verifier/src/gate.js";
import type {
  IsolatedExecutionRequest,
  IsolatedExecutionResult,
  IsolatedVerifierExecutor,
  ModelActivity,
  VerificationModelRunner,
  VerificationModelRunnerInput,
  VerificationModelRunnerResult,
} from "../src/index.js";

export async function writeFixtureZip(sourceRoot: string, target: string): Promise<void> {
  const files = ["SPEC.md", "package.json", "src/counter.ts", "tests/visible.ts"];
  await mkdir(path.dirname(target), { recursive: true });
  const zip = new yazl.ZipFile();
  for (const relativePath of files) {
    zip.addBuffer(await readFile(path.join(sourceRoot, relativePath)), relativePath);
  }
  const chunks: Buffer[] = [];
  zip.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<void>((resolve, reject) => {
    zip.outputStream.on("end", resolve);
    zip.outputStream.on("error", reject);
  });
  zip.end();
  await completed;
  await writeFile(target, Buffer.concat(chunks));
}

export function supportingReview(): AgentReview {
  return {
    schemaVersion: "1.0.0",
    requirements: [
      {
        id: "R1",
        classification: "REQUIRED",
        statement: "Return a new object with the advanced value without mutating current.",
        criticality: "IMPORTANT",
        observableSuccessCondition: "The result is advanced and current is unchanged.",
        allowedEvidenceTypes: ["STATIC_SOURCE", "VISIBLE_TEST"],
      },
    ],
    proofObligations: [
      {
        requirementId: "R1",
        proposition: "The implementation returns a distinct correctly advanced object.",
        evidencePlan: "Inspect the implementation and run the visible test.",
      },
    ],
    evidence: [
      {
        id: "E1",
        requirementIds: ["R1"],
        evidenceType: "STATIC_SOURCE",
        reproduction: "Read src/counter.ts.",
        observedBehavior: "The function returns a new object and does not assign to current.",
        disposition: "SUPPORTS",
      },
    ],
    proposedFindings: [],
  };
}

export function contradictoryReview(): AgentReview {
  const review = supportingReview();
  const requirement = review.requirements[0];
  if (requirement === undefined) throw new Error("supporting review fixture is invalid");
  review.evidence = [
    {
      id: "E1",
      requirementIds: ["R1"],
      evidenceType: "TARGETED_RUNTIME",
      reproduction: "Call the function with a frozen current object.",
      observedBehavior: "The candidate attempted to assign to current.value.",
      disposition: "CONTRADICTS",
    },
  ];
  review.proposedFindings = [
    {
      id: "F1",
      proposedSeverity: "BLOCKING",
      requirementId: "R1",
      requirementStatement: requirement.statement,
      claim: "The implementation mutates the caller-owned current object.",
      evidenceIds: ["E1"],
      evidenceType: "TARGETED_RUNTIME",
      reproduction: "Call the function with a frozen current object.",
      observedBehavior: "The candidate attempted to assign to current.value.",
      expectedBehavior: "The current object remains unchanged.",
      confidence: "HIGH",
      calibration: {
        explicitRequirement: true,
        concreteObservedEvidence: true,
        reproducible: true,
        materialToCompliance: true,
      },
    },
  ];
  return review;
}

export class FakeIsolatedExecutor implements IsolatedVerifierExecutor {
  readonly requests: IsolatedExecutionRequest[] = [];
  constructor(
    private readonly result: IsolatedExecutionResult,
    private readonly activities: ModelActivity[] = [],
  ) {}

  async verifyAvailable(): Promise<void> {}

  async execute(request: IsolatedExecutionRequest): Promise<IsolatedExecutionResult> {
    this.requests.push(request);
    for (const activity of this.activities) await request.onActivity(activity);
    return this.result;
  }
}

export class FakeModelRunner implements VerificationModelRunner {
  constructor(
    private readonly behavior: (
      input: VerificationModelRunnerInput,
    ) => Promise<VerificationModelRunnerResult>,
  ) {}

  async verifyAvailable(): Promise<void> {}

  async run(input: VerificationModelRunnerInput): Promise<VerificationModelRunnerResult> {
    return await this.behavior(input);
  }
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
