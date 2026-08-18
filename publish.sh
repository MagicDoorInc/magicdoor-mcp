#!/usr/bin/env bash
#
# Publishes @magicdoor/mcp to npm.
#
#   NPM_TOKEN=npm_xxx ./publish.sh    publish using a granular access token
#   ./publish.sh 123456               publish using a two-factor code, if you have 2FA set up
#
# npm refuses to publish without a second factor. With 2FA disabled on the account, the way
# through is a granular access token that has "Bypass 2FA" enabled:
#
#   npmjs.com -> Access Tokens -> Generate New Token -> Granular Access Token
#     Expiration:          whatever you will remember to rotate
#     Packages and scopes: Read and write, limited to the @magicdoor scope
#     Bypass 2FA:          ticked
#
# The token is scoped to @magicdoor, so it cannot touch anything else even if it leaks.

set -euo pipefail
cd "$(dirname "$0")"

otp="${1:-}"
version=$(node -p "require('./package.json').version")

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is dirty. Commit first, so what is on npm matches what is on GitHub." >&2
  exit 1
fi

if npm view "@magicdoor/mcp@${version}" version >/dev/null 2>&1; then
  echo "@magicdoor/mcp@${version} is already published. Bump the version first:" >&2
  echo "  npm version patch   # or minor, or major" >&2
  exit 1
fi

if [ -z "${NPM_TOKEN:-}" ] && [ -z "$otp" ]; then
  echo "Need either NPM_TOKEN (a granular token with Bypass 2FA) or a two-factor code." >&2
  echo "See the comments at the top of this script for how to create the token." >&2
  exit 1
fi

echo "Checking types..."
npm run typecheck

echo "Running tests..."
npm test

echo "Publishing @magicdoor/mcp@${version}..."
if [ -n "${NPM_TOKEN:-}" ]; then
  # Keep the token out of ~/.npmrc and out of the process list; delete it however we exit.
  npmrc=$(mktemp)
  trap 'rm -f "$npmrc"' EXIT
  printf '//registry.npmjs.org/:_authToken=%s\n' "$NPM_TOKEN" > "$npmrc"
  npm publish --userconfig "$npmrc"
else
  npm publish --otp="$otp"
fi

echo
echo "Published. Install it with:"
echo "  npx -y @magicdoor/mcp"
