/**
 * Demo Dataset Seed Script
 *
 * Creates a comprehensive demo dataset with:
 * - 50 sample bookmarks across various categories
 * - Multiple collections with hierarchy
 * - Tags on bookmarks
 * - Highlights and annotations (Pro features)
 * - Shared collections
 *
 * Usage: node scripts/seed-demo-data.js
 */

const http = require('http');
const https = require('https');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL || 'demo@example.com';
const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD || 'Demo123!';
const DEMO_USER_NAME = process.env.DEMO_USER_NAME || 'Demo User';

// HTTP request helper
function makeRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const urlObj = new URL(url);

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = protocol.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: body,
        });
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(data);
    }

    req.end();
  });
}

// Demo collections structure
const collections = [
  {
    title: 'Web Development',
    icon: 'code',
    description: 'Resources for web development',
  },
  {
    title: 'JavaScript',
    icon: 'javascript',
    description: 'JavaScript tutorials and articles',
    parent: 'Web Development',
  },
  {
    title: 'React',
    icon: 'react',
    description: 'React framework resources',
    parent: 'JavaScript',
  },
  {
    title: 'Node.js',
    icon: 'nodejs',
    description: 'Backend development with Node.js',
    parent: 'JavaScript',
  },
  { title: 'Design', icon: 'palette', description: 'UI/UX design resources' },
  { title: 'DevOps', icon: 'server', description: 'DevOps and infrastructure' },
  {
    title: 'Docker',
    icon: 'docker',
    description: 'Containerization with Docker',
    parent: 'DevOps',
  },
  {
    title: 'Kubernetes',
    icon: 'kubernetes',
    description: 'Container orchestration',
    parent: 'DevOps',
  },
  {
    title: 'Career',
    icon: 'briefcase',
    description: 'Career development and advice',
  },
  {
    title: 'Productivity',
    icon: 'clock',
    description: 'Productivity tips and tools',
  },
];

// Demo bookmarks with rich metadata
const bookmarks = [
  // Web Development
  {
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
    title: 'JavaScript | MDN',
    excerpt:
      'JavaScript (JS) is a lightweight, interpreted programming language with first-class functions.',
    type: 'article',
    collection: 'JavaScript',
    tags: ['javascript', 'documentation', 'reference'],
  },
  {
    url: 'https://javascript.info/',
    title: 'The Modern JavaScript Tutorial',
    excerpt:
      "How it's done now. From the basics to advanced topics with simple explanations.",
    type: 'article',
    collection: 'JavaScript',
    tags: ['javascript', 'tutorial', 'learning'],
  },
  {
    url: 'https://eloquentjavascript.net/',
    title: 'Eloquent JavaScript',
    excerpt:
      'A modern introduction to programming with JavaScript. A book about JavaScript, programming, and the wonders of the digital.',
    type: 'article',
    collection: 'JavaScript',
    tags: ['javascript', 'book', 'learning'],
  },
  // React
  {
    url: 'https://react.dev/',
    title: 'React - The library for web and native user interfaces',
    excerpt:
      'React lets you build user interfaces out of individual pieces called components.',
    type: 'article',
    collection: 'React',
    tags: ['react', 'documentation', 'frontend'],
  },
  {
    url: 'https://react.dev/learn/thinking-in-react',
    title: 'Thinking in React',
    excerpt:
      'React can change how you think about the designs you look at and the apps you build.',
    type: 'article',
    collection: 'React',
    tags: ['react', 'tutorial', 'best-practices'],
  },
  {
    url: 'https://www.patterns.dev/',
    title: 'Patterns.dev - Modern Web App Design Patterns',
    excerpt: 'Improve how you architect webapps with modern design patterns.',
    type: 'article',
    collection: 'React',
    tags: ['react', 'patterns', 'architecture'],
  },
  {
    url: 'https://react-typescript-cheatsheet.netlify.app/',
    title: 'React TypeScript Cheatsheet',
    excerpt:
      'Cheatsheets for experienced React developers getting started with TypeScript.',
    type: 'article',
    collection: 'React',
    tags: ['react', 'typescript', 'reference'],
  },
  // Node.js
  {
    url: 'https://nodejs.org/en/docs/',
    title: 'Node.js Documentation',
    excerpt:
      'Node.js is an open-source, cross-platform JavaScript runtime environment.',
    type: 'article',
    collection: 'Node.js',
    tags: ['nodejs', 'documentation', 'backend'],
  },
  {
    url: 'https://expressjs.com/',
    title:
      'Express - Fast, unopinionated, minimalist web framework for Node.js',
    excerpt:
      'Express is a minimal and flexible Node.js web application framework.',
    type: 'article',
    collection: 'Node.js',
    tags: ['nodejs', 'express', 'framework'],
  },
  {
    url: 'https://www.npmjs.com/',
    title: 'npm | Build amazing things',
    excerpt:
      "We're npm, Inc., the company behind Node package manager, the npm Registry, and npm CLI.",
    type: 'article',
    collection: 'Node.js',
    tags: ['nodejs', 'npm', 'packages'],
  },
  // Design
  {
    url: 'https://www.figma.com/resources/learn-design/',
    title: 'Learn Design with Figma',
    excerpt:
      'Free courses and resources to help you learn design fundamentals.',
    type: 'article',
    collection: 'Design',
    tags: ['design', 'figma', 'tutorial'],
  },
  {
    url: 'https://www.refactoringui.com/',
    title: 'Refactoring UI',
    excerpt:
      "Learn how to design awesome UIs by yourself using specific tactics explained from a developer's point-of-view.",
    type: 'article',
    collection: 'Design',
    tags: ['design', 'ui', 'book'],
  },
  {
    url: 'https://www.nngroup.com/articles/',
    title: 'Nielsen Norman Group: UX Research Articles',
    excerpt:
      'Evidence-based user experience research, training, and consulting.',
    type: 'article',
    collection: 'Design',
    tags: ['design', 'ux', 'research'],
  },
  {
    url: 'https://dribbble.com/',
    title: "Dribbble - Discover the World's Top Designers",
    excerpt: 'Find Top Designers & Creative Professionals on Dribbble.',
    type: 'article',
    collection: 'Design',
    tags: ['design', 'inspiration', 'portfolio'],
  },
  // Docker
  {
    url: 'https://docs.docker.com/',
    title: 'Docker Documentation',
    excerpt:
      'Docker is an open platform for developing, shipping, and running applications.',
    type: 'article',
    collection: 'Docker',
    tags: ['docker', 'documentation', 'containers'],
  },
  {
    url: 'https://www.docker.com/blog/intro-guide-to-dockerfile-best-practices/',
    title: 'Intro Guide to Dockerfile Best Practices',
    excerpt: 'Learn Docker best practices and how to write better Dockerfiles.',
    type: 'article',
    collection: 'Docker',
    tags: ['docker', 'best-practices', 'tutorial'],
  },
  {
    url: 'https://github.com/docker/awesome-compose',
    title: 'Awesome Docker Compose Examples',
    excerpt: 'A curated list of Docker Compose samples.',
    type: 'article',
    collection: 'Docker',
    tags: ['docker', 'docker-compose', 'examples'],
  },
  // Kubernetes
  {
    url: 'https://kubernetes.io/docs/home/',
    title: 'Kubernetes Documentation',
    excerpt:
      'Kubernetes is an open-source system for automating deployment, scaling, and management of containerized applications.',
    type: 'article',
    collection: 'Kubernetes',
    tags: ['kubernetes', 'documentation', 'orchestration'],
  },
  {
    url: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/',
    title: 'Learn Kubernetes Basics',
    excerpt:
      'This tutorial provides a walkthrough of the basics of the Kubernetes cluster orchestration system.',
    type: 'article',
    collection: 'Kubernetes',
    tags: ['kubernetes', 'tutorial', 'learning'],
  },
  {
    url: 'https://github.com/kelseyhightower/kubernetes-the-hard-way',
    title: 'Kubernetes The Hard Way',
    excerpt:
      'Bootstrap Kubernetes the hard way on Google Cloud Platform. No scripts.',
    type: 'article',
    collection: 'Kubernetes',
    tags: ['kubernetes', 'tutorial', 'advanced'],
  },
  // Career
  {
    url: 'https://www.levels.fyi/',
    title: 'Levels.fyi - Compare Career Levels Across Companies',
    excerpt: 'Compare career levels and compensation across companies.',
    type: 'article',
    collection: 'Career',
    tags: ['career', 'salary', 'levels'],
  },
  {
    url: 'https://www.teamblind.com/',
    title: 'Blind - Anonymous Professional Community',
    excerpt: 'Anonymous professional network for tech workers.',
    type: 'article',
    collection: 'Career',
    tags: ['career', 'community', 'networking'],
  },
  {
    url: 'https://www.crackingthecodinginterview.com/',
    title: 'Cracking the Coding Interview',
    excerpt: '189 Programming Questions and Solutions.',
    type: 'article',
    collection: 'Career',
    tags: ['career', 'interview', 'book'],
  },
  {
    url: 'https://leetcode.com/',
    title:
      "LeetCode - The World's Leading Online Programming Learning Platform",
    excerpt: 'Level up your coding skills and quickly land a job.',
    type: 'article',
    collection: 'Career',
    tags: ['career', 'interview', 'practice'],
  },
  // Productivity
  {
    url: 'https://todoist.com/productivity-methods',
    title: 'Productivity Methods: Find What Works for You',
    excerpt:
      'Explore popular productivity methods and find the one that fits your workflow.',
    type: 'article',
    collection: 'Productivity',
    tags: ['productivity', 'methods', 'workflow'],
  },
  {
    url: 'https://www.notion.so/help/guides',
    title: 'Notion Guides',
    excerpt: 'Learn how to use Notion with guides and tutorials.',
    type: 'article',
    collection: 'Productivity',
    tags: ['productivity', 'notion', 'tools'],
  },
  {
    url: 'https://obsidian.md/',
    title: 'Obsidian - A second brain, for you, forever',
    excerpt:
      'Obsidian is a powerful knowledge base on top of a local folder of plain text Markdown files.',
    type: 'article',
    collection: 'Productivity',
    tags: ['productivity', 'notes', 'knowledge-management'],
  },
  // Additional diverse bookmarks
  {
    url: 'https://github.com/sindresorhus/awesome',
    title: 'Awesome Lists',
    excerpt: 'Awesome lists about all kinds of interesting topics.',
    type: 'article',
    collection: 'Web Development',
    tags: ['resources', 'lists', 'awesome'],
  },
  {
    url: 'https://roadmap.sh/',
    title: 'Developer Roadmaps',
    excerpt:
      'Community driven roadmaps, articles and resources for developers.',
    type: 'article',
    collection: 'Career',
    tags: ['career', 'learning', 'roadmap'],
  },
  {
    url: 'https://www.typescriptlang.org/docs/',
    title: 'TypeScript Documentation',
    excerpt: 'TypeScript is JavaScript with syntax for types.',
    type: 'article',
    collection: 'JavaScript',
    tags: ['typescript', 'documentation', 'javascript'],
  },
  {
    url: 'https://tailwindcss.com/',
    title: 'Tailwind CSS - Rapidly build modern websites',
    excerpt: 'A utility-first CSS framework packed with classes.',
    type: 'article',
    collection: 'Design',
    tags: ['css', 'tailwind', 'framework'],
  },
  {
    url: 'https://vitejs.dev/',
    title: 'Vite - Next Generation Frontend Tooling',
    excerpt:
      'Get ready for a development environment that can finally catch up with you.',
    type: 'article',
    collection: 'Web Development',
    tags: ['vite', 'build-tools', 'frontend'],
  },
  {
    url: 'https://www.postgresql.org/docs/',
    title: 'PostgreSQL Documentation',
    excerpt: "The world's most advanced open source relational database.",
    type: 'article',
    collection: 'Node.js',
    tags: ['postgresql', 'database', 'documentation'],
  },
  {
    url: 'https://redis.io/docs/',
    title: 'Redis Documentation',
    excerpt: 'Redis is an open source, in-memory data structure store.',
    type: 'article',
    collection: 'Node.js',
    tags: ['redis', 'cache', 'database'],
  },
  {
    url: 'https://www.meilisearch.com/docs',
    title: 'MeiliSearch Documentation',
    excerpt:
      'A lightning-fast search engine that fits effortlessly into your apps, websites, and workflow.',
    type: 'article',
    collection: 'Node.js',
    tags: ['meilisearch', 'search', 'documentation'],
  },
  {
    url: 'https://min.io/docs/minio/linux/index.html',
    title: 'MinIO Documentation',
    excerpt: 'High Performance Object Storage for AI.',
    type: 'article',
    collection: 'DevOps',
    tags: ['minio', 'storage', 'documentation'],
  },
  {
    url: 'https://www.terraform.io/docs',
    title: 'Terraform Documentation',
    excerpt:
      'Infrastructure as Code to provision and manage any cloud, infrastructure, or service.',
    type: 'article',
    collection: 'DevOps',
    tags: ['terraform', 'iac', 'documentation'],
  },
  {
    url: 'https://github.com/features/actions',
    title: 'GitHub Actions',
    excerpt: 'Automate your workflow from idea to production.',
    type: 'article',
    collection: 'DevOps',
    tags: ['github', 'ci-cd', 'automation'],
  },
  {
    url: 'https://www.atlassian.com/git/tutorials',
    title: 'Git Tutorials and Training',
    excerpt: 'Learn Git with Bitbucket Cloud.',
    type: 'article',
    collection: 'Web Development',
    tags: ['git', 'tutorial', 'version-control'],
  },
  {
    url: 'https://www.conventionalcommits.org/',
    title: 'Conventional Commits',
    excerpt:
      'A specification for adding human and machine readable meaning to commit messages.',
    type: 'article',
    collection: 'Web Development',
    tags: ['git', 'best-practices', 'commits'],
  },
  {
    url: 'https://semver.org/',
    title: 'Semantic Versioning',
    excerpt:
      'A simple set of rules and requirements that dictate how version numbers are assigned.',
    type: 'article',
    collection: 'Web Development',
    tags: ['versioning', 'best-practices', 'semver'],
  },
  {
    url: 'https://12factor.net/',
    title: 'The Twelve-Factor App',
    excerpt: 'A methodology for building software-as-a-service apps.',
    type: 'article',
    collection: 'DevOps',
    tags: ['architecture', 'best-practices', 'saas'],
  },
  {
    url: 'https://martinfowler.com/',
    title: 'Martin Fowler',
    excerpt: 'Software development, Patterns, Agile, Architecture.',
    type: 'article',
    collection: 'Web Development',
    tags: ['architecture', 'patterns', 'blog'],
  },
  {
    url: 'https://www.joelonsoftware.com/',
    title: 'Joel on Software',
    excerpt: 'Joel Spolsky on software and business.',
    type: 'article',
    collection: 'Career',
    tags: ['blog', 'software', 'business'],
  },
  {
    url: 'https://stackoverflow.blog/',
    title: 'Stack Overflow Blog',
    excerpt:
      'Essays, opinions, and advice on the act of computer programming from Stack Overflow.',
    type: 'article',
    collection: 'Web Development',
    tags: ['blog', 'programming', 'community'],
  },
  {
    url: 'https://css-tricks.com/',
    title: 'CSS-Tricks',
    excerpt:
      'Daily articles about CSS, HTML, JavaScript, and all things related to web design and development.',
    type: 'article',
    collection: 'Design',
    tags: ['css', 'blog', 'frontend'],
  },
  {
    url: 'https://web.dev/',
    title: 'web.dev',
    excerpt: "Let's build the future of the web, together.",
    type: 'article',
    collection: 'Web Development',
    tags: ['web', 'performance', 'best-practices'],
  },
];

// Demo highlights for Pro features
const highlights = [
  {
    bookmarkUrl: 'https://react.dev/learn/thinking-in-react',
    text: 'Start with the mockup. Imagine that you already have a JSON API and a mockup from a designer.',
    color: '#FFFF00',
    annotation: 'Key principle: Always start with data structure and UI mockup',
  },
  {
    bookmarkUrl: 'https://www.patterns.dev/',
    text: 'Design patterns are a fundamental part of software development, as they provide typical solutions to commonly recurring problems.',
    color: '#00FF00',
    annotation: 'Understanding patterns helps write maintainable code',
  },
  {
    bookmarkUrl: 'https://12factor.net/',
    text: 'The twelve-factor app is a methodology for building software-as-a-service apps',
    color: '#FF6B6B',
    annotation: 'Essential reading for building scalable SaaS applications',
  },
  {
    bookmarkUrl: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/',
    text: 'Kubernetes coordinates a highly available cluster of computers that are connected to work as a single unit.',
    color: '#4ECDC4',
    annotation: 'Core concept of K8s architecture',
  },
];

// Register or login user
async function setupUser() {
  console.log('Setting up demo user...');

  // Try to register
  let response = await makeRequest(
    `${API_BASE_URL}/v1/auth/register`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({
      email: DEMO_USER_EMAIL,
      password: DEMO_USER_PASSWORD,
      name: DEMO_USER_NAME,
    })
  );

  if (response.status === 409) {
    console.log('User already exists, logging in...');
  } else if (response.status === 201) {
    console.log('User created successfully');
  } else {
    throw new Error(
      `Failed to create user: ${response.status} ${response.body}`
    );
  }

  // Login
  response = await makeRequest(
    `${API_BASE_URL}/v1/auth/login`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({
      email: DEMO_USER_EMAIL,
      password: DEMO_USER_PASSWORD,
    })
  );

  if (response.status !== 200) {
    throw new Error(`Login failed: ${response.status} ${response.body}`);
  }

  const body = JSON.parse(response.body);
  console.log('Logged in successfully');
  return body.accessToken;
}

// Create collections with hierarchy
async function createCollections(token) {
  console.log('\nCreating collections...');
  const collectionMap = {};

  for (const collection of collections) {
    const parentId = collection.parent
      ? collectionMap[collection.parent]
      : null;

    const response = await makeRequest(
      `${API_BASE_URL}/v1/collections`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
      JSON.stringify({
        title: collection.title,
        icon: collection.icon,
        parentId: parentId,
      })
    );

    if (response.status === 201) {
      const body = JSON.parse(response.body);
      collectionMap[collection.title] = body.id;
      console.log(`  ✓ Created collection: ${collection.title}`);
    } else {
      console.error(
        `  ✗ Failed to create collection ${collection.title}: ${response.status}`
      );
    }
  }

  return collectionMap;
}

// Create bookmarks
async function createBookmarks(token, collectionMap) {
  console.log('\nCreating bookmarks...');
  const bookmarkMap = {};

  for (const bookmark of bookmarks) {
    const collectionId = bookmark.collection
      ? collectionMap[bookmark.collection]
      : null;

    const response = await makeRequest(
      `${API_BASE_URL}/v1/bookmarks`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
      JSON.stringify({
        url: bookmark.url,
        title: bookmark.title,
        excerpt: bookmark.excerpt,
        type: bookmark.type,
        collectionId: collectionId,
        tags: bookmark.tags,
      })
    );

    if (response.status === 201) {
      const body = JSON.parse(response.body);
      bookmarkMap[bookmark.url] = body.id;
      console.log(`  ✓ Created bookmark: ${bookmark.title}`);
    } else {
      console.error(
        `  ✗ Failed to create bookmark ${bookmark.title}: ${response.status}`
      );
    }
  }

  return bookmarkMap;
}

// Create highlights (Pro feature)
async function createHighlights(token, bookmarkMap) {
  console.log('\nCreating highlights (Pro feature)...');

  for (const highlight of highlights) {
    const bookmarkId = bookmarkMap[highlight.bookmarkUrl];
    if (!bookmarkId) {
      console.log(
        `  ⊘ Skipping highlight for ${highlight.bookmarkUrl} (bookmark not found)`
      );
      continue;
    }

    const response = await makeRequest(
      `${API_BASE_URL}/v1/highlights`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
      JSON.stringify({
        bookmarkId: bookmarkId,
        textSelected: highlight.text,
        color: highlight.color,
        annotationMd: highlight.annotation,
        positionContext: {
          before: '',
          after: '',
        },
      })
    );

    if (response.status === 201) {
      console.log(`  ✓ Created highlight for: ${highlight.bookmarkUrl}`);
    } else if (response.status === 403) {
      console.log(`  ⊘ Highlights require Pro plan (upgrade user to test)`);
      break; // Don't try more if user doesn't have Pro
    } else {
      console.error(`  ✗ Failed to create highlight: ${response.status}`);
    }
  }
}

// Share a collection (Pro feature)
async function shareCollection(token, collectionMap) {
  console.log('\nSharing collection (Pro feature)...');

  const collectionId = collectionMap['Web Development'];
  if (!collectionId) {
    console.log('  ⊘ Web Development collection not found');
    return;
  }

  // Make collection public
  const response = await makeRequest(
    `${API_BASE_URL}/v1/collections/${collectionId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
    JSON.stringify({
      isPublic: true,
    })
  );

  if (response.status === 200) {
    const body = JSON.parse(response.body);
    console.log(`  ✓ Made 'Web Development' collection public`);
    if (body.shareSlug) {
      console.log(`  → Share URL: ${API_BASE_URL}/public/${body.shareSlug}`);
    }
  } else if (response.status === 403) {
    console.log(`  ⊘ Public sharing requires Pro plan (upgrade user to test)`);
  } else {
    console.error(`  ✗ Failed to share collection: ${response.status}`);
  }
}

// Main seeding function
async function seedDemoData() {
  console.log('='.repeat(60));
  console.log('Demo Dataset Seeding');
  console.log('='.repeat(60));
  console.log(`API: ${API_BASE_URL}`);
  console.log(`User: ${DEMO_USER_EMAIL}`);
  console.log('='.repeat(60));

  try {
    const token = await setupUser();
    const collectionMap = await createCollections(token);
    const bookmarkMap = await createBookmarks(token, collectionMap);
    await createHighlights(token, bookmarkMap);
    await shareCollection(token, collectionMap);

    console.log('\n' + '='.repeat(60));
    console.log('✓ Demo dataset created successfully!');
    console.log('='.repeat(60));
    console.log('\nSummary:');
    console.log(`  Collections: ${Object.keys(collectionMap).length}`);
    console.log(`  Bookmarks: ${Object.keys(bookmarkMap).length}`);
    console.log(`  Highlights: ${highlights.length} (requires Pro plan)`);
    console.log('\nLogin credentials:');
    console.log(`  Email: ${DEMO_USER_EMAIL}`);
    console.log(`  Password: ${DEMO_USER_PASSWORD}`);
    console.log('\nNote: Some Pro features (highlights, sharing) require');
    console.log('      upgrading the user to Pro plan in the database.');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n✗ Seeding failed:', error.message);
    process.exit(1);
  }
}

// Run the seeding
seedDemoData();
