export const evidenceTypes = [
  "STATIC_SOURCE",
  "VISIBLE_TEST",
  "TARGETED_RUNTIME",
  "PUBLIC_CONFIG",
  "PACKAGE_CONTRACT",
] as const;

export type EvidenceType = (typeof evidenceTypes)[number];
export type RequirementClass = "REQUIRED" | "ADVISORY";
export type EvidenceDisposition = "SUPPORTS" | "CONTRADICTS" | "INCONCLUSIVE";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface Requirement {
  id: string;
  classification: RequirementClass;
  statement: string;
  criticality: "CRITICAL" | "IMPORTANT" | "NORMAL";
  observableSuccessCondition: string;
  allowedEvidenceTypes: EvidenceType[];
}

export interface ProofObligation {
  requirementId: string;
  proposition: string;
  evidencePlan: string;
}

export interface Evidence {
  id: string;
  requirementIds: string[];
  evidenceType: EvidenceType;
  reproduction: string;
  observedBehavior: string;
  disposition: EvidenceDisposition;
}

export interface ProposedFinding {
  id: string;
  proposedSeverity: "BLOCKING" | "ADVISORY";
  requirementId: string | null;
  requirementStatement: string | null;
  claim: string;
  evidenceIds: string[];
  evidenceType: EvidenceType;
  reproduction: string;
  observedBehavior: string;
  expectedBehavior: string;
  confidence: Confidence;
  calibration: {
    explicitRequirement: boolean;
    concreteObservedEvidence: boolean;
    reproducible: boolean;
    materialToCompliance: boolean;
  };
}

export interface AgentReview {
  schemaVersion: "1.0.0";
  requirements: Requirement[];
  proofObligations: ProofObligation[];
  evidence: Evidence[];
  proposedFindings: ProposedFinding[];
}

export interface CalibratedFinding extends ProposedFinding {
  calibratedSeverity: "BLOCKING" | "ADVISORY";
  calibrationReason: string;
}

export interface CalibratedReview {
  schemaVersion: "1.0.0";
  requirements: Requirement[];
  proofObligations: ProofObligation[];
  evidence: Evidence[];
  blockingFindings: CalibratedFinding[];
  advisories: CalibratedFinding[];
  coverage: Array<{ requirementId: string; evidenceIds: string[] }>;
  verdict: "COMPLETE" | "INCOMPLETE";
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "")
    throw new TypeError(`${label} must be nonempty`);
  return value.trim();
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new TypeError(`${label} must be nonempty`);
  const values = value.map((entry, index) => string(entry, `${label}[${String(index)}]`));
  if (new Set(values).size !== values.length) throw new TypeError(`${label} must be unique`);
  return values;
}

function enumeration<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T))
    throw new TypeError(`${label} is invalid`);
  return value as T;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be boolean`);
  return value;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new TypeError(`${label} has unexpected fields`);
}

function sequentialIds(values: Array<{ id: string }>, prefix: string, label: string): void {
  const expected = values.map((_, index) => `${prefix}${String(index + 1)}`);
  if (values.map((value) => value.id).join("|") !== expected.join("|")) {
    throw new TypeError(`${label} IDs must be sequential`);
  }
}

export function parseAgentReview(value: unknown): AgentReview {
  const root = record(value, "review");
  exactKeys(
    root,
    ["schemaVersion", "requirements", "proofObligations", "evidence", "proposedFindings"],
    "review",
  );
  if (root.schemaVersion !== "1.0.0") throw new TypeError("unsupported schemaVersion");
  if (!Array.isArray(root.requirements) || root.requirements.length === 0)
    throw new TypeError("requirements must be nonempty");
  const requirements = root.requirements.map((entry, index): Requirement => {
    const item = record(entry, `requirements[${String(index)}]`);
    exactKeys(
      item,
      [
        "id",
        "classification",
        "statement",
        "criticality",
        "observableSuccessCondition",
        "allowedEvidenceTypes",
      ],
      `requirements[${String(index)}]`,
    );
    return {
      id: string(item.id, `requirements[${String(index)}].id`),
      classification: enumeration(
        item.classification,
        ["REQUIRED", "ADVISORY"],
        `requirements[${String(index)}].classification`,
      ),
      statement: string(item.statement, `requirements[${String(index)}].statement`),
      criticality: enumeration(
        item.criticality,
        ["CRITICAL", "IMPORTANT", "NORMAL"],
        `requirements[${String(index)}].criticality`,
      ),
      observableSuccessCondition: string(
        item.observableSuccessCondition,
        `requirements[${String(index)}].observableSuccessCondition`,
      ),
      allowedEvidenceTypes: stringArray(
        item.allowedEvidenceTypes,
        `requirements[${String(index)}].allowedEvidenceTypes`,
      ).map((type) => enumeration(type, evidenceTypes, "evidence type")),
    };
  });
  sequentialIds(requirements, "R", "requirement");
  const requirementMap = new Map(requirements.map((item) => [item.id, item]));

  if (!Array.isArray(root.proofObligations))
    throw new TypeError("proofObligations must be an array");
  const proofObligations = root.proofObligations.map((entry, index): ProofObligation => {
    const item = record(entry, `proofObligations[${String(index)}]`);
    exactKeys(
      item,
      ["requirementId", "proposition", "evidencePlan"],
      `proofObligations[${String(index)}]`,
    );
    const requirementId = string(item.requirementId, "proof obligation requirementId");
    if (!requirementMap.has(requirementId))
      throw new TypeError(`unknown requirement ${requirementId}`);
    return {
      requirementId,
      proposition: string(item.proposition, "proposition"),
      evidencePlan: string(item.evidencePlan, "evidencePlan"),
    };
  });
  const obligated = new Set(proofObligations.map((item) => item.requirementId));
  for (const requirement of requirements.filter((item) => item.classification === "REQUIRED")) {
    if (!obligated.has(requirement.id))
      throw new TypeError(`missing proof obligation for ${requirement.id}`);
  }

  if (!Array.isArray(root.evidence) || root.evidence.length === 0)
    throw new TypeError("evidence must be nonempty");
  const evidence = root.evidence.map((entry, index): Evidence => {
    const item = record(entry, `evidence[${String(index)}]`);
    exactKeys(
      item,
      ["id", "requirementIds", "evidenceType", "reproduction", "observedBehavior", "disposition"],
      `evidence[${String(index)}]`,
    );
    const requirementIds = stringArray(item.requirementIds, "evidence requirementIds");
    const evidenceType = enumeration(item.evidenceType, evidenceTypes, "evidenceType");
    for (const requirementId of requirementIds) {
      const requirement = requirementMap.get(requirementId);
      if (!requirement) throw new TypeError(`unknown requirement ${requirementId}`);
    }
    return {
      id: string(item.id, "evidence id"),
      requirementIds,
      evidenceType,
      reproduction: string(item.reproduction, "evidence reproduction"),
      observedBehavior: string(item.observedBehavior, "observedBehavior"),
      disposition: enumeration(
        item.disposition,
        ["SUPPORTS", "CONTRADICTS", "INCONCLUSIVE"],
        "disposition",
      ),
    };
  });
  sequentialIds(evidence, "E", "evidence");
  const evidenceMap = new Map(evidence.map((item) => [item.id, item]));

  if (!Array.isArray(root.proposedFindings))
    throw new TypeError("proposedFindings must be an array");
  const proposedFindings = root.proposedFindings.map((entry, index): ProposedFinding => {
    const item = record(entry, `proposedFindings[${String(index)}]`);
    exactKeys(
      item,
      [
        "id",
        "proposedSeverity",
        "requirementId",
        "requirementStatement",
        "claim",
        "evidenceIds",
        "evidenceType",
        "reproduction",
        "observedBehavior",
        "expectedBehavior",
        "confidence",
        "calibration",
      ],
      `proposedFindings[${String(index)}]`,
    );
    const calibration = record(item.calibration, "calibration");
    exactKeys(
      calibration,
      ["explicitRequirement", "concreteObservedEvidence", "reproducible", "materialToCompliance"],
      "calibration",
    );
    const requirementId =
      item.requirementId === null ? null : string(item.requirementId, "finding requirementId");
    const requirementStatement =
      item.requirementStatement === null
        ? null
        : string(item.requirementStatement, "finding requirementStatement");
    const evidenceIds = stringArray(item.evidenceIds, "finding evidenceIds");
    for (const evidenceId of evidenceIds)
      if (!evidenceMap.has(evidenceId)) throw new TypeError(`unknown evidence ${evidenceId}`);
    return {
      id: string(item.id, "finding id"),
      proposedSeverity: enumeration(
        item.proposedSeverity,
        ["BLOCKING", "ADVISORY"],
        "proposedSeverity",
      ),
      requirementId,
      requirementStatement,
      claim: string(item.claim, "claim"),
      evidenceIds,
      evidenceType: enumeration(item.evidenceType, evidenceTypes, "finding evidenceType"),
      reproduction: string(item.reproduction, "finding reproduction"),
      observedBehavior: string(item.observedBehavior, "finding observedBehavior"),
      expectedBehavior: string(item.expectedBehavior, "finding expectedBehavior"),
      confidence: enumeration(item.confidence, ["HIGH", "MEDIUM", "LOW"], "confidence"),
      calibration: {
        explicitRequirement: boolean(calibration.explicitRequirement, "explicitRequirement"),
        concreteObservedEvidence: boolean(
          calibration.concreteObservedEvidence,
          "concreteObservedEvidence",
        ),
        reproducible: boolean(calibration.reproducible, "reproducible"),
        materialToCompliance: boolean(calibration.materialToCompliance, "materialToCompliance"),
      },
    };
  });
  sequentialIds(proposedFindings, "F", "finding");
  return { schemaVersion: "1.0.0", requirements, proofObligations, evidence, proposedFindings };
}

function calibrateFinding(
  finding: ProposedFinding,
  requirements: Map<string, Requirement>,
  evidence: Map<string, Evidence>,
): CalibratedFinding {
  const requirement = finding.requirementId ? requirements.get(finding.requirementId) : undefined;
  const cited = finding.evidenceIds
    .map((id) => evidence.get(id))
    .filter((item): item is Evidence => Boolean(item));
  const contradiction = cited.some(
    (item) =>
      item.disposition === "CONTRADICTS" &&
      finding.requirementId !== null &&
      item.requirementIds.includes(finding.requirementId),
  );
  const calibrationPass = Object.values(finding.calibration).every(Boolean);
  const reasons: string[] = [];
  if (finding.proposedSeverity !== "BLOCKING")
    reasons.push("agent classified the concern as advisory");
  if (!requirement || requirement.classification !== "REQUIRED")
    reasons.push("no explicit REQUIRED requirement mapping");
  if (requirement && finding.requirementStatement !== requirement.statement)
    reasons.push("requirement statement does not match the ledger");
  if (!contradiction) reasons.push("no cited contradictory evidence for the mapped requirement");
  if (!calibrationPass) reasons.push("one or more calibration checks failed");
  if (finding.confidence !== "HIGH") reasons.push("blocking confidence is below HIGH");
  const blocking = reasons.length === 0;
  return {
    ...finding,
    calibratedSeverity: blocking ? "BLOCKING" : "ADVISORY",
    calibrationReason: blocking
      ? "explicit requirement plus reproducible contradictory evidence passed every calibration check"
      : reasons.join("; "),
  };
}

export function calibrateReview(value: unknown): CalibratedReview {
  const parsed = parseAgentReview(value);
  const requirementMap = new Map(parsed.requirements.map((item) => [item.id, item]));
  const evidenceMap = new Map(parsed.evidence.map((item) => [item.id, item]));
  const coverage = parsed.requirements
    .filter((item) => item.classification === "REQUIRED")
    .map((requirement) => ({
      requirementId: requirement.id,
      evidenceIds: parsed.evidence
        .filter(
          (item) =>
            item.requirementIds.includes(requirement.id) && item.disposition !== "INCONCLUSIVE",
        )
        .map((item) => item.id),
    }));
  const missing = coverage.filter((entry) => entry.evidenceIds.length === 0);
  if (missing.length > 0)
    throw new TypeError(
      `insufficient evidence coverage for ${missing.map((item) => item.requirementId).join(", ")}`,
    );
  const findings = parsed.proposedFindings.map((finding) =>
    calibrateFinding(finding, requirementMap, evidenceMap),
  );
  const blockingFindings = findings.filter((finding) => finding.calibratedSeverity === "BLOCKING");
  return {
    schemaVersion: "1.0.0",
    requirements: parsed.requirements,
    proofObligations: parsed.proofObligations,
    evidence: parsed.evidence,
    blockingFindings,
    advisories: findings.filter((finding) => finding.calibratedSeverity === "ADVISORY"),
    coverage,
    verdict: blockingFindings.length > 0 ? "INCOMPLETE" : "COMPLETE",
  };
}
