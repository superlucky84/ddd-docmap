# Checkout — Implementation plan

Phases with entry criteria, baseline tests, and exit criteria.

[Requirements](./REQUIREMENTS.md) · [Design](./DESIGN.md) · [Manual checks](./MANUAL_TEST_CHECKLIST.md)

## Phase 1 — Cart lock and totals: done

Entry: DC-2 closed.

- [x] Lock prices through `POST /cart/lock`.
- [x] Show tax and shipping before the pay button.

Baseline tests: totals and lock-expiry unit tests pass.
Exit: M-2 passes on a local build.

## Phase 2 — Guest session: done

Entry: DC-1 closed.

- [x] Issue a signed guest session cookie.
- [x] Create orders for guests without an account.

Baseline tests: session signing and guest order tests pass.
Exit: M-1 passes on a local build.

## Phase 3 — Payment intent: in progress

Entry: payments sandbox keys are available. DC-3 must close before retries are built.

- [x] Request a payment intent after the address step.
- [ ] Keep the cart and address after a decline (RQ-3).
- [ ] Retry timed-out payments — blocked by DC-3.

Baseline tests: a decline keeps the cart; order creation is idempotent.
Exit: M-3 passes on a local build.

## Phase 4 — Test Hardening

- [ ] Cover expired locks, double submits, and slow payments.

Exit: every phase's baseline tests pass, and no critical review finding is open.

## Phase 5 — Integration Test

- [ ] Run end-to-end checkout against the payments sandbox.

Exit: M-1 to M-3 pass on a staging build.

## Handoff

- Done: Phases 1 and 2; the payment intent step of Phase 3.
- Next: keep the cart and address after a decline (RQ-3).
- Blockers: DC-3 retry policy is `TBD`.
- Latest commit: 4f2c1ab.
