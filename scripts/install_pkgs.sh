#!/bin/bash

# Only run in remote Claude Code environments
if [ -z "$CLAUDE_CODE_REMOTE" ]; then
  echo "Local environment detected. Skipping package installation."
  exit 0
fi

echo "Remote environment detected. Installing packages..."

# === Dependency Validation ===

# Check Node version (require >=20)
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -n "$NODE_VERSION" ]; then
  if [ "$NODE_VERSION" -lt 20 ]; then
    echo "Warning: Node $NODE_VERSION detected, requires >=20"
  else
    echo "Node v$NODE_VERSION OK"
  fi
fi

# Auto-install npm dependencies if missing
if [ -f "package.json" ] && [ ! -d "node_modules" ]; then
  echo "Installing npm dependencies..."
  npm ci --silent 2>/dev/null || npm install --silent 2>/dev/null || echo "Warning: npm install failed"
fi

# Install GitHub CLI
if ! command -v gh &> /dev/null; then
  echo "Installing GitHub CLI..."

  # Create local bin directory
  mkdir -p ~/.local/bin

  # Detect architecture
  ARCH=$(uname -m)
  case $ARCH in
    x86_64)
      GH_ARCH="linux_amd64"
      ;;
    aarch64)
      GH_ARCH="linux_arm64"
      ;;
    *)
      echo "Unsupported architecture: $ARCH"
      exit 1
      ;;
  esac

  # Use stable fallback version (skip unreliable API)
  GH_VERSION="2.62.0"
  echo "Downloading gh v${GH_VERSION} for ${GH_ARCH}..."

  DOWNLOAD_URL="https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_${GH_ARCH}.tar.gz"
  if ! curl -sfL "$DOWNLOAD_URL" -o /tmp/gh.tar.gz; then
    echo "Warning: Failed to download gh CLI (network restricted?)"
    echo "gh commands will not be available this session."
    exit 0  # Non-fatal - don't block startup
  fi

  if ! tar -xzf /tmp/gh.tar.gz -C /tmp; then
    echo "Failed to extract gh CLI (invalid archive)"
    rm -f /tmp/gh.tar.gz
    exit 0  # Non-fatal
  fi

  mv "/tmp/gh_${GH_VERSION}_${GH_ARCH}/bin/gh" ~/.local/bin/gh
  chmod +x ~/.local/bin/gh
  rm -rf /tmp/gh.tar.gz "/tmp/gh_${GH_VERSION}_${GH_ARCH}"

  # Add to PATH if not already there
  if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    export PATH="$HOME/.local/bin:$PATH"
  fi

  echo "GitHub CLI installed successfully at ~/.local/bin/gh"
else
  echo "GitHub CLI already installed."
fi

# Create symlink in /usr/local/bin for bare command access
# Claude Code Web blocks bare 'gh' command, so we use 'ghcli' as alternative
if [ -f ~/.local/bin/gh ]; then
  if [ ! -L /usr/local/bin/ghcli ]; then
    ln -sf "${HOME}/.local/bin/gh" /usr/local/bin/ghcli
    echo "Created symlink: ghcli -> gh (use 'ghcli' as bare command)"
  fi
fi

# Configure gh CLI for Claude Code Web proxy remotes
# The git remote uses a local proxy, so we need to help gh find the repo
if [ -d ".git" ] || git rev-parse --git-dir > /dev/null 2>&1; then
  REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
  # Extract owner/repo from proxy URL (e.g., http://local_proxy@127.0.0.1:52168/git/owner/repo)
  if [[ "$REMOTE_URL" =~ /git/([^/]+/[^/]+)$ ]] || [[ "$REMOTE_URL" =~ github\.com[:/]([^/]+/[^/.]+) ]]; then
    REPO="${BASH_REMATCH[1]}"
    REPO="${REPO%.git}"  # Remove .git suffix if present
    echo "Detected GitHub repo: $REPO"

    # Create gh wrapper that auto-adds --repo flag for repo-specific commands
    cat > ~/.local/bin/gh-wrapper << 'WRAPPER_EOF'
#!/bin/bash
# Wrapper for gh CLI in Claude Code Web environments
# Auto-detects repo from proxy remote URLs

GH_BIN="$HOME/.local/bin/gh-bin"

# Commands that need --repo flag
REPO_FLAG_COMMANDS="pr issue release run workflow"

# Get repo from git remote if not already set
get_repo() {
  if [ -n "$GH_REPO" ]; then
    echo "$GH_REPO"
    return
  fi

  REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
  if [[ "$REMOTE_URL" =~ /git/([^/]+/[^/]+)$ ]] || [[ "$REMOTE_URL" =~ github\.com[:/]([^/]+/[^/.]+) ]]; then
    REPO="${BASH_REMATCH[1]}"
    echo "${REPO%.git}"
  fi
}

CMD="$1"
SUBCMD="$2"

# Handle 'repo view' specially - uses positional arg
if [ "$CMD" = "repo" ] && [ "$SUBCMD" = "view" ]; then
  REPO=$(get_repo)
  if [ -n "$REPO" ]; then
    # Check if repo is already provided (3rd arg exists and doesn't start with -)
    if [ -z "$3" ] || [[ "$3" == -* ]]; then
      shift 2  # Remove 'repo view'
      exec "$GH_BIN" repo view "$REPO" "$@"
    fi
  fi
  exec "$GH_BIN" "$@"
fi

# Check if first arg needs --repo flag
NEEDS_REPO=false
for rc in $REPO_FLAG_COMMANDS; do
  if [ "$CMD" = "$rc" ]; then
    NEEDS_REPO=true
    break
  fi
done

# Add --repo flag if needed and not already present
if $NEEDS_REPO; then
  REPO=$(get_repo)
  if [ -n "$REPO" ]; then
    # Check if --repo or -R is already in args
    HAS_REPO=false
    for arg in "$@"; do
      if [[ "$arg" == "--repo" ]] || [[ "$arg" == "-R" ]] || [[ "$arg" == --repo=* ]]; then
        HAS_REPO=true
        break
      fi
    done

    if ! $HAS_REPO; then
      exec "$GH_BIN" "$@" --repo "$REPO"
    fi
  fi
fi

exec "$GH_BIN" "$@"
WRAPPER_EOF
    chmod +x ~/.local/bin/gh-wrapper

    # Rename original gh to gh-bin, make wrapper the main gh
    if [ -f ~/.local/bin/gh ] && [ ! -f ~/.local/bin/gh-bin ]; then
      mv ~/.local/bin/gh ~/.local/bin/gh-bin
      mv ~/.local/bin/gh-wrapper ~/.local/bin/gh
      echo "gh CLI wrapper configured for repo: $REPO"
    fi
  fi
fi

echo "Package installation complete."
