# Contributing to @ucptools/validator

Thank you for your interest in contributing to the UCP Validator! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/Nolpak14/ucp-tools/issues)
2. If not, create a new issue with:
   - A clear, descriptive title
   - Steps to reproduce the issue
   - Expected vs actual behavior
   - Your environment (Node.js version, OS)
   - Sample UCP profile if applicable

### Suggesting Features

1. Check existing issues for similar suggestions
2. Create a new issue with the `enhancement` label
3. Describe the feature and its use case
4. Explain how it benefits UCP profile validation/generation

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Run tests: `npm test`
5. Run linting: `npm run lint`
6. Commit with a clear message describing your changes
7. Push to your fork and submit a pull request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/ucp-tools.git
cd ucp-tools

# Install dependencies
npm install

# Run tests
npm test

# Run in development mode
npm run dev
```

## Project Structure

```
src/
  types/        # TypeScript type definitions
  validator/    # Validation logic (structural, rules, network, SDK)
  generator/    # Profile and key generation
  simulator/    # AI agent simulation
  hosting/      # Deployment artifact generation
  api/          # Express REST API
  cli/          # Command-line tools
  db/           # Database schema and services
examples/       # Sample UCP profiles
```

## Coding Standards

- Use TypeScript for all new code
- Follow existing code style (enforced by ESLint)
- Add JSDoc comments for public APIs
- Write tests for new functionality
- Keep functions focused and single-purpose

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- src/validator/structural-validator.test.ts
```

## Validation Error Codes

When adding new validation rules, follow the existing pattern:

```typescript
{
  severity: 'error' | 'warn' | 'info',
  code: 'UCP_YOUR_ERROR_CODE',  // Prefix with UCP_
  path: '$.ucp.path.to.issue',   // JSON path format
  message: 'Clear description of the issue',
  hint: 'Suggestion to fix the issue'  // Optional
}
```

## Questions?

- Open an issue for general questions
- Check [ucptools.dev](https://ucptools.dev) for documentation
- Review the [UCP Specification](https://ucp.dev/specification/overview/)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
