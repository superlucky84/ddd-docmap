# Sample shop

A small, made-up online shop that shows what
[Doc-Driven Development](../../METHOD.md) documents look like in a project.
None of the code exists; only the documents do.

- `docs/checkout/` has the complete set of four documents: requirements with status labels,
  a design with a decision checklist (one decision still `TBD`), a phased implementation
  plan with Test Hardening, Integration Test, and a handoff, and manual checks with a run log.
- The other features show what real projects look like: partial document sets, nested
  features (`checkout/payments`, `catalog/search`), a shared contract in `docs/shared/`, and
  documents kept beside code in `services/` and `web/`.

Open it on the document map from the root of a docatlas clone:

```sh
npx docatlas --root examples/sample-shop
```
