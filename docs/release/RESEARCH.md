# Research and engineering report

## Executive finding

**The advanced verifier did not improve sealed final accuracy.** V0 and A1.1 each
correctly classified 8/12 candidates. A1.1 accepted one more golden but lost one
scored mutant detection to invalid structured output, at 5.175× runtime. Inspectable
requirements/evidence are an engineering contribution, not a demonstrated accuracy
advantage.

This summarizes immutable published artifacts, not a re-grading or repair of the
benchmark. [Original final report](../../research/FINAL-REPORT.md)
and [machine results](../../research/results/final-holdout-evaluation.json)
remain authoritative.

## How the question changed

| Stage        | Observation                                                                                                             | Consequence                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| DEV builders | B0 and same-agent self-review B1 each achieved 4/4 semantic conformance. B1 took 566,993 ms versus 386,430 ms (+46.7%). | No manufactured builder failure; investigate verification instead.       |
| DEV V0       | 8/8 classifications; all mutants detected and all goldens accepted.                                                     | Small DEV tasks were saturated for this model.                           |
| HARD-DEV V0  | 6/8 correct, 4/4 mutants, 2/4 goldens.                                                                                  | Requirement scope and false rejection became the development bottleneck. |
| A1.0         | 3/8 correct; all three valid outputs correct, five UNKNOWN.                                                             | Strict self-declared evidence-type consistency was brittle.              |
| A1.1         | 7/8 correct, 4/4 mutants, 3/4 goldens, zero UNKNOWN.                                                                    | Retain the narrow correction and freeze; no third iteration.             |

HARD-DEV influenced architecture development and is **not** independent final
evidence. Six distinct FINAL-HOLDOUT tasks were constructed, deterministically
validated and frozen before advanced-verifier development. Holdout model results
were not used for tuning. Builder conformance is not verifier classification accuracy.

## Controlled final methodology

- Twelve neutral blinded archives: golden and semantic mutant for each of six
  tasks. The same archive bytes were used in both arms.
- Inputs: public specification, candidate code, visible tests and normal project
  files only. No class labels, oracle, failure codes or private benchmark notes.
- Codex CLI 0.150.1, `gpt-5.6-sol`, high reasoning, same validated Docker isolation.
  No stronger model in the advanced arm.
- All V0 verdicts froze, then all A1.1 verdicts froze, then one deterministic truth
  reveal scored both arms. No oracle result returned to an agent.
- All twelve passed visible tests. Goldens yielded semantic PASS; intended mutants
  yielded semantic FAIL. Evaluator errors remain separate.
- Zero protocol violations or evaluator errors. One A1.1 structured-review error.
  No post-holdout tuning of prompt, gate, candidate, benchmark or verdict.

## Final comparison

| Metric                  |           V0 |         A1.1 |
| ----------------------- | -----------: | -----------: |
| Classification accuracy | 8/12 (66.7%) | 8/12 (66.7%) |
| Mutant detection        |   6/6 (100%) |  5/6 (83.3%) |
| Golden acceptance       |  2/6 (33.3%) |    3/6 (50%) |
| False accept            |          0/6 |          0/6 |
| False reject            |  4/6 (66.7%) |    3/6 (50%) |
| UNKNOWN                 |         0/12 |  1/12 (8.3%) |
| Total runtime           |   724,390 ms | 3,748,483 ms |
| Median runtime          |  58,015.5 ms | 311,730.5 ms |

Accuracy divides correct classifications by twelve; UNKNOWN is not correct. Mutant
detection and golden acceptance each divide by six. A1.1's UNKNOWN is neither a
false accept nor an oracle error. Runtime ratio 5.175 is not a dollar-cost estimate.
Exposed usage fields remain in original traces; no token/cost data is invented.

## All final candidates

| Candidate | Task     | Truth  | V0         | A1.1       | Semantic oracle / failure code                |
| --------- | -------- | ------ | ---------- | ---------- | --------------------------------------------- |
| CAND-001  | FINAL-02 | GOLDEN | INCOMPLETE | INCOMPLETE | PASS                                          |
| CAND-002  | FINAL-04 | GOLDEN | COMPLETE   | COMPLETE   | PASS                                          |
| CAND-003  | FINAL-01 | MUTANT | INCOMPLETE | INCOMPLETE | FAIL · `late-acquisition-lease-release`       |
| CAND-004  | FINAL-06 | MUTANT | INCOMPLETE | INCOMPLETE | FAIL · `generation-fence`                     |
| CAND-005  | FINAL-03 | MUTANT | INCOMPLETE | INCOMPLETE | FAIL · `migration-preserves-extension-fields` |
| CAND-006  | FINAL-04 | MUTANT | INCOMPLETE | INCOMPLETE | FAIL · `cache-epoch-publish`                  |
| CAND-007  | FINAL-02 | MUTANT | INCOMPLETE | UNKNOWN    | FAIL · `snapshot-record-values`               |
| CAND-008  | FINAL-05 | MUTANT | INCOMPLETE | INCOMPLETE | FAIL · `reserve-compensation-delta`           |
| CAND-009  | FINAL-06 | GOLDEN | INCOMPLETE | INCOMPLETE | PASS                                          |
| CAND-010  | FINAL-05 | GOLDEN | INCOMPLETE | INCOMPLETE | PASS                                          |
| CAND-011  | FINAL-03 | GOLDEN | INCOMPLETE | COMPLETE   | PASS                                          |
| CAND-012  | FINAL-01 | GOLDEN | COMPLETE   | COMPLETE   | PASS                                          |

Only CAND-011 (additional golden acceptance) and CAND-007 (valid V0 rejection versus
A1.1 UNKNOWN) differ. No candidate is omitted from the headline.

## Evidence quality and oracle limitations

Both systems substantively identified all six actual mutant defects. A1.1's
CAND-007 described the snapshot-value defect but added an unexpected field on
requirement 26; the frozen gate rejected the response. It scores UNKNOWN, not a
detection. Stable requirement/evidence IDs support inspection; equivalent wording
is not a missed defect merely because strings differ. Historic explanation
matching used precommitted deterministic rules, not an LLM truth judge.

“False reject” is relative to precommitted oracle labels. The original report
documents concrete JSON-compatibility/error-contract reproductions on some goldens
(CAND-001, CAND-009, CAND-010). These may expose **golden/oracle contract undercoverage**.
Do not dismiss every rejection as hypothetical, claim the oracle exhausts the
specification or silently change the scores. CAND-011 was the final golden V0
rejected but A1.1 accepted. Paired authentic traces, including the advanced system's
limitation, are in the [evidence index](EVIDENCE.md).

## Engineering contribution

Bounded archive intake, immutable snapshots, durable state/events, frozen profile
identities, isolated commands and a calibrated report support a genuine workflow.
The UI connects requirements to obligations/evidence, source, history and exports.
A new non-benchmark notes repository completed real isolated acceptance in about
176 seconds, with 20 requirements and six evidence records. That establishes an
integration path—not a new accuracy sample or correctness certificate.

Routine tests mock model output to conserve usage. Real acceptance, separate
networkless fixture tests, mocked failure paths and historical replay are labeled
separately; no frontend activity is fabricated.

## Limits and conclusion

Six constructed pairs, one model/profile and no repeated trials do not establish
statistical significance, production defect rates or general superiority. Authored
mutants are not a representative production corpus. Requirement extraction,
grounding, schema acceptance and oracle coverage all retain failure modes.
Full assistive-device and hostile multi-user deployment validation remain out of scope.

The defensible result is an **inspectable workbench with a documented negative
generalization result**, not a claim that architecture made the model more accurate.
Frozen systems/evidence remain unchanged; new research would need a new protocol,
not post-holdout tuning.
