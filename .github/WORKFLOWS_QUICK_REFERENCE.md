# GitHub Actions Workflows - Quick Reference

## For Developers

### What Runs When?

#### On Every Push/PR

✅ Lint and Type Check (2-3 min)
✅ Unit Tests (5-8 min)
✅ Property-Based Tests (10-15 min)
✅ Integration Tests (10-15 min)
✅ Security Scan (8-12 min)

**Total Time**: ~30-40 minutes (runs in parallel)

#### On PR to Main (Additional)

✅ E2E Tests (15-25 min)
✅ Build Docker Images (10-20 min)

**Total Time**: ~45-60 minutes

#### On Push to Main

✅ All CI checks
✅ Build and push Docker images
✅ Deploy to Staging
✅ Smoke tests

**Total Time**: ~50-70 minutes

#### On Version Tag (v\*)

✅ All CI checks
✅ Build and push Docker images
✅ Deploy to Production
✅ Terraform infrastructure updates
✅ Smoke tests

**Total Time**: ~60-80 minutes

### Quick Commands

#### View Workflow Status

```bash
# List recent workflow runs
gh run list

# View specific workflow
gh run list --workflow=ci.yml

# Watch a running workflow
gh run watch
```

#### Re-run Failed Workflows

```bash
# Re-run all failed jobs
gh run rerun <run-id> --failed

# Re-run entire workflow
gh run rerun <run-id>
```

#### Download Artifacts

```bash
# Download all artifacts from a run
gh run download <run-id>

# Download specific artifact
gh run download <run-id> -n playwright-report
```

#### Trigger Manual Workflows

```bash
# Trigger deployment
gh workflow run deploy.yml -f environment=staging

# Trigger performance tests
gh workflow run performance-monitoring.yml
```

### Understanding Test Failures

#### Lint Failures

- **Fix**: Run `pnpm run lint` locally
- **Auto-fix**: Run `pnpm run format`

#### Unit Test Failures

- **Debug**: Run `pnpm run test` locally
- **View coverage**: Check artifacts in workflow run

#### Property Test Failures

- **Important**: These indicate correctness issues!
- **Action**: Review the counterexample in test output
- **Fix**: Update code or test based on specification

#### E2E Test Failures

- **Debug**: Download Playwright report from artifacts
- **Videos**: Check test-videos artifact for failure recordings
- **Local**: Run `pnpm run test:e2e:headed` to see browser

#### Integration Test Failures

- **Debug**: Check service logs in workflow output
- **Local**: Run `pnpm run docker:up` then `pnpm run test:run`

### Pre-Push Checklist

Before pushing code, run locally:

```bash
# 1. Lint and format
pnpm run lint
pnpm run format

# 2. Type check
pnpm run build

# 3. Run tests
pnpm run test:run

# 4. Run E2E tests (optional but recommended)
pnpm run docker:up
pnpm run test:e2e
pnpm run docker:down
```

### Deployment Process

#### Staging Deployment

1. Merge PR to `main`
2. CI runs automatically
3. Deploys to staging on success
4. Monitor workflow run

#### Production Deployment

1. Create version tag: `git tag v1.2.3`
2. Push tag: `git push origin v1.2.3`
3. CI runs automatically
4. Deploys to production on success
5. Monitor workflow run

#### Manual Deployment

```bash
# Deploy to staging
gh workflow run deploy.yml -f environment=staging

# Deploy to production
gh workflow run deploy.yml -f environment=production
```

### Troubleshooting

#### "Workflow failed but I don't know why"

```bash
# View detailed logs
gh run view <run-id> --log

# View specific job logs
gh run view <run-id> --log --job=<job-id>
```

#### "Tests pass locally but fail in CI"

- Check environment variables
- Verify service versions match
- Check for timing issues (add waits)
- Review service health checks

#### "Deployment failed"

```bash
# Check Kubernetes status
kubectl get pods -n bookmark-manager
kubectl logs -n bookmark-manager deployment/api

# Check rollback status
kubectl rollout history deployment/api -n bookmark-manager
```

#### "Need to rollback manually"

```bash
# Rollback to previous version
kubectl rollout undo deployment/api -n bookmark-manager
kubectl rollout undo deployment/frontend -n bookmark-manager
```

### Workflow Files

| File                         | Purpose              | Trigger             |
| ---------------------------- | -------------------- | ------------------- |
| `ci.yml`                     | Main CI orchestrator | Push, PR            |
| `lint-and-typecheck.yml`     | Code quality         | Push, PR            |
| `unit-tests.yml`             | Unit tests           | Push, PR            |
| `property-tests.yml`         | Property-based tests | Push, PR            |
| `integration-tests.yml`      | Integration tests    | Push, PR            |
| `e2e-tests.yml`              | E2E tests            | Push to main, Daily |
| `build-docker-images.yml`    | Build images         | Push to main, Tags  |
| `deploy.yml`                 | Deploy to K8s        | Push to main, Tags  |
| `security-scan.yml`          | Security checks      | Push, PR, Weekly    |
| `performance-monitoring.yml` | Performance tests    | Push to main, Daily |
| `dependency-updates.yml`     | Dependency updates   | Weekly              |

### Secrets Required

Ask your team lead to configure these in GitHub:

- `KUBE_CONFIG` - Kubernetes access
- `DATABASE_URL` - Production database
- `APP_URL` - Application URL
- `STAGING_API_URL` - Staging API URL
- `AWS_ACCESS_KEY_ID` - AWS access (production)
- `AWS_SECRET_ACCESS_KEY` - AWS secret (production)
- `SNYK_TOKEN` - Security scanning (optional)

### Best Practices

#### Before Creating PR

1. ✅ Run tests locally
2. ✅ Check lint and formatting
3. ✅ Update documentation
4. ✅ Add tests for new features
5. ✅ Fill out PR template completely

#### During PR Review

1. ✅ Wait for all CI checks to pass
2. ✅ Review test coverage reports
3. ✅ Check for security scan issues
4. ✅ Review Playwright reports for E2E tests
5. ✅ Address reviewer feedback

#### After Merge

1. ✅ Monitor staging deployment
2. ✅ Verify smoke tests pass
3. ✅ Check application health
4. ✅ Monitor error rates

### Getting Help

- **Workflow Issues**: Check `.github/workflows/README.md`
- **Test Failures**: Review test output and artifacts
- **Deployment Issues**: Check Kubernetes logs
- **Security Issues**: Review security scan reports
- **Questions**: Ask in team chat or create discussion

### Useful Links

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub CLI Documentation](https://cli.github.com/manual/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Playwright Documentation](https://playwright.dev/)

## For Maintainers

### Adding New Workflows

1. Create workflow file in `.github/workflows/`
2. Follow naming convention: `kebab-case.yml`
3. Add documentation to `README.md`
4. Test with `act` locally
5. Create PR with workflow changes

### Updating Workflows

1. Test changes in feature branch
2. Review workflow runs in PR
3. Update documentation
4. Merge after successful runs

### Monitoring

- Review workflow runs weekly
- Check for flaky tests
- Monitor execution times
- Optimize slow workflows
- Update caching strategies

### Maintenance Schedule

- **Weekly**: Review dependency updates
- **Monthly**: Optimize workflow performance
- **Quarterly**: Update GitHub Actions versions
- **Annually**: Review security policies

---

**Last Updated**: November 25, 2025
**Version**: 1.0.0
