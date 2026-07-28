# Contributing to GreenHorn

Thank you for your interest in contributing to GreenHorn! We welcome contributions from everyone.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](../../issues)
2. If not, create a new issue using the Bug Report template
3. Include:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots (if applicable)
   - Environment info (OS, Node.js version, browser)

### Suggesting Features

1. Open a [Feature Request](../../issues/new?template=feature_request.md)
2. Describe the problem you're trying to solve
3. Suggest a solution if you have one
4. Wait for maintainer feedback before starting work

### Submitting Code

1. **Fork** the repository
2. **Create a branch** from `develop`:
   ```bash
   git checkout -b feature/your-feature-name develop
   ```
3. **Make your changes** following our code standards
4. **Write tests** for new functionality
5. **Commit** with conventional commit messages:
   ```
   feat: add new chat streaming component
   fix: resolve config panel crash on Windows
   docs: update deployment guide
   ```
6. **Push** and create a **Pull Request** against `develop`

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style (formatting, missing semicolons, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

### Code Standards

- **Language**: TypeScript
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Linting**: ESLint + Prettier (configuration provided)
- **Testing**: Vitest (unit) + Playwright (E2E)

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/greenhorn.git
cd greenhorn

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Project Structure

```
greenhorn/
├── src/
│   ├── frontend/     # React frontend
│   ├── backend/      # Node.js backend
│   └── shared/       # Shared types and utilities
├── docs/             # Documentation
├── scripts/          # Build and utility scripts
├── tests/            # Test files
└── 交流文件/          # Project communication records
```

## Getting Help

- Check [docs/](docs/) for documentation
- Ask in [GitHub Discussions](../../discussions)
- Reach out to the tech lead via Issues

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
