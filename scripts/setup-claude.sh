#!/usr/bin/env bash
# Print Claude Code configuration instructions for TokenTracker
set -euo pipefail

cat <<'INSTRUCTIONS'

=== Claude Code Telemetry Setup ===

1. Add these exports to your shell profile (~/.zshrc or ~/.bashrc):

   export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"

2. Add hooks to ~/.claude/settings.json:

   {
     "hooks": {
       "SessionStart": [
         {
           "matcher": "*",
           "hooks": [
             {
               "type": "command",
               "command": "HOOK_EVENT_TYPE=SessionStart bash /path/to/tokentracker/hooks/session-hook.sh"
             }
           ]
         }
       ],
       "Stop": [
         {
           "matcher": "*",
           "hooks": [
             {
               "type": "command",
               "command": "HOOK_EVENT_TYPE=Stop bash /path/to/tokentracker/hooks/session-hook.sh"
             }
           ]
         }
       ],
       "SessionEnd": [
         {
           "matcher": "*",
           "hooks": [
             {
               "type": "command",
               "command": "HOOK_EVENT_TYPE=SessionEnd bash /path/to/tokentracker/hooks/session-hook.sh"
             }
           ]
         }
       ]
     }
   }

   Replace /path/to/tokentracker with the actual path.

3. Restart Claude Code to pick up the new exports.

4. Verify: open http://localhost:3046/health to check connectivity.

INSTRUCTIONS
