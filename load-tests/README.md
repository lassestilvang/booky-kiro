# Load Testing

This directory contains load tests for the Bookmark Manager Platform using k6.

## Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

## Test Scenarios

### 1. Concurrent User Load Test (`concurrent-users.js`)

Tests the system's ability to handle multiple concurrent users performing various operations.

**Metrics:**

- Request rate
- Response times (p95, p99)
- Error rate
- Throughput

**Run:**

```bash
k6 run load-tests/concurrent-users.js
```

### 2. Search Performance Test (`search-performance.js`)

Tests search query latency with a large dataset (100k bookmarks).

**Metrics:**

- Search query latency
- Full-text search performance
- Filter combination performance

**Setup:**
Before running, seed the database with 100k bookmarks:

```bash
npm run seed:large-dataset
```

**Run:**

```bash
k6 run load-tests/search-performance.js
```

### 3. Snapshot Processing Throughput (`snapshot-throughput.js`)

Tests the background worker's ability to process snapshot jobs concurrently.

**Metrics:**

- Jobs processed per second
- Job completion time
- Queue depth
- Worker resource utilization

**Run:**

```bash
k6 run load-tests/snapshot-throughput.js
```

### 4. API Response Time Test (`api-response-time.js`)

Validates that API response times meet the < 200ms (95th percentile) requirement.

**Metrics:**

- p50, p95, p99 response times
- Endpoint-specific performance
- Rate limiting behavior

**Run:**

```bash
k6 run load-tests/api-response-time.js
```

## Test Configuration

All tests use environment variables for configuration:

```bash
export API_BASE_URL=http://localhost:3000
export TEST_USER_EMAIL=loadtest@example.com
export TEST_USER_PASSWORD=LoadTest123!
```

## Interpreting Results

### Success Criteria

Based on Requirements 23.1 and 23.3:

- ✅ API response times < 200ms (95th percentile)
- ✅ Search query latency < 200ms for 100k bookmarks
- ✅ Snapshot processing: 10 concurrent jobs without degradation
- ✅ Error rate < 1%
- ✅ Throughput: 100+ requests/second

### k6 Output

k6 provides detailed metrics:

```
http_req_duration..............: avg=150ms min=50ms med=140ms max=500ms p(90)=180ms p(95)=190ms
http_req_failed................: 0.50%
http_reqs......................: 10000
iterations.....................: 1000
vus............................: 50
vus_max........................: 100
```

## Running All Tests

```bash
# Run all load tests sequentially
npm run test:load

# Run specific test
npm run test:load:concurrent
npm run test:load:search
npm run test:load:snapshot
npm run test:load:api
```

## CI/CD Integration

Load tests can be integrated into CI/CD pipelines:

```bash
# Run smoke test (reduced load)
k6 run --vus 10 --duration 30s load-tests/concurrent-users.js

# Run full test suite
k6 run load-tests/concurrent-users.js
k6 run load-tests/search-performance.js
k6 run load-tests/snapshot-throughput.js
k6 run load-tests/api-response-time.js
```

## Troubleshooting

### High Error Rates

- Check database connection pool size
- Verify Redis is running
- Check worker queue capacity
- Review application logs

### Slow Response Times

- Check database query performance
- Verify search engine health
- Review connection pool utilization
- Check for N+1 queries

### Worker Throughput Issues

- Increase worker replicas
- Check job queue configuration
- Verify external service availability (S3, search engine)
- Review worker resource limits
