---
feature_ids: [AI_INSPECTION_COPILOT_OFFLINE_DEMO]
topics: [aiops, inspection, compiler, fixture-leak, review-fix]
doc_kind: bug-report
created: 2026-08-09
---

# Generic inspection workspace leaked domain fixture semantics

## Reporter

Terra found the defect during independent review by submitting a non-fixture `fulfillment-service` request and expanding every Check Contract.

## Reproduction

1. Open the offline product from `file://`.
2. Submit `升级 fulfillment-service v7.2.0，验证履约状态和下游调用。`.
3. Confirm scope and expand all formal Checks.
4. Expected: every source, entity, rationale and action belongs to `fulfillment-service`.
5. Actual before repair: the plan contained `order-graph`, `order-trace`, `payment-dependency`, `支付完成率` and `暂停并下钻支付 Trace`.

## Root cause

`compileGenericWorkspace()` cloned the complete order domain fixture and attempted to generalize it with a finite string replacement table. The product contract was open-ended, while the rewrite list was closed; any new or overlooked fixture-bearing field silently crossed domains. Recursive diagnosis found ten leaked values across source IDs, source detail, Check IDs, source references and failure actions.

## Repair

- Removed clone-and-rewrite from the generic branch.
- Constructed generic context sources, hypotheses, candidate Checks, committed Check Contracts, execution facts and report fields directly from the normalized request and current service.
- Kept fixture cloning only behind explicit known-domain matching for the two editable examples.
- Added a recursive unit regression for forbidden fixture residue.
- Added a real `file://` browser regression that expands every `fulfillment-service` Check and inspects user-visible content.

## Verification

- Red: `node --test tests/compiler.test.mjs` failed with ten leaked domain values.
- Green: the same test passes and asserts the serialized generic workspace contains no `order|payment|订单|支付` residue.
- Full gate: `pnpm check` passes 22/22 tests plus two browser journeys with zero network requests and zero browser errors.
- Visual evidence: `evidence/01-user-defined-proceed.png` shows the final `fulfillment-service` scoped report.

## Failure-mode sweep

Invariant: a generic workspace must be generated from its own request context, never by mutating a domain fixture.

Scanned:

- all fields returned by `compileGenericWorkspace()`;
- every source ID and `sourceRef`;
- all Check `purpose`, `entity`, `rationale`, `failureAction` and metrics;
- execution facts and final report;
- all `cloneFixture()` call sites.

Result: generic branch has zero domain fixture references. The two remaining `cloneFixture()` calls are confined to explicit `order-api` and payment-risk domain matches.

[丢丢/gpt-5.6-sol🐾]
