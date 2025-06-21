#!/bin/bash

# SmallTalk Web Chat UI Runner
# This script makes it easy to run the web chat UI in different modes

echo "🌐 SmallTalk Web Chat UI Runner"
echo "================================"

# Parse command line arguments
ORCHESTRATION=false
PORT=3045
HELP=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -o|--orchestration)
      ORCHESTRATION=true
      shift
      ;;
    -p|--port)
      PORT="$2"
      shift 2
      ;;
    -h|--help)
      HELP=true
      shift
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

if [ "$HELP" = true ]; then
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  -o, --orchestration     Enable interactive orchestration mode"
  echo "  -p, --port PORT         Set custom port (default: 3045)"
  echo "  -h, --help              Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0                      # Simple mode on port 3045"
  echo "  $0 -o                   # With orchestration on port 3045"
  echo "  $0 -o -p 3000          # With orchestration on port 3000"
  echo "  $0 --port 8080          # Simple mode on port 8080"
  exit 0
fi

# Build the project
echo "🔨 Building SmallTalk..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed. Please fix the errors and try again."
  exit 1
fi

echo "✅ Build successful!"

# Prepare arguments for the web chat script
ARGS=""
if [ "$ORCHESTRATION" = true ]; then
  ARGS="$ARGS --orchestration"
  echo "🎯 Orchestration mode: ENABLED"
else
  echo "🎯 Orchestration mode: DISABLED"
fi

ARGS="$ARGS --port=$PORT"
echo "🔗 Port: $PORT"

echo ""
echo "🚀 Starting SmallTalk Web Chat UI..."
echo "   Mode: $([ "$ORCHESTRATION" = true ] && echo "Interactive Orchestration" || echo "Simple Chat")"
echo "   URL: http://localhost:$PORT"
echo ""
echo "💡 Tip: Set your OpenAI API key:"
echo "   export OPENAI_API_KEY='your-api-key-here'"
echo ""

# Run the web chat UI
npx tsx examples/web-chat-ui.ts $ARGS