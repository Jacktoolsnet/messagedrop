# Repository Retrieval Policy

Use this source priority by default:

1. Local repository code first.
2. For Angular topics in this repository:
   - Use Angular MCP tools first (`list_projects`, `get_best_practices`, `find_examples`, `search_documentation`) before external docs.
3. Use Context7 for external/non-Angular libraries and APIs.
4. If sources conflict:
   - Prefer local code for project behavior.
   - Prefer Angular MCP for Angular API/version guidance.
5. Keep source usage pragmatic and minimal; avoid redundant tool calls.
