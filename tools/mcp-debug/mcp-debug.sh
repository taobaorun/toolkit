#!/usr/bin/env bash
# mcp-debug.sh — MCP service debugging tool
# Usage: ./mcp-debug.sh <type> <url> <action> [tool_name] [tool_args]
#
# Supports both SSE and Streamable HTTP MCP transports.
# Automatically handles MCP protocol handshake (initialize → initialized → action).
#
# @author yuanxuan

set -e

# --- helpers ----------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

die() { echo -e "${RED}Error:${NC} $1" >&2; exit 1; }
warn() { echo -e "${YELLOW}Warn:${NC} $1" >&2; }
info() { echo -e "${GREEN}→${NC} $1" >&2; }

usage() {
  cat <<EOF
Usage: mcp-debug <type> <url> <action> [tool_name] [tool_args]

  type       Transport type: sse | streamable
  url        Full MCP service endpoint URL
  action     Debug action: list | call
  tool_name  Tool name (required for 'call' action)
  tool_args  Tool arguments as JSON string (required for 'call' action)

Install:
  curl -sSL https://github.com/<user>/toolkit/raw/master/tools/mcp-debug/mcp-debug.sh -o /usr/local/bin/mcp-debug && chmod +x /usr/local/bin/mcp-debug

Examples:
  mcp-debug streamable http://host/mcpserver/streamable/mcp list
  mcp-debug sse http://host/mcpserver/sse list
  mcp-debug streamable http://host/mcpserver/streamable/mcp call my_tool '{}'
EOF
  exit 1
}

# Check dependencies
check_deps() {
  command -v curl >/dev/null 2>&1 || die "curl is required. Install: brew install curl"
  if ! command -v jq >/dev/null 2>&1; then
    warn "jq not found — JSON output will not be formatted. Install: brew install jq"
    HAS_JQ=false
  else
    HAS_JQ=true
  fi
}

# Format JSON output (if jq available)
format_json() {
  local input="$1"
  if $HAS_JQ; then
    echo "$input" | jq --color-output '.' 2>/dev/null || echo "$input"
  else
    echo "$input"
  fi
}

# Extract JSON-RPC result from response body
extract_rpc_result() {
  local body="$1"
  if $HAS_JQ; then
    # Check for JSON-RPC error first
    if echo "$body" | jq -e '.error' >/dev/null 2>&1; then
      local code=$(echo "$body" | jq -r '.error.code // "?"')
      local msg=$(echo "$body" | jq -r '.error.message // "unknown"')
      die "JSON-RPC error (code=$code): $msg"
    fi
    echo "$body" | jq '.result // .'
  else
    echo "$body"
  fi
}

# Build JSON-RPC request body
build_rpc_request() {
  local method="$1"
  local id="$2"
  local params="${3:-{}}"
  cat <<RPC_EOF
{
  "jsonrpc": "2.0",
  "id": $id,
  "method": "$method",
  "params": $params
}
RPC_EOF
}

# --- Streamable HTTP transport ----------------------------------------

do_streamable() {
  local url="$1"
  local action="$2"
  local tool_name="$3"
  local tool_args="${4:-{}}"

  info "Connecting to Streamable endpoint: $url"

  # Step 1: initialize — get session ID from response headers
  info "Sending initialize..."
  local init_body=$(build_rpc_request "initialize" 0 '{"protocolVersion":"2025-06-23","capabilities":{"sampling":{},"roots":{"listChanged":true}},"clientInfo":{"name":"mcp-debug","version":"1.0.0"}}')

  local init_response=$(curl -s -i \
    -H "Content-Type: application/json" \
    -H "Accept: text/event-stream, application/json" \
    --request POST \
    --data "$init_body" \
    "$url" 2>&1)

  # Extract session ID from response headers
  local session_id=$(echo "$init_response" | grep -i 'mcp-session-id:' | tr -d '\r' | awk '{print $2}' | tr -d '[:space:]')
  if [ -z "$session_id" ]; then
    # Try from response body (some implementations return it there too)
    local http_body=$(echo "$init_response" | sed -n '/^\r\{0,1\}$/,$p' | tail -n +2)
    warn "Session ID not found in response headers, trying body..."
    session_id=$(echo "$http_body" | jq -r '._meta?.sessionId // empty' 2>/dev/null || true)
  fi
  [ -z "$session_id" ] && die "Failed to extract session ID from initialize response"

  info "Got session ID: $session_id"

  # Step 2: send notifications/initialized
  info "Sending notifications/initialized..."
  local notif_body=$(build_rpc_request "notifications/initialized" 1 '{}')

  curl -s -o /dev/null \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    -H "mcp-session-id: $session_id" \
    --request POST \
    --data "$notif_body" \
    "$url" || warn "notifications/initialized returned non-zero"

  # Step 3: execute the requested action
  case "$action" in
    list)
      info "Listing tools..."
      local list_body=$(build_rpc_request "tools/list" 1010 '{}')
      local response=$(curl -s \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -H "mcp-session-id: $session_id" \
        --request POST \
        --data "$list_body" \
        "$url")
      extract_rpc_result "$response" | format_json
      ;;

    call)
      [ -z "$tool_name" ] && die "tool_name is required for 'call' action"
      info "Calling tool: $tool_name"
      local call_params=$(cat <<CALL_PARAMS
{"name":"$tool_name","arguments":$tool_args}
CALL_PARAMS
)
      local call_body=$(build_rpc_request "tools/call" 1011 "$call_params")
      local response=$(curl -s \
        -H "Content-Type: application/json" \
        -H "Accept: application/json, text/event-stream" \
        -H "mcp-session-id: $session_id" \
        --request POST \
        --data "$call_body" \
        "$url")
      extract_rpc_result "$response" | format_json
      ;;

    *) die "Unknown action: $action. Use 'list' or 'call'." ;;
  esac
}

# --- SSE transport ----------------------------------------------------

do_sse() {
  local url="$1"
  local action="$2"
  local tool_name="$3"
  local tool_args="${4:-{}}"

  info "Connecting to SSE endpoint: $url"

  # Use temp file for SSE stream output
  local tmpfile=$(mktemp /tmp/mcp-debug-sse.XXXXXX)
  # Cleanup on exit
  trap "rm -f $tmpfile; [ -n \"$CURL_PID\" ] && kill $CURL_PID 2>/dev/null || true" EXIT

  # Step 1: start SSE connection in background
  info "Starting SSE connection..."
  curl -s -N "$url" > "$tmpfile" 2>&1 &
  CURL_PID=$!

  # Step 2: wait for and extract session ID from SSE endpoint event
  info "Waiting for SSE endpoint event..."
  local session_id=""
  local message_url=""
  local waited=0
  while [ $waited -lt 10 ]; do
    sleep 0.5
    waited=$((waited + 1))

    # Look for the endpoint event in SSE stream
    # SSE format: "event: endpoint\ndata: <url>"
    local endpoint_data=$(grep -A1 'event: endpoint' "$tmpfile" 2>/dev/null | grep 'data:' | head -1 | sed 's/^data:[[:space:]]*//')

    if [ -n "$endpoint_data" ]; then
      message_url="$endpoint_data"
      # Extract sessionId from URL query parameter
      session_id=$(echo "$message_url" | grep -o 'sessionId=[^&]*' | cut -d= -f2)
      break
    fi
  done

  if [ -z "$session_id" ]; then
    # Try alternative: session ID might be in the URL itself as a path segment
    # or some servers send it as a separate event
    die "Failed to get session ID from SSE stream after ${waited}s.\nSSE output so far:\n$(head -20 "$tmpfile")"
  fi

  info "Got session ID: $session_id"

  # Step 3: determine message POST URL
  # If endpoint event gave full URL, use it; otherwise derive from base
  local post_url
  if echo "$message_url" | grep -q '^http'; then
    post_url="$message_url"
  else
    # Derive base from the SSE URL (strip /sse suffix or use parent path)
    local base_url="${url%/sse}"
    post_url="${base_url}/mcp/message?sessionId=${session_id}"
  fi
  info "Message endpoint: $post_url"

  # Step 4: send initialize via POST (response comes back through SSE stream)
  info "Sending initialize..."
  local init_body=$(build_rpc_request "initialize" 0 '{"protocolVersion":"2024-11-05","capabilities":{"sampling":{},"roots":{"listChanged":true}},"clientInfo":{"name":"mcp-debug","version":"1.0.0"}}')

  curl -s -o /dev/null \
    -H "Content-Type: application/json" \
    -H "Accept: text/event-stream" \
    --request POST \
    --data "$init_body" \
    "$post_url" 2>&1 || warn "initialize POST returned non-zero"

  # Step 5: send notifications/initialized
  info "Sending notifications/initialized..."
  local notif_body=$(build_rpc_request "notifications/initialized" 1 '{}')

  curl -s -o /dev/null \
    -H "Content-Type: application/json" \
    -H "Accept: text/event-stream" \
    --request POST \
    --data "$notif_body" \
    "$post_url" 2>&1 || warn "notifications/initialized returned non-zero"

  # Step 6: send the requested action
  local rpc_id=1010
  local rpc_body
  case "$action" in
    list)
      info "Listing tools..."
      rpc_body=$(build_rpc_request "tools/list" $rpc_id '{}')
      ;;
    call)
      [ -z "$tool_name" ] && die "tool_name is required for 'call' action"
      info "Calling tool: $tool_name"
      local call_params="{\"name\":\"$tool_name\",\"arguments\":$tool_args}"
      rpc_body=$(build_rpc_request "tools/call" $rpc_id "$call_params")
      ;;
    *) die "Unknown action: $action. Use 'list' or 'call'." ;;
  esac

  # Clear previous SSE output to avoid reading stale responses
  > "$tmpfile"

  curl -s -o /dev/null \
    -H "Content-Type: application/json" \
    -H "Accept: text/event-stream" \
    --request POST \
    --data "$rpc_body" \
    "$post_url" 2>&1

  # Step 7: read JSON-RPC response from SSE stream
  info "Waiting for response..."
  waited=0
  while [ $waited -lt 20 ]; do
    sleep 0.5
    waited=$((waited + 1))

    # Parse SSE data lines — collect lines with "data:" after our rpc id
    # The response should contain "id": $rpc_id in the data payload
    local all_data=$(grep '^data:' "$tmpfile" 2>/dev/null | sed 's/^data:[[:space:]]*//' | tr '\n' ' ')

    # Look for our specific rpc response by id
    local rpc_result=$(echo "$all_data" | grep -o "\"id\":$rpc_id[^}]*}" | head -1 || true)
    if [ -n "$rpc_result" ]; then
      # Reconstruct full JSON
      local result_json=$(echo "$all_data" | python3 -c "
import sys, json
text = sys.stdin.read()
# Find the JSON object containing our id
parts = text.split('{')
for p in parts:
    if '\"id\":$rpc_id' in p:
        obj = '{' + p.rsplit('}', 1)[0] + '}'
        try:
            parsed = json.loads(obj)
            print(json.dumps(parsed, indent=2))
        except:
            pass
        break
" 2>/dev/null || true)

      if [ -n "$result_json" ]; then
        # Try to extract result field if it's a JSON-RPC response
        if echo "$result_json" | jq -e '.result' >/dev/null 2>&1; then
          extract_rpc_result "$result_json" | format_json
        else
          echo "$result_json" | format_json
        fi
        return 0
      fi
    fi
  done

  # Fallback: dump whatever we received
  warn "Timed out waiting for structured response. Raw SSE output:"
  cat "$tmpfile"
}

# --- main -------------------------------------------------------------

main() {
  local type="$1"
  local url="$2"
  local action="$3"
  local tool_name="$4"
  local tool_args="${5:-{}}"

  # Validate required args
  [ -z "$type" ] && usage
  [ -z "$url" ] && usage
  [ -z "$action" ] && usage

  if [ "$type" != "sse" ] && [ "$type" != "streamable" ]; then
    die "Unknown transport type: '$type'. Use 'sse' or 'streamable'."
  fi

  if [ "$action" != "list" ] && [ "$action" != "call" ]; then
    die "Unknown action: '$action'. Use 'list' or 'call'."
  fi

  check_deps

  case "$type" in
    streamable) do_streamable "$url" "$action" "$tool_name" "$tool_args" ;;
    sse)         do_sse "$url" "$action" "$tool_name" "$tool_args" ;;
  esac
}

main "$@"