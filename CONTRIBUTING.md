# Contributing

Before contributing, open an issue to discuss proposed changes.

## Development Setup

**Requirements:**
- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) >= 20.x
- npm (comes with Node.js)

**Fork and clone:**
```bash
git clone https://github.com/<YOUR_USERNAME>/positron-svn.git
cd positron-svn
```

**Install dependencies:**
```bash
npm install
```

## Development Workflow

### Build Commands

```bash
# Full build (TypeScript + CSS)
npm run build

# TypeScript only (faster)
npm run build:ts

# Watch mode (auto-rebuild)
npm run compile

# Package as VSIX
npm run package
```

### Testing Changes in Positron/VS Code

1. Make code changes in `src/`
2. Build: `npm run build`
3. Package: `npm run package`
4. Install VSIX:
   - Open Extensions (Ctrl+Shift+X)
   - Click `...` menu → "Install from VSIX..."
   - Select generated `.vsix` file
   - Reload window

### Code Quality

**Formatting (Prettier):**
```bash
npm run style-fix
```

**Linting (ESLint):**
```bash
npm run lint          # Check
npm run lint:fix      # Fix
```

### Debugging

1. Open project in VS Code
2. Run `npm run compile` (watch mode)
3. Press `F5` or select "Launch Extension" from Debug dropdown
4. Extension opens in new VS Code window

## Publishing

**To OpenVSX:**
```bash
npx ovsx publish positron-svn-VERSION.vsix -p YOUR_TOKEN
```
Get token: https://open-vsx.org/user-settings/tokens

## Project Guidelines

- **TDD**: Write tests before implementation
- **Commits**: Small, focused commits
- **Versioning**: Update version + changelog with every commit
- **Docs**: Keep CLAUDE.md, ARCHITECTURE.md, DEV_WORKFLOW.md updated
- **Tool calls**: <5 for simple queries, <15 for complex

See CLAUDE.md for architecture details and development practices.
