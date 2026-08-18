#!/usr/bin/env bash
#
# Publishes @magicdoor/mcp to npm.
#
#   ./publish.sh              publish the current version
#   ./publish.sh 123456       ... passing a two-factor code from your authenticator
#
# npm requires a second factor to publish under the magicdoor org. Either pass the code as the
# only argument, or use a granular access token with "bypass 2FA" enabled and omit it.

set -euo pipefail
cd "$(dirname "$0")"

otp="${1:-}"
version=$(node -p "require('./package.json').version")

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is dirty. Commit first, so what is on npm matches what is on GitHub." >&2
  exit 1
fi

if npm view "@magicdoor/mcp@${version}" version >/dev/null 2>&1; then
  echo "@magicdoor/mcp@${version} is already published. Bump the version in package.json first:" >&2
  echo "  npm version patch   # or minor, or major" >&2
  exit 1
fi

echo "Checking types..."
npm run typecheck

echo "Running tests..."
npm test

echo "Publishing @magicdoor/mcp@${version}..."
if [ -n "$otp" ]; then
  npm publish --otp="$otp"
else
  npm publish
fi

echo
echo "Published. Install it with:"
echo "  npx -y @magicdoor/mcp"
