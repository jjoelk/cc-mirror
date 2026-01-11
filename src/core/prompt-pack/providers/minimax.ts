import type { OverlayMap } from '../types.js';
import { operatingSpec, subjectiveWorkSpec, verbositySpec, skillClarificationSpec } from '../shared.js';

export const MINIMAX_WEB_SEARCH = 'mcp__MiniMax__web_search';
export const MINIMAX_UNDERSTAND_IMAGE = 'mcp__MiniMax__understand_image';

const buildMinimaxContract = () =>
  `
<explicit_guidance>
<tool_routing priority="critical">
MiniMax MCP tools available (and ONLY these for web + vision):
- ${MINIMAX_WEB_SEARCH} (web search)
- ${MINIMAX_UNDERSTAND_IMAGE} (image understanding)

<warning priority="critical">
For MiniMax variants, the builtin WebSearch tool does NOT exist (treat it as unavailable).
You MUST use ${MINIMAX_WEB_SEARCH} for all web discovery/search.
</warning>

MCP usage requirement:
- Before calling an MCP tool, you MUST load it using MCPSearch:
  - MCPSearch query: select:<full_tool_name>

Web search (MANDATORY):
1) Load: MCPSearch query select:${MINIMAX_WEB_SEARCH}
2) Call: ${MINIMAX_WEB_SEARCH} with:
   - query: 3-5 keywords; include the current date for time-sensitive queries
   - If results are weak: change keywords and retry

Image understanding (MANDATORY):
1) Load: MCPSearch query select:${MINIMAX_UNDERSTAND_IMAGE}
2) Call: ${MINIMAX_UNDERSTAND_IMAGE} for ANY image you need to interpret.
   - Only jpeg/png/webp are supported (per tool description).

Single-page URL retrieval:
- Use WebFetch for fetching and extracting from a specific URL.
- Do NOT misuse web_search to fetch full page content.
</tool_routing>

${operatingSpec()}

${subjectiveWorkSpec}

${verbositySpec}
</explicit_guidance>
`.trim();

export const buildMinimaxExcerpt = () =>
  `
<tool_info>
MiniMax tool routing:
- Web search MUST use ${MINIMAX_WEB_SEARCH} (load via MCPSearch first).
- Image understanding MUST use ${MINIMAX_UNDERSTAND_IMAGE} (load via MCPSearch first).
- Builtin WebSearch does NOT exist (treat as unavailable); always use ${MINIMAX_WEB_SEARCH}.
- Use WebFetch only for single-page URL retrieval/extraction.
</tool_info>

${subjectiveWorkSpec}
`.trim();

export const buildMinimaxOverlays = (): OverlayMap => ({
  main: buildMinimaxContract(),
  mcpCli: `
${buildMinimaxExcerpt()}

The MiniMax MCP server is preconfigured. Use MCPSearch to load the MCP tools before calling them.
  `.trim(),
  taskAgent: `
<explicit_guidance>
You are a Task subagent. Stay within requested scope, but be proactive about missing prerequisites.
Verify key claims with tools when possible; cite file paths and command outputs.
</explicit_guidance>

${buildMinimaxExcerpt()}

${verbositySpec}
  `.trim(),
  webfetch: `
<explicit_guidance>
MiniMax routing:
- Use WebFetch for fetching and extracting from a specific URL.
- Use ${MINIMAX_WEB_SEARCH} for discovery/search, not for fetching full page content.
</explicit_guidance>
  `.trim(),
  websearch: `
<explicit_guidance>
MiniMax routing: WebSearch does NOT exist (treat as unavailable).
Use MCPSearch + ${MINIMAX_WEB_SEARCH} for all web discovery/search instead.
</explicit_guidance>
  `.trim(),
  mcpsearch: `
<explicit_guidance>
MiniMax MCP tools:
- Web search: ${MINIMAX_WEB_SEARCH}
- Image understanding: ${MINIMAX_UNDERSTAND_IMAGE}

You MUST load the tool first:
- MCPSearch query: select:${MINIMAX_WEB_SEARCH} or select:${MINIMAX_UNDERSTAND_IMAGE}
</explicit_guidance>
  `.trim(),
  skill: skillClarificationSpec,
});
