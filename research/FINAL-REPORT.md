# FINAL-HOLDOUT evaluation

Frozen V0 and frozen A1.1 were evaluated on the same twelve one-time blinded candidate archives. Both arms were frozen before the single evaluator truth reveal.

| Metric                  |           V0 |         A1.1 |
| ----------------------- | -----------: | -----------: |
| Classification accuracy | 8/12 (66.7%) | 8/12 (66.7%) |
| Mutant detection        | 6/6 (100.0%) |  5/6 (83.3%) |
| Golden acceptance       |  2/6 (33.3%) |  3/6 (50.0%) |
| False accept            |   0/6 (0.0%) |   0/6 (0.0%) |
| False reject            |  4/6 (66.7%) |  3/6 (50.0%) |
| UNKNOWN                 |  0/12 (0.0%) |  1/12 (8.3%) |
| Total runtime           |    724390 ms |   3748483 ms |
| Median runtime          |   58015.5 ms |  311730.5 ms |

A1.1/V0 runtime ratio: 5.175.

| Candidate | Task     | Truth  | V0         | A1.1       | Oracle | Failure code                         | V0 correct | A1.1 correct |
| --------- | -------- | ------ | ---------- | ---------- | ------ | ------------------------------------ | ---------- | ------------ |
| CAND-001  | FINAL-02 | GOLDEN | INCOMPLETE | INCOMPLETE | PASS   | —                                    | no         | no           |
| CAND-002  | FINAL-04 | GOLDEN | COMPLETE   | COMPLETE   | PASS   | —                                    | yes        | yes          |
| CAND-003  | FINAL-01 | MUTANT | INCOMPLETE | INCOMPLETE | FAIL   | late-acquisition-lease-release       | yes        | yes          |
| CAND-004  | FINAL-06 | MUTANT | INCOMPLETE | INCOMPLETE | FAIL   | generation-fence                     | yes        | yes          |
| CAND-005  | FINAL-03 | MUTANT | INCOMPLETE | INCOMPLETE | FAIL   | migration-preserves-extension-fields | yes        | yes          |
| CAND-006  | FINAL-04 | MUTANT | INCOMPLETE | INCOMPLETE | FAIL   | cache-epoch-publish                  | yes        | yes          |
| CAND-007  | FINAL-02 | MUTANT | INCOMPLETE | UNKNOWN    | FAIL   | snapshot-record-values               | yes        | no           |
| CAND-008  | FINAL-05 | MUTANT | INCOMPLETE | INCOMPLETE | FAIL   | reserve-compensation-delta           | yes        | yes          |
| CAND-009  | FINAL-06 | GOLDEN | INCOMPLETE | INCOMPLETE | PASS   | —                                    | no         | no           |
| CAND-010  | FINAL-05 | GOLDEN | INCOMPLETE | INCOMPLETE | PASS   | —                                    | no         | no           |
| CAND-011  | FINAL-03 | GOLDEN | INCOMPLETE | COMPLETE   | PASS   | —                                    | no         | yes          |
| CAND-012  | FINAL-01 | GOLDEN | COMPLETE   | COMPLETE   | PASS   | —                                    | yes        | yes          |

All twelve candidates passed their provided visible tests. Per-review runtime and mutant-defect evidence matching were:

| Candidate | Visible | V0 runtime | A1.1 runtime | V0 defect match | A1.1 defect match                  |
| --------- | ------- | ---------: | -----------: | --------------- | ---------------------------------- |
| CAND-001  | PASS    |   66018 ms |    358300 ms | —               | —                                  |
| CAND-002  | PASS    |   60509 ms |    212582 ms | —               | —                                  |
| CAND-003  | PASS    |   60554 ms |    290031 ms | yes             | yes                                |
| CAND-004  | PASS    |   42754 ms |    362152 ms | yes             | yes                                |
| CAND-005  | PASS    |   55522 ms |    423185 ms | yes             | yes                                |
| CAND-006  | PASS    |   55055 ms |    227604 ms | yes             | yes                                |
| CAND-007  | PASS    |   44601 ms |    352628 ms | yes             | yes, but invalid structured output |
| CAND-008  | PASS    |   51879 ms |    269549 ms | yes             | yes                                |
| CAND-009  | PASS    |   44416 ms |    302468 ms | —               | —                                  |
| CAND-010  | PASS    |   77345 ms |    298062 ms | —               | —                                  |
| CAND-011  | PASS    |   69612 ms |    330929 ms | —               | —                                  |
| CAND-012  | PASS    |   96125 ms |    320993 ms | —               | —                                  |

## Frozen identities and fairness

- FINAL-HOLDOUT tree: `6a927bb5319a946c906e8698c26ca26de86c1899`
- FINAL-HOLDOUT content hash: `fe54a6e048f6c568593df8416bced2356619803a267bd6be284b6703a6b41789`
- Final evaluation protocol hash: `f5cf707f69035c88ca6bd659ddf836f5ce46934e795298000e0c83b35e429fad`
- V0 prompt: `85b30d08912edc13fbfbc0280504635ce4213712df2b5c724846683c6e30509e`
- V0 config: `d23d382cda211d49ff190153b8a9c843a0af4497ef4bd89c0b62d01b5930ecd5`
- V0 HARD-DEV protocol: `62c5d9e34281ec54d743eaa9313adfb231dc9e7aee1047784f4cb25949bcc0e9`
- A1.1 prompt: `0b9c8e11296b1735a51b59f322a0d5fadaaeadf56688061056d3b0bf57c1d3c2`
- A1.1 config: `f5ad0f7cca23196d73a76fa61c64b9b27d43382fd90d03cdd6fbc9609eab902a`
- A1.1 gate: `9ea3ed019e8cb7d0b316960f4a0c5091aa69149a81f875c9166322c840764728`
- A1.1 protocol: `eceea1297edfb27b83a2280d99d48c834eae73b5dae6e2dff2c8cf3b929031fe`
- A1.1 freeze commit: `e6dc7f5ce89e4ee41250d916579b10839b73ef51`
- Controlled runtime: Codex CLI 0.150.1, `gpt-5.6-sol`, high reasoning, Docker image `sha256:e77098ecaea63d73e29b114d18e847aac74379eb686b821046bfc87ec8f67ee4`

The archives below were created once. Both arms received copies whose digest matched the same source archive before execution.

| Candidate | Archive SHA-256                                                    |
| --------- | ------------------------------------------------------------------ |
| CAND-001  | `2b03eeeb3cba384cde9f8158333f0cba4e6fc2e0f09e6e186bb22d24e7a10114` |
| CAND-002  | `b57757b461419a2299eda8ccc531cf1e109c33e79dbf883b3a30317dd4e94134` |
| CAND-003  | `8aa8bd9fe1d43baab469a641eff068d95a552a6eecb2acfc7e6444341781842c` |
| CAND-004  | `e6c0ec05ca6fbd0f3a8b98356cc46ec5b9cc9ed68fb3795696c73edb403e2709` |
| CAND-005  | `e74fac7bbab4bf9e76d39e43c1ee776e540199937c08d53e414f5f5488012bb5` |
| CAND-006  | `1220e618db94b475f44c7c940006bfd655fd38f51ebda937ec9d49d9f3c362cf` |
| CAND-007  | `7d43821cc871ce8ba489ea72cb4cbe1b26678de6de638f19cb4e3547eee0fb95` |
| CAND-008  | `f0eca2cbe8c147c69ec4a0744bb76a680eb4bc748d8a3c494e1ce450d089f3f8` |
| CAND-009  | `4e9627a1b59ad0eeac3bd1f74f520d2ae151cb3192e82421632312eab436c864` |
| CAND-010  | `684404877e46d1dc06bc2640f7ddc583e967675e5ce4ee39aa7d202c1f4001b3` |
| CAND-011  | `2b81742f3ee3d2608e31393b00cb66a0938bc5d8a1b2989b1978e479ad2d8f39` |
| CAND-012  | `73cdf8c153aa65ba5f8853fc292a306f52035e091b7c5fc6df952dcf898e6cba` |

## Per-task generalization

- FINAL-01: both systems rejected the mutant and accepted the golden.
- FINAL-02: V0 rejected the mutant; A1.1 substantively identified the snapshot defect but its output failed the frozen schema gate and scored UNKNOWN. Both rejected the golden.
- FINAL-03: both rejected the mutant; A1.1 accepted the golden while V0 rejected it.
- FINAL-04: both systems rejected the mutant and accepted the golden.
- FINAL-05: both rejected the mutant and both rejected the golden.
- FINAL-06: both rejected the mutant and both rejected the golden.

On oracle-defined labels, A1.1 therefore improved golden acceptance by one candidate but lost one scored mutant detection to structured-output invalidity. Net classification accuracy did not improve, while runtime increased by 5.175×.

## Explanation and evidence quality

V0's explanations matched the actual semantic defect for all six mutants. A1.1's evidence also substantively identified all six mutant defects. Five produced valid calibrated blockers; CAND-007 identified the snapshot-value defect in its raw structured response, but an unexpected field on requirement 26 made the frozen gate reject the entire response. It is therefore scored UNKNOWN rather than as a mutant detection.

The false rejects are important limitations. On CAND-001, both systems reported that the golden accepts non-JSON-compatible record values and sometimes throws `DataCloneError` rather than the specified `TypeError`. On CAND-009, both reported analogous JSON-compatibility and event-validation concerns. On CAND-010, both reproduced a native uncoded `TypeError` for an invalid `restock` quantity instead of `ERR_REQUEST`. V0 additionally rejected CAND-011 for JSON-compatibility and repository-result validation; A1.1 calibrated those concerns away and accepted it.

Because the deterministic semantic oracle is the precommitted authority, these are scored as false rejects. However, several are concrete reproductions tied to explicit public wording, so the result also exposes possible golden/oracle contract undercoverage. That benchmark limitation should be investigated only after this sealed evaluation, without changing these published scores.

## Integrity and validation

- All 24 verdicts and trajectories predate the one truth reveal at `2026-10-05T23:22:55.124Z`.
- All 12 visible tests passed; six goldens produced semantic PASS and six mutants produced semantic FAIL. There were no evaluator errors.
- There were no reviewer process errors or protocol violations. A1.1 had one structured-review error and one UNKNOWN; V0 had neither.
- Trace and run-artifact scans found no private oracle paths, truth filenames, personal absolute paths, or credential patterns.
- The published machine result validates against the locked schema. The process runner emitted fractional evaluator timings; the published artifact rounds only those 24 timing fields to the schema-required integer milliseconds. No verdict, oracle result, failure code, metric, or review runtime changed.
- Authored protocol/results files pass Prettier; archived model-produced structured evidence was deliberately left byte-identical after Phase A freeze.
- ESLint passed, TypeScript typecheck passed, 16 Vitest files / 85 tests passed, and the production TypeScript plus oracle build passed.
- HARD-DEV and FINAL-HOLDOUT Git trees remain unchanged.

No reviewer or verifier was rerun after truth reveal, and no prompt, config, gate, benchmark, candidate archive, verdict, or calibration behavior was changed.
