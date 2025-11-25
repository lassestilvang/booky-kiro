// Shared configuration for all load tests
export const config = {
  apiBaseUrl: __ENV.API_BASE_URL || 'http://localhost:3000',
  testUserEmail: __ENV.TEST_USER_EMAIL || 'loadtest@example.com',
  testUserPassword: __ENV.TEST_USER_PASSWORD || 'LoadTest123!',
};

// Thresholds based on Requirements 23.1 and 23.3
export const thresholds = {
  // API response time < 200ms (95th percentile)
  http_req_duration: ['p(95)<200'],

  // Error rate < 1%
  http_req_failed: ['rate<0.01'],

  // 95% of requests should complete successfully
  checks: ['rate>0.95'],
};

// Common HTTP parameters
export const httpParams = {
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: '30s',
};

// Helper function to authenticate and get token
export function authenticate(http) {
  const loginRes = http.post(
    `${config.apiBaseUrl}/v1/auth/login`,
    JSON.stringify({
      email: config.testUserEmail,
      password: config.testUserPassword,
    }),
    httpParams
  );

  if (loginRes.status !== 200) {
    throw new Error(`Authentication failed: ${loginRes.status}`);
  }

  const body = JSON.parse(loginRes.body);
  return body.accessToken;
}

// Helper function to create authenticated headers
export function authHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    timeout: '30s',
  };
}

// Sample bookmark data generator
export function generateBookmark(index) {
  return {
    url: `https://example.com/article-${index}`,
    title: `Test Article ${index}`,
    excerpt: `This is a test article excerpt for bookmark ${index}`,
    type: 'article',
    tags: [`tag-${index % 10}`, `category-${index % 5}`],
  };
}

// Sample collection data generator
export function generateCollection(index) {
  return {
    title: `Test Collection ${index}`,
    icon: 'bookmark',
    isPublic: false,
  };
}

// Random search query generator
export function generateSearchQuery() {
  const queries = [
    'javascript',
    'react',
    'typescript',
    'node.js',
    'database',
    'api',
    'testing',
    'performance',
    'security',
    'architecture',
  ];
  return queries[Math.floor(Math.random() * queries.length)];
}

// Random tag generator
export function generateTag() {
  const tags = [
    'programming',
    'web-development',
    'backend',
    'frontend',
    'devops',
    'testing',
    'documentation',
    'tutorial',
    'reference',
    'tools',
  ];
  return tags[Math.floor(Math.random() * tags.length)];
}
