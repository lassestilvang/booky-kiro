# Load Testing Quick Start

## 1. Install k6

**macOS:**

```bash
brew install k6
```

**Linux:**

```bash
sudo apt-get update
sudo apt-get install k6
```

**Verify installation:**

```bash
k6 version
```

## 2. Start the Application

```bash
# Start Docker services
npm run docker:up

# Build packages
npm run build

# Start backend API (in packages/backend directory)
cd packages/backend && npm run dev
```

## 3. Create Test User

```bash
curl -X POST http://localhost:3000/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "loadtest@example.com",
    "password": "LoadTest123!",
    "name": "Load Test User"
  }'
```

## 4. Run Tests

### Quick Smoke Test (30 seconds)

```bash
npm run test:load:smoke
```

### Individual Tests

**Concurrent Users Test** (~19 minutes)

```bash
npm run test:load:concurrent
```

**API Response Time Test** (~12 minutes)

```bash
npm run test:load:api
```

**Search Performance Test** (~10 minutes)

```bash
# First, seed the database with 100k bookmarks
npm run seed:large-dataset

# Then run the test
npm run test:load:search
```

**Snapshot Throughput Test** (~5 minutes)

```bash
npm run test:load:snapshot
```

### All Tests

```bash
npm run test:load
```

## 5. Interpret Results

Look for these key metrics in the output:

✅ **PASS** - All thresholds met:

```
✓ http_req_duration..............: avg=150ms p(95)=190ms
✓ http_req_failed................: 0.50%
✓ checks.........................: 95.00%
```

❌ **FAIL** - Threshold exceeded:

```
✗ http_req_duration..............: avg=250ms p(95)=350ms
```

## Success Criteria

- ✅ API response time p95 < 200ms
- ✅ Search latency p95 < 200ms (100k bookmarks)
- ✅ Error rate < 1%
- ✅ 10 concurrent snapshot jobs processed

## Troubleshooting

**High error rates?**

- Check if all Docker services are running: `docker ps`
- Check API logs: `npm run docker:logs`

**Slow response times?**

- Check database connection pool size
- Verify MeiliSearch is running: `curl http://localhost:7700/health`

**Tests failing to authenticate?**

- Verify test user was created successfully
- Check API_BASE_URL environment variable

## Environment Variables

```bash
export API_BASE_URL=http://localhost:3000
export TEST_USER_EMAIL=loadtest@example.com
export TEST_USER_PASSWORD=LoadTest123!
```

## Next Steps

- Review detailed results in `LOAD_TESTING.md`
- Check performance benchmarks
- Optimize based on bottlenecks identified
- Run tests in staging environment
