# Contributing to Bookmark Manager Platform

Thank you for your interest in contributing to the Bookmark Manager Platform! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Coding Standards](#coding-standards)
5. [Testing Requirements](#testing-requirements)
6. [Commit Guidelines](#commit-guidelines)
7. [Pull Request Process](#pull-request-process)
8. [Issue Guidelines](#issue-guidelines)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of experience level, gender identity, sexual orientation, disability, personal appearance, body size, race, ethnicity, age, religion, or nationality.

### Expected Behavior

- Be respectful and considerate in your communication
- Welcome newcomers and help them get started
- Focus on what is best for the community and project
- Show empathy towards other community members
- Accept constructive criticism gracefully

### Unacceptable Behavior

- Harassment, trolling, or discriminatory comments
- Personal attacks or insults
- Publishing others' private information without permission
- Any conduct that could reasonably be considered inappropriate

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- Node.js 20+ installed
- pnpm 10+ installed
- Docker Desktop running
- Git configured with your name and email
- A GitHub account

### Fork and Clone

1. **Fork the repository** on GitHub
2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/bookmark-manager-platform.git
   cd bookmark-manager-platform
   ```
3. **Add upstream remote:**
   ```bash
   git remote add upstream https://github.com/original/bookmark-manager-platform.git
   ```

### Setup Development Environment

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Start Docker services:**

   ```bash
   pnpm docker:up
   ```

3. **Configure environment:**

   ```bash
   cp packages/backend/.env.example packages/backend/.env
   ```

4. **Run migrations:**

   ```bash
   cd packages/backend
   pnpm migrate
   cd ../..
   ```

5. **Start development servers:**

   ```bash
   pnpm dev
   ```

6. **Verify setup:**
   ```bash
   pnpm test:run
   pnpm lint
   ```

## Development Workflow

### Branch Strategy

We use a simplified Git flow:

- **`main`** - Production-ready code
- **`develop`** - Integration branch for features
- **`feature/*`** - New features
- **`fix/*`** - Bug fixes
- **`docs/*`** - Documentation updates
- **`refactor/*`** - Code refactoring
- **`test/*`** - Test additions or improvements

### Creating a Feature Branch

```bash
# Update your local repository
git checkout develop
git pull upstream develop

# Create a feature branch
git checkout -b feature/amazing-feature

# Make your changes
# ...

# Commit your changes
git add .
git commit -m "feat: add amazing feature"

# Push to your fork
git push origin feature/amazing-feature
```

### Keeping Your Branch Updated

```bash
# Fetch upstream changes
git fetch upstream

# Rebase your branch
git rebase upstream/develop

# Force push if needed (only on your fork)
git push origin feature/amazing-feature --force-with-lease
```

## Coding Standards

### TypeScript

- **Strict mode enabled** - No implicit any, strict null checks
- **Explicit types** - Avoid type inference where it reduces clarity
- **Interfaces over types** - Use interfaces for object shapes
- **Functional style** - Prefer pure functions and immutability

**Example:**

```typescript
// Good
interface User {
  id: string;
  email: string;
  name: string;
}

function getUserById(id: string): Promise<User | null> {
  return db.users.findById(id);
}

// Avoid
function getUser(id: any) {
  return db.users.findById(id);
}
```

### Code Style

We use ESLint and Prettier for consistent code formatting:

```bash
# Check linting
pnpm lint

# Fix linting issues
pnpm lint --fix

# Format code
pnpm format

# Check formatting
pnpm format:check
```

### Naming Conventions

- **Variables and functions**: camelCase
- **Classes and interfaces**: PascalCase
- **Constants**: UPPER_SNAKE_CASE
- **Files**: kebab-case for components, camelCase for utilities
- **Database tables**: snake_case

**Examples:**

```typescript
// Variables and functions
const userId = '123';
function getUserProfile() {}

// Classes and interfaces
class BookmarkService {}
interface UserProfile {}

// Constants
const MAX_RETRIES = 3;
const API_BASE_URL = 'https://api.example.com';

// Files
user - profile.component.tsx;
bookmarkService.ts;
```

### Project Structure

Follow the established project structure:

```
packages/
├── backend/
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── services/      # Business logic
│   │   ├── repositories/  # Data access
│   │   ├── middleware/    # Express middleware
│   │   ├── utils/         # Utility functions
│   │   └── types/         # Type definitions
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom hooks
│   │   ├── stores/        # Zustand stores
│   │   └── lib/           # Utilities
```

## Testing Requirements

### Test Coverage

All contributions must include appropriate tests:

- **Unit tests** for functions and components
- **Property-based tests** for correctness properties
- **Integration tests** for API endpoints
- **E2E tests** for critical user flows (when applicable)

### Writing Tests

**Unit Test Example:**

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeUrl } from './urlUtils';

describe('normalizeUrl', () => {
  it('should remove tracking parameters', () => {
    const url = 'https://example.com?utm_source=twitter';
    const normalized = normalizeUrl(url);
    expect(normalized).toBe('https://example.com');
  });

  it('should preserve query parameters', () => {
    const url = 'https://example.com?page=2&sort=date';
    const normalized = normalizeUrl(url);
    expect(normalized).toBe('https://example.com?page=2&sort=date');
  });
});
```

**Property-Based Test Example:**

```typescript
import * as fc from 'fast-check';

describe('Tag normalization property', () => {
  it('should always produce lowercase normalized names', () => {
    fc.assert(
      fc.property(fc.string(), (tagName) => {
        const normalized = normalizeTagName(tagName);
        expect(normalized).toBe(normalized.toLowerCase());
      })
    );
  });
});
```

### Running Tests

```bash
# Run all tests
pnpm test:run

# Run tests in watch mode
pnpm test

# Run tests for specific package
pnpm --filter @bookmark-manager/backend test:run

# Run E2E tests
pnpm test:e2e

# Run with coverage
pnpm test:run --coverage
```

### Test Requirements

- **Minimum coverage**: 80% for new code
- **Property tests**: Required for correctness properties in design document
- **Integration tests**: Required for new API endpoints
- **E2E tests**: Required for new user-facing features

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Commit Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Commit Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring without changing functionality
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **chore**: Build process or tooling changes
- **ci**: CI/CD configuration changes

### Commit Examples

```bash
# Feature
git commit -m "feat(bookmarks): add bulk delete operation"

# Bug fix
git commit -m "fix(search): resolve pagination issue with large result sets"

# Documentation
git commit -m "docs(api): update authentication examples"

# Refactoring
git commit -m "refactor(services): extract common validation logic"

# Breaking change
git commit -m "feat(api): change bookmark response format

BREAKING CHANGE: bookmark response now includes tags array instead of tag_ids"
```

### Commit Message Guidelines

- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to..." not "moves cursor to...")
- Limit first line to 72 characters
- Reference issues and pull requests when applicable
- Provide detailed description in body for complex changes

## Pull Request Process

### Before Submitting

1. **Update your branch** with latest changes from develop
2. **Run tests** and ensure they pass
3. **Run linting** and fix any issues
4. **Update documentation** if needed
5. **Add tests** for new functionality
6. **Test manually** in development environment

### Creating a Pull Request

1. **Push your branch** to your fork
2. **Open a pull request** against the `develop` branch
3. **Fill out the PR template** completely
4. **Link related issues** using keywords (Fixes #123, Closes #456)
5. **Request review** from maintainers

### Pull Request Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Related Issues

Fixes #(issue number)

## Testing

- [ ] Unit tests added/updated
- [ ] Property-based tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally
- [ ] Dependent changes merged

## Screenshots (if applicable)

Add screenshots for UI changes
```

### Review Process

1. **Automated checks** must pass (CI/CD pipeline)
2. **Code review** by at least one maintainer
3. **Address feedback** and push updates
4. **Approval** from maintainer
5. **Merge** by maintainer (squash and merge)

### After Merge

1. **Delete your branch** from your fork
2. **Update your local repository:**
   ```bash
   git checkout develop
   git pull upstream develop
   ```
3. **Celebrate!** 🎉

## Issue Guidelines

### Before Creating an Issue

1. **Search existing issues** to avoid duplicates
2. **Check documentation** for answers
3. **Verify the issue** in latest version
4. **Gather information** (error messages, logs, screenshots)

### Issue Types

**Bug Report:**

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:

1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**

- OS: [e.g., macOS 14.0]
- Browser: [e.g., Chrome 120]
- Version: [e.g., 1.0.0]

**Additional context**
Any other context about the problem.
```

**Feature Request:**

```markdown
**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Alternative solutions or features you've considered.

**Additional context**
Any other context or screenshots.
```

### Issue Labels

- **bug** - Something isn't working
- **enhancement** - New feature or request
- **documentation** - Documentation improvements
- **good first issue** - Good for newcomers
- **help wanted** - Extra attention needed
- **question** - Further information requested
- **wontfix** - This will not be worked on

## Development Tips

### Debugging

**Backend:**

```bash
# Enable debug logging
LOG_LEVEL=debug pnpm --filter @bookmark-manager/backend dev

# Use Node.js debugger
node --inspect packages/backend/dist/index.js
```

**Frontend:**

```bash
# React DevTools
# Install browser extension

# Redux DevTools (for Zustand)
# Install browser extension
```

### Performance Profiling

```bash
# Backend profiling
node --prof packages/backend/dist/index.js

# Frontend profiling
# Use React DevTools Profiler
```

### Database Queries

```bash
# Connect to PostgreSQL
psql -h localhost -U bookmark_user -d bookmark_db

# View slow queries
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
```

## Getting Help

- **Documentation**: Check [docs/](docs/) directory
- **Discussions**: Use GitHub Discussions for questions
- **Issues**: Create an issue for bugs or feature requests
- **Slack**: Join our Slack workspace (link in README)
- **Email**: dev@bookmarkmanager.example.com

## Recognition

Contributors will be recognized in:

- **CONTRIBUTORS.md** file
- **Release notes** for significant contributions
- **Project README** for major features

Thank you for contributing to Bookmark Manager Platform! 🙏
