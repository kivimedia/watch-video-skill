# Contributing to CutSense

Thank you for your interest in contributing to CutSense!

## Getting Started

```bash
git clone https://github.com/kivimedia/watch-video-skill.git
cd watch-video-skill
pnpm install
pnpm turbo build
pnpm turbo test
```

## Prerequisites

- Node.js >= 20
- Python >= 3.10
- FFmpeg on PATH
- pnpm (installed via `npm install -g pnpm`)

## Project Structure

CutSense is a pnpm monorepo with 10 packages under `packages/`. See `CLAUDE.md` for the full architecture overview.

## Development Workflow

1. Create a branch: `git checkout -b feature/your-feature`
2. Make changes in the relevant package(s)
3. Run type check: `cd packages/<pkg> && npx tsc --noEmit`
4. Run tests: `pnpm turbo test`
5. Commit with a descriptive message
6. Open a PR against `master`

## Code Style

- TypeScript strict mode, ESM (`"type": "module"`)
- `.js` extensions in all import paths
- No emdashes - use a single dash `-`
- Space after colons in prose
- Prettier for formatting: `pnpm prettier --write .`

## Key Conventions

- All timestamps in seconds (float), never frames (except Remotion types)
- Import from package names (`@cutsense/core`), not relative paths across packages
- Python sidecar scripts: JSON to stdout, logs to stderr, exit 0 on success
- Windows compatibility: forward slashes when passing paths to FFmpeg/Python

## Testing

Tests use Vitest. Add test files in `tests/unit/<package>/` or `tests/integration/`.

```bash
pnpm turbo test           # all tests
cd tests && npx vitest    # run directly
```

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.
