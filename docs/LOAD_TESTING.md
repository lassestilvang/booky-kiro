# Load Testing Guide

This document describes the load testing strategy and implementation for the Bookmark Manager Platform.

## Overview

Load testing validates that the system meets performance requirements under various load conditions:

- **Requirement 23.1**: API response times < 200ms (95th percentile)
- **Requirement 23.3**: Search query latency < 200ms for 100k bookmarks
- **Requirement 23.3**: Snapshot processing: 10 concurrent jobs without degradation

## Prerequisites

### Install k6

k6 is an open-source load testing tool that uses JavaScript for test scripts.

**macOS:**

```bash
brew install k6
```

**Linux (Debian/Ubuntu):**

```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows:**

```bash
choco install k6
```

**Docker:**

```bash
docker pull grafana/k6
```

### Start the Application

Ensure all services are running:

```bash
# Start Docker services (PostgreSQL, Redis, MeiliSearch, MinIO)
npm run docker:up

# Build all packages
npm run build

# Start the backend API
cd packages/backend && npm run dev

# In another terminal, start the frontend (optional)
cd packages/frontend && npm run dev
```

### Create Test User

Create a test user account for load testing:

```bash
curl -X POST http://localhost:3000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "loadtest@example.com",
    "password": "LoadTest123!",
    "name": "Load Test User"
  }'
```

## Test Scenarios

### 1. Concurrent User Load Test

**File:** `load-tests/concurrent-users.js`

**Purpose:** Tests the system's ability to handle multiple concurrent users performing various operations.

**Load Profile:**

- Ramp up to 20 users over 2 minutes
- Ramp up to 50 users over 5 minutes
- Maintain 50 users for 5 minutes
- Spike to 100 users over 2 minutes
- Maintain 100 users for 3 minutes
- Ramp down to 0 over 2 minutes

**Operations Mix:**

- 30% Create bookmarks
- 40% List bookmarks
- 20% Search bookmarks
- 10% Create collections

**Run:**

```bash
npm run test:load:concurrent
```

**Success Criteria:**

- ✅ p95 response time < 200ms
- ✅ Error rate < 1%
- ✅ All operations complete successfully

### 2. Search Performance Test

**File:** `load-tests/search-performance.js`

**Purpose:** Tests search query latency with a large dataset (100k bookmarks).

**Prerequisites:**

```bash
# Seed database with 100k bookmarks (takes ~10-15 minutes)
npm run seed:large-dataset
```

**Load Profile:**

- Ramp up to 10 users over 1 minute
- Ramp up to 30 users over 3 minutes
- Maintain 30 users for 5 minutes
- Ramp down to 0 over 1 minute

**Query Types:**

- 50% Basic title/metadata search
- 25% Full-text search (Pro feature)
- 25% Filtered search (multiple criteria)
- 10% Fuzzy search (typo tolerance)
- 10% Pagination

**Run:**

```bash
npm run test:load:search
```

**Success Criteria:**

- ✅ Search latency p95 < 200ms (Requirement 23.3)
- ✅ Full-text search p95 < 200ms
- ✅ Filtered search p95 < 200ms
- ✅ Error rate < 1%

### 3. Snapshot Processing Throughput Test

**File:** `load-tests/snapshot-throughput.js`

**Purpose:** Tests the background worker's ability to process snapshot jobs concurrently.

**Load Profile:**

- 10 concurrent users creating bookmarks for 5 minutes
- 1 monitoring thread tracking queue depth

**Run:**

```bash
npm run test:load:snapshot
```

**Success Criteria:**

- ✅ 10 concurrent jobs processed without degradation (Requirement 23.3)
- ✅ Snapshot processing time p95 < 30 seconds
- ✅ Queue depth p95 < 100 pending jobs
- ✅ Error rate < 1%

### 4. API Response Time Test

**File:** `load-tests/api-response-time.js`

**Purpose:** Validates that API response times meet the < 200ms (95th percentile) requirement across all major endpoints.

**Load Profile:**

- Ramp up to 20 users over 1 minute
- Ramp up to 50 users over 5 minutes
- Maintain 50 users for 5 minutes
- Ramp down to 0 over 1 minute

**Endpoint Coverage:**

- 5% Authentication endpoints
- 30% List bookmarks
- 20% Get single bookmark
- 15% Create bookmark
- 5% Update bookmark
- 10% List collections
- 10% Search
- 5% List tags

**Run:**

```bash
npm run test:load:api
```

**Success Criteria:**

- ✅ Overall API p95 < 200ms (Requirement 23.1)
- ✅ Per-endpoint p95 < 200ms
- ✅ Error rate < 1%

## Running All Tests

Run all load tests sequentially:

```bash
npm run test:load
```

This will execute:

1. Concurrent user load test
2. Search performance test
3. Snapshot throughput test
4. API response time test

**Total Duration:** ~30-40 minutes

## Smoke Testing

For quick validation (e.g., in CI/CD), run a reduced load test:

```bash
npm run test:load:smoke
```

This runs the concurrent user test with:

- 10 virtual users
- 30 second duration
- Same thresholds

## Configuration

All tests use environment variables for configuration:

```bash
# API endpoint
export API_BASE_URL=http://localhost:3000

# Test user credentials
export TEST_USER_EMAIL=loadtest@example.com
export TEST_USER_PASSWORD=LoadTest123!

# For large dataset seeding
export TARGET_BOOKMARKS=100000
```

## Interpreting Results

### k6 Output

k6 provides detailed metrics at the end of each test:

```
     ✓ create bookmark status is 201
     ✓ list bookmarks status is 200
     ✓ search status is 200

     checks.........................: 95.00% ✓ 9500      ✗ 500
     data_received..................: 15 MB  50 kB/s
     data_sent......................: 5.0 MB 17 kB/s
     http_req_blocked...............: avg=1.2ms    min=0s      med=1ms     max=50ms    p(90)=2ms     p(95)=3ms
     http_req_connecting............: avg=800µs    min=0s      med=700µs   max=30ms    p(90)=1.5ms   p(95)=2ms
   ✓ http_req_duration..............: avg=150ms    min=50ms    med=140ms   max=500ms   p(90)=180ms   p(95)=190ms
     http_req_failed................: 0.50%  ✓ 50        ✗ 9950
     http_req_receiving.............: avg=500µs    min=100µs   med=400µs   max=5ms     p(90)=800µs   p(95)=1ms
     http_req_sending...............: avg=300µs    min=50µs    med=250µs   max=3ms     p(90)=500µs   p(95)=700µs
     http_req_tls_handshaking.......: avg=0s       min=0s      med=0s      max=0s      p(90)=0s      p(95)=0s
     http_req_waiting...............: avg=149ms    min=49ms    med=139ms   max=499ms   p(90)=179ms   p(95)=189ms
     http_reqs......................: 10000  33.3/s
     iteration_duration.............: avg=3s       min=1s      med=2.8s    max=10s     p(90)=4s      p(95)=5s
     iterations.....................: 1000   3.3/s
     vus............................: 50     min=0       max=100
     vus_max........................: 100    min=100     max=100
```

### Key Metrics

- **http_req_duration**: Total request duration (sending + waiting + receiving)
  - ✅ p(95) should be < 200ms
  - ✅ p(99) should be < 300ms

- **http_req_failed**: Percentage of failed requests
  - ✅ Should be < 1%

- **checks**: Percentage of successful checks
  - ✅ Should be > 95%

- **http_reqs**: Total number of requests and rate
  - ✅ Should achieve 100+ requests/second under load

### Thresholds

Tests will fail if thresholds are not met. Look for ✗ marks in the output:

```
✓ http_req_duration..............: avg=150ms p(95)=190ms  ← PASS
✗ http_req_failed................: 2.5%                   ← FAIL (threshold: < 1%)
```

## Troubleshooting

### High Error Rates

**Symptoms:**

- http_req_failed > 1%
- Many 500 errors in logs

**Possible Causes:**

- Database connection pool exhausted
- Redis connection issues
- Worker queue overload
- Memory pressure

**Solutions:**

1. Check database connection pool size in `.env`:

   ```
   DB_POOL_SIZE=100
   ```

2. Verify Redis is running:

   ```bash
   docker ps | grep redis
   ```

3. Check application logs:

   ```bash
   npm run docker:logs
   ```

4. Monitor resource usage:
   ```bash
   docker stats
   ```

### Slow Response Times

**Symptoms:**

- http_req_duration p95 > 200ms
- Requests timing out

**Possible Causes:**

- Slow database queries
- Missing indexes
- N+1 query problems
- Search engine overload

**Solutions:**

1. Enable query logging in PostgreSQL
2. Check for missing indexes:

   ```sql
   SELECT * FROM pg_stat_user_tables WHERE idx_scan = 0;
   ```

3. Review slow queries:

   ```sql
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC
   LIMIT 10;
   ```

4. Check MeiliSearch health:
   ```bash
   curl http://localhost:7700/health
   ```

### Worker Throughput Issues

**Symptoms:**

- Queue depth growing unbounded
- Snapshot processing time > 30s
- Jobs timing out

**Possible Causes:**

- Insufficient worker replicas
- External service failures (S3, search engine)
- Network issues
- Resource constraints

**Solutions:**

1. Increase worker replicas:

   ```bash
   # In docker-compose.yml
   snapshot-worker:
     deploy:
       replicas: 3
   ```

2. Check MinIO connectivity:

   ```bash
   curl http://localhost:9000/minio/health/live
   ```

3. Review worker logs:

   ```bash
   docker logs bookmark-worker-snapshot
   ```

4. Monitor job queue in Redis:
   ```bash
   redis-cli LLEN bull:snapshot:wait
   ```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Load Tests

on:
  schedule:
    - cron: '0 2 * * *' # Run nightly at 2 AM
  workflow_dispatch: # Allow manual trigger

jobs:
  load-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Install dependencies
        run: npm install

      - name: Start services
        run: |
          npm run docker:up
          sleep 10

      - name: Build application
        run: npm run build

      - name: Start API server
        run: |
          cd packages/backend
          npm run dev &
          sleep 5

      - name: Create test user
        run: |
          curl -X POST http://localhost:3000/v1/auth/register \
            -H "Content-Type: application/json" \
            -d '{"email":"loadtest@example.com","password":"LoadTest123!","name":"Load Test"}'

      - name: Run smoke test
        run: npm run test:load:smoke

      - name: Run API response time test
        run: npm run test:load:api

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: |
            *.json
            *.html
```

## Performance Benchmarks

### Expected Performance (Single Node)

Based on Requirements 23.1 and 23.3:

| Metric                  | Target        | Typical          |
| ----------------------- | ------------- | ---------------- |
| API Response Time (p95) | < 200ms       | 150-180ms        |
| Search Latency (p95)    | < 200ms       | 120-180ms        |
| Snapshot Processing     | 10 concurrent | 10-15 concurrent |
| Throughput              | 100+ req/s    | 150-200 req/s    |
| Error Rate              | < 1%          | 0.1-0.5%         |

### Scaling Recommendations

**For 1,000 concurrent users:**

- API servers: 3-5 replicas
- Database: Read replicas (2-3)
- Workers: 5-10 replicas per type
- Redis: Cluster mode (3 nodes)
- Search: 3-node cluster

**For 10,000 concurrent users:**

- API servers: 10-20 replicas
- Database: Primary + 5 read replicas
- Workers: 20-30 replicas per type
- Redis: Cluster mode (6 nodes)
- Search: 6-node cluster

## Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Best Practices](https://k6.io/docs/testing-guides/test-types/)
- [Performance Testing Guide](https://k6.io/docs/testing-guides/api-load-testing/)
- [Grafana k6 Cloud](https://k6.io/cloud/) - For advanced metrics and visualization

## Support

For issues or questions about load testing:

1. Check the troubleshooting section above
2. Review application logs
3. Check system resource usage
4. Consult the k6 documentation
5. Open an issue in the project repository
