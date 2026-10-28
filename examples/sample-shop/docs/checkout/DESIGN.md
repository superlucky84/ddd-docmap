# Checkout — Design

One-page checkout built on the shared cart and payments contracts.

## Decision checklist

- [x] DC-1: Guest checkout uses a signed session cookie. Chosen over email links for fewer steps. Validated by M-1.
- [x] DC-2: Taxes come from the pricing service at lock time. Validated by M-2.
- [ ] DC-3: Retry policy for payment timeouts — **TBD**.

## Contracts

| Call | Owner | Notes |
| --- | --- | --- |
| `POST /cart/lock` | cart | Returns `lockId` and expiry |
| `POST /payments/intent` | payments | See [payments design](./payments/DESIGN.md) |
| `POST /orders` | checkout | Idempotent on `lockId` |

## Flow

1. The cart service locks prices for 15 minutes.
2. The page collects address and shipping, then asks payments for an intent.
3. Confirmation clears the cart only after payments reports success.

## Policies

- Creating an order twice with the same `lockId` returns the first order.
- A declined payment keeps the cart and the address (RQ-3).
- An expired lock sends the shopper back to the cart with updated prices.

## Error handling

```js
if (result.status === 'declined') {
  return keepCart({ lockId, address });
}
```

## Test strategy

- Baseline tests in every phase: totals, lock expiry, and order idempotency.
- Test Hardening: expired locks, double submits, slow and declined payments.
- Integration Test: end-to-end checkout against the payments sandbox.

[Requirements](./REQUIREMENTS.md) · [Implementation plan](./IMPLEMENT.md) · [Manual checks](./MANUAL_TEST_CHECKLIST.md)
