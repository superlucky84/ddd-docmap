# Cart and order contracts

Request and response shapes shared across services.

Checkout and account use these contracts, so they live in `docs/shared/` instead of beside one
feature's code.

| Call | Request | Response |
| --- | --- | --- |
| `POST /cart/lock` | `cartId` | `lockId`, `expiresAt`, `totals` |
| `POST /orders` | `lockId`, `address` | `orderId`, `status` |
| `GET /orders/:id` | — | `orderId`, `status`, `items`, `totals` |
