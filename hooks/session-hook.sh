#!/usr/bin/env bash
# Claude Code hook script for TokenTracker
# Posts session metadata to the dashboard on lifecycle events.
#
# Install by adding to ~/.claude/settings.json hooks section.
# Receives hook event JSON on stdin.

TRACKER_URL="${TOKENTRACKER_URL:-http://localhost:3046}"
ENDPOINT="${TRACKER_URL}/api/hooks"

# Read stdin (hook event payload)
INPUT=$(cat)

# Extract session_id from the hook environment or payload
# Claude Code sets SESSION_ID in the environment for hooks
SESSION_ID="${SESSION_ID:-$(echo "$INPUT" | grep -o '"session_id":"[^"]*"' | head -1 | cut -d'"' -f4)}"

if [ -z "$SESSION_ID" ]; then
  # Try extracting from the hook's session context
  SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
fi

# Determine event type from the hook trigger context
# This is set by the hook matcher in settings.json
EVENT_TYPE="${HOOK_EVENT_TYPE:-unknown}"

# Get project metadata
CWD="$(pwd)"
PROJECT_NAME="$(basename "$CWD")"

# Get git branch if in a repo
GIT_BRANCH=""
if git rev-parse --git-dir > /dev/null 2>&1; then
  GIT_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || echo "")"
fi

# Build JSON payload
PAYLOAD=$(cat <<EOF
{
  "session_id": "${SESSION_ID}",
  "event_type": "${EVENT_TYPE}",
  "cwd": "${CWD}",
  "project_name": "${PROJECT_NAME}",
  "git_branch": "${GIT_BRANCH}"
}
EOF
)

# Post to tracker (fire-and-forget, don't block Claude Code)
curl -s -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}" \
  --connect-timeout 2 \
  --max-time 5 \
  > /dev/null 2>&1 &
