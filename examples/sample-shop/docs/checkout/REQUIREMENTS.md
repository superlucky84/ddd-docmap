# Checkout — Requirements

Let signed-in and guest shoppers pay for a cart on one page.

[Design](./DESIGN.md) · [Implementation plan](./IMPLEMENT.md) · [Manual checks](./MANUAL_TEST_CHECKLIST.md)

Status labels: **Confirmed** means the owner asked for it. **Proposed** is a design suggestion
that is not confirmed yet. **Implemented** means it is built and verified.

## Scope

- Code: `services/checkout/` and `web/checkout/`.
- Shared contracts: [cart and order contracts](../shared/CONTRACTS.md).
- Payments are a nested feature: [payments requirements](./payments/REQUIREMENTS.md).

## Requirements

| ID | Requirement | Status | Acceptance |
| --- | --- | --- | --- |
| RQ-1 | Guests can check out without an account. | Confirmed · Implemented | M-1 |
| RQ-2 | Totals show tax and shipping before payment. | Confirmed · Implemented | M-2 |
| RQ-3 | A failed payment keeps the cart and the entered address. | Confirmed | M-3 |
| RQ-4 | Show an estimated delivery date. | Proposed | — |

## Constraints

- Prices stay locked for 15 minutes after checkout starts.
- Card data never reaches checkout servers; the payments feature owns it.

## Non-goals

- Saved payment methods, gift cards, and split payments.

## Open questions

- Retry policy for payment timeouts: `TBD`, tracked as DC-3 in the design.
