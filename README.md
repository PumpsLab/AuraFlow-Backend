# AuraFlow Backend

> NestJS backend API for AuraFlow — privacy-first payroll on Stellar.

![NestJS](https://img.shields.io/badge/NestJS-10.4-E0234E) ![Stellar](https://img.shields.io/badge/Stellar--SDK-17.0.1-14B8E6) ![MongoDB](https://img.shields.io/badge/MongoDB-7.1-47A248) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)

## Overview

AuraFlow is a confidential payroll platform built on Stellar blockchain using Soroban smart contracts. This backend handles authentication, company/employee management, treasury operations, payroll processing, and audit logging.

## Prerequisites

- Node.js >= 18
- MongoDB >= 7.0 (local or Atlas)
- Stellar testnet account (for deployment)

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your configuration
npm run start:dev
```

The API runs on `http://localhost:4000` with Swagger docs at `http://localhost:4000/api/docs`.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `4000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017` |
| `MONGODB_DB` | Database name | `auraflow` |
| `STELLAR_NETWORK_PASSPHRASE` | Stellar network passphrase | `Test SDF Network ; September 2015` |
| `STELLAR_RPC_URL` | Stellar Soroban RPC endpoint | `https://soroban-testnet.stellar.org` |
| `AURAFLOW_SESSION_SECRET` | HMAC secret for session tokens (min 32 chars) | — |
| `COMPANY_KEY_ENCRYPTION_SECRET` | AES-256-GCM key for treasury encryption (32 bytes) | — |
| `CONFIDENTIAL_TOKEN_CONTRACT` | Deployed ConfidentialToken contract address | — |
| `AURAFLOW_PAYROLL_CONTRACT` | Deployed AuraflowPayroll contract address | — |
| `VERIFIER_CONTRACT` | Deployed Verifier contract address | — |
| `AUDITOR_CONTRACT` | Deployed Auditor contract address | — |
| `USDC_CONTRACT` | Stellar USDC SAC contract address | — |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |

## API Overview

All endpoints are prefixed with `/api/v1`. Swagger UI is available at `/api/docs`.

### Authentication

- `POST /auth/session` — Create HMAC-signed session token via SEP-53 signed request

### Companies

- `POST /companies` — Create company
- `GET /companies/me` — Get current company
- `GET /companies/:id/balance` — Treasury balance (XLM, USDC, trustline)
- `GET /companies/:id/treasury` — Treasury details
- `POST /companies/:id/setup-trustline` — Add USDC trustline
- `GET /companies/:id/funding-instructions` — Step-by-step funding guide
- `POST /companies/:id/fund-treasury` — Build fund treasury XDR
- `POST /companies/:id/fund-treasury/submit` — Submit signed XDR

### Employees

- `GET /employees` — List employees
- `POST /employees` — Create employee
- `PATCH /employees/:id` — Update employee

### Private Payroll

- `POST /private-payroll/build-transaction` — Build Soroban payroll batch XDR
- `POST /private-payroll/submit` — Submit signed payroll XDR

### Payroll Runs

- `GET /payroll-runs/profiles` — List payroll profiles
- `POST /payroll-runs/profiles` — Create/update profile
- `GET /payroll-runs/cycles` — List cycles
- `POST /payroll-runs/cycles` — Create cycle
- `POST /payroll-runs/cycles/:id/compute` — Compute payroll
- `POST /payroll-runs/cycles/:id/approve` — Approve cycle
- `GET /payroll-runs/cycles/:id/disbursement-plan` — Get plan
- `GET /payroll-runs/runs` — List historical runs

### Claims, Streams, Audit, Compliance

See Swagger UI at `/api/docs` for full endpoint documentation.

## Architecture

```
src/
├── auth/           # SEP-53 session authentication
├── companies/      # Company & treasury management
├── employees/      # Employee CRUD
├── private-payroll/ # Soroban payroll batch transactions
├── payroll-runs/   # Payroll cycle management
├── streams/        # Salary streaming
├── claims/         # Employee claim processing
├── blockchain/     # Stellar/Soroban RPC integration
├── audit/          # Auditor token management
├── compliance/     # Compliance event logging
├── treasury/       # Treasury key management
├── database/       # MongoDB service
└── common/         # Guards, decorators, utilities
```

## Auth Flow

1. Client signs SEP-53 message via Freighter
2. Backend verifies Ed25519 signature
3. Backend creates HMAC-signed session token (12hr expiry)
4. Subsequent requests use `x-auraflow-session` header

## Testing

```bash
npm test              # Unit tests
node test-api.js      # Integration test (requires running server)
```

## Deployment

### Render

The `render.yaml` configures automatic deployment. Set environment variables in the Render dashboard.

### Docker

```bash
docker build -t auraflow-backend .
docker run -p 4000:4000 --env-file .env auraflow-backend
```

## License

MIT — see [LICENSE](LICENSE).
