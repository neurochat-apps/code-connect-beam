
- MCP server lives in src/lib/mcp (one tool per file, reusing ai-tools.server executeTool) with Supabase OAuth; tools run as the caller so RLS applies.
