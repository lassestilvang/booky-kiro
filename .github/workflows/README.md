# GitHub Actions Workflows

This directory contains all CI/CD workflows for the Bookmark Manager Platform.

## Workflows Overview

### Core CI Workflows

#### `ci.yml` - Main CI Pipeline

Orchestrates all CI checks for pull requests and pushes. Runs:

- Lint and type checking
- Unit tests
- Property-based tests
- Integration tests
- Security scans
- E2E tests (for main branch)

**Triggers:** Push to main/develop, Pull requests to main/develop

#### `lint-and-typecheck.yml` - Code Quality

Runs ESLint, Prettier format checking, and TypeScript type checking.

**Triggers:** Push to main/develop, Pull requests

#### `unit-tests.yml` - Unit Tests

Runs all unit tests with Vitest. Includes coverage reporting.

**Triggers:** Push to main/develop, Pull requests

**Services:** PostgreSQL, Redis

#### `property-tests.yml` - Property-Based Tests

Runs all property-based tests using fast-check to verify correctness properties.

**Triggers:** Push to main/develop, Pull requests

**Services:** PostgreSQL, Redis, MeiliSearch

#### `integration-tests.yml` - Integration Tests

Runs integration tests that verify end-to-end flows across multiple components.

**Triggers:** Push to main/develop, Pull requests

**Services:** PostgreSQL, Redis, MeiliSearch, MinIO

#### `e2e-tests.yml` - End-to-End Tests

Runs Playwright E2E tests against the full application stack.

**Triggers:** Push to main/develop, Pull requests, Daily schedule (2 AM UTC)

**Features:**

- Single browser tests for PRs
- Multi-browser matrix (Chromium, Firefox, WebKit) for main branch
- Video recording on failure
- Playwright report artifacts

### Build & Deploy Workflows

#### `build-docker-images.yml` - Docker Image Building

Builds and pushes Docker images for all services:

- API server
- Frontend
- Snapshot worker
- Index worker
- Maintenance worker

**Triggers:** Push to main/develop, Tags (v\*), Pull requests to main

**Features:**

- Multi-platform builds (amd64, arm64)
- Layer caching with GitHub Actions cache
- Vulnerability scanning with Trivy
- Automatic tagging based on branch/tag/SHA

#### `deploy.yml` - Deployment Pipeline

Deploys the application to Kubernetes clusters.

**Triggers:** Push to main, Tags (v\*), Manual workflow dispatch

**Environments:**

- Staging (automatic on push to main)
- Production (automatic on version tags, manual dispatch)

**Steps:**

1. Determine target environment
2. Update Kubernetes manifests with new image tags
3. Deploy to Kubernetes cluster
4. Run database migrations
5. Wait for rollout completion
6. Run smoke tests
7. Rollback on failure

**Secrets Required:**

- `KUBE_CONFIG` - Kubernetes configuration
- `DATABASE_URL` - Database connection string
- `APP_URL` - Application URL for health checks
- `AWS_ACCESS_KEY_ID` - AWS credentials (for Terraform)
- `AWS_SECRET_ACCESS_KEY` - AWS credentials (for Terraform)

### Quality & Security Workflows

#### `security-scan.yml` - Security Scanning

Runs multiple security scans:

- Dependency vulnerability scanning (npm audit, Snyk)
- CodeQL static analysis
- Secret scanning with Gitleaks
- License compliance checking

**Triggers:** Push to main/develop, Pull requests, Weekly schedule (Monday 3 AM UTC)

**Secrets Required:**

- `SNYK_TOKEN` - Snyk API token (optional)

#### `performance-monitoring.yml` - Performance Testing

Monitors application performance:

- Lighthouse CI for frontend performance
- Bundle size analysis
- Load testing with k6

**Triggers:** Push to main, Daily schedule (4 AM UTC), Manual dispatch

**Features:**

- Performance budgets enforcement
- Bundle size limits (5MB)
- Load test metrics collection
- Performance regression detection

#### `dependency-updates.yml` - Dependency Management

Automates dependency updates:

- Weekly dependency updates via PR
- Auto-merge for Dependabot patch/minor updates

**Triggers:** Weekly schedule (Monday 9 AM UTC), Manual dispatch

## Workflow Dependencies

```
ci.yml (orchestrator)
├── lint-and-typecheck.yml
├── unit-tests.yml
├── property-tests.yml
├── integration-tests.yml
├── security-scan.yml
└── e2e-tests.yml (conditional)

deploy.yml
├── build-docker-images.yml (implicit)
├── deploy-kubernetes
├── deploy-terraform (production only)
├── smoke-tests
└── rollback (on failure)
```

## Required Secrets

Configure these secrets in your GitHub repository settings:

### Required for All Environments

- `GITHUB_TOKEN` - Automatically provided by GitHub Actions

### Required for Deployment

- `KUBE_CONFIG` - Kubernetes cluster configuration
- `DATABASE_URL` - Production database connection string
- `APP_URL` - Application URL for health checks
- `STAGING_API_URL` - Staging API URL for load tests

### Required for Infrastructure (Production)

- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key

### Optional

- `SNYK_TOKEN` - Snyk security scanning token

## Environment Variables

Workflows use these environment variables:

- `NODE_ENV=test` - Test environment
- `DATABASE_URL` - Database connection
- `REDIS_URL` - Redis connection
- `MEILISEARCH_URL` - MeiliSearch endpoint
- `MEILISEARCH_KEY` - MeiliSearch API key
- `S3_ENDPOINT` - S3-compatible storage endpoint
- `S3_ACCESS_KEY` - S3 access key
- `S3_SECRET_KEY` - S3 secret key
- `JWT_SECRET` - JWT signing secret

## Caching Strategy

All workflows use pnpm store caching to speed up dependency installation:

```yaml
- name: Setup pnpm cache
  uses: actions/cache@v3
  with:
    path: ${{ env.STORE_PATH }}
    key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
```

Docker builds use GitHub Actions cache for layer caching:

```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

## Artifacts

Workflows generate these artifacts:

- **Lint results** - ESLint reports (7 days)
- **Coverage reports** - Test coverage data (7 days)
- **Property test results** - PBT execution logs (7 days)
- **Integration test results** - Integration test logs (7 days)
- **Playwright reports** - E2E test reports with videos (14 days)
- **Bundle analysis** - Frontend bundle size reports (30 days)
- **Load test results** - k6 performance metrics (30 days)

## Notifications

Workflows provide notifications through:

- **PR Comments** - Automated comments on pull requests for test results
- **GitHub Deployments** - Deployment status tracking
- **Issues** - Created for deployment rollbacks
- **Step Summaries** - Markdown summaries in workflow runs

## Best Practices

1. **Fast Feedback** - Core checks (lint, unit tests) run in parallel
2. **Conditional Execution** - E2E tests only run when necessary
3. **Fail Fast** - Critical checks block deployment
4. **Automatic Rollback** - Failed deployments trigger automatic rollback
5. **Security First** - Multiple security scans on every PR
6. **Performance Monitoring** - Continuous performance tracking
7. **Dependency Management** - Automated updates with safety checks

## Troubleshooting

### Workflow Fails on Dependency Installation

- Check if `pnpm-lock.yaml` is committed
- Verify Node.js version matches `package.json` engines
- Clear cache by updating cache key

### E2E Tests Timeout

- Increase timeout in workflow (default: 30 minutes)
- Check if services are healthy before running tests
- Review Docker service logs

### Deployment Fails

- Verify Kubernetes secrets are configured
- Check image tags are correct
- Review rollout status logs
- Ensure database migrations succeed

### Security Scan Failures

- Review vulnerability reports in artifacts
- Update dependencies to patched versions
- Add exceptions for false positives (with justification)

## Local Testing

Test workflows locally using [act](https://github.com/nektos/act):

```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run specific workflow
act -j unit-tests

# Run with secrets
act -j deploy --secret-file .secrets

# List available jobs
act -l
```

## Maintenance

### Adding New Workflows

1. Create workflow file in `.github/workflows/`
2. Follow naming convention: `kebab-case.yml`
3. Add documentation to this README
4. Test locally with act
5. Create PR with workflow changes

### Updating Workflows

1. Test changes in a feature branch
2. Review workflow runs in PR
3. Update documentation if behavior changes
4. Merge only after successful test runs

### Monitoring

- Review workflow runs regularly
- Check for flaky tests
- Monitor execution times
- Update caching strategies as needed
