# Treasury NVEST — Pooled Investment Demo

An interactive, browser-only demo of a month-end income allocation cycle for a pooled investment fund (for example, a local government investment pool):

1. **Intake & readiness**: custodian and ledger data checked against control totals before anything runs
2. **Allocation**: net income shared by average daily balance, exact to the cent (largest-remainder rounding)
3. **Approval**: maker/checker with enforced segregation of duties and SHA-256 run fingerprints
4. **ERP journal**: accounting-neutral events turned into balanced journals by posting rules, shown for **SAP S/4HANA** and **Oracle Fusion** side by side; idempotent posting
5. **Distribution**: cash electors get payment instructions; the ERP pays, and NVEST never holds bank details
6. **Reconciliation**: four ties (source, allocation, posting, cash), an exceptions queue and named sign-off before period close
7. **Participant statements**: printable monthly statement per participant
8. **Audit & replay**: full action log, plus recomputing a run from stored inputs to prove an identical result

All data is **synthetic and fictional**. The ERP ledger and bank are simulated in the browser. There is no backend and no database. Each visitor's progress is kept in their browser, and **Reset demo** starts over.

## Demo script (about 10 minutes)

1. Overview → Intake: point out the readiness checks and the ten canonical messages (C1–C10).
2. Allocation: **Prepare run**. Show the joiner (day 12) and leaver (day 20) rows and the ¢ rounding markers.
3. Approval: **Submit**, then **Approve** as Pat Reyes to show the refusal. Switch to Jordan Lee and approve.
4. ERP journal: **Post to SAP**, then **Resend batch** to show the duplicate is blocked. Post the distribution journal. Click **SAP vs Oracle**.
5. Distribution: **Release to ERP payment run**, then **Import bank statement**.
6. Reconciliation: the default scenario injects a returned payment and a netted bank fee. Switch to Sam Ortiz, sign off both, then **Close period**.
7. Statements → Audit: print a statement, then **Replay** the run to show the identical fingerprint.

Use the **Scenario** menu (before importing the bank statement) to run a clean month or a source break (late trade) instead.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173/treasury-nvest-demo/
npm test         # allocation, posting, idempotency and reconciliation tests
npm run build
```

## Deploy

`.github/workflows/deploy.yml` tests, builds and publishes to GitHub Pages on every push to `main`. One-time setup: **Settings → Pages → Source: GitHub Actions**. GitHub Pages on a private repository requires a paid GitHub plan; on the free plan, make the repo public or host `dist/` elsewhere.

## Structure

```
src/domain/   data.ts (synthetic pool) · allocation.ts · posting.ts (rules engine, SAP/Oracle profiles)
              ledger.ts (simulated ERP + bank) · recon.ts (four ties) · hash.ts · domain.test.ts
src/state.tsx app state, roles and segregation-of-duties rules, persisted to localStorage
src/screens/  one file per step
```

## Not in this demo yet

Reversal and re-run of a posted period, unit/NAV accounting, unrealized gain allocation, multi-pool tenants, and real adapters (file, API or iPaaS). See the ERP-agnostic integration plan.
