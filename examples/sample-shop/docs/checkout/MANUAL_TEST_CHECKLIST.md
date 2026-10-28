# Checkout — Manual checks

Release-facing checks with pass/fail criteria.

[Requirements](./REQUIREMENTS.md) · [Design](./DESIGN.md) · [Implementation plan](./IMPLEMENT.md)

| ID | Steps | Pass when | Covers |
| --- | --- | --- | --- |
| M-1 | As a guest, add an item and pay with a test card. | An order number appears and no account was created. | RQ-1, DC-1 |
| M-2 | Start checkout with a taxable address. | Tax and shipping appear before the pay button. | RQ-2, DC-2 |
| M-3 | Pay with a test card that is declined. | The cart and the entered address are still there. | RQ-3 |

## Run log

A check that was not run is not a pass.

| Date | Build | M-1 | M-2 | M-3 |
| --- | --- | --- | --- | --- |
| 2026-10-20 | 4f2c1ab | pass | pass | not run |
