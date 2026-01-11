# CC-MIRROR + Judge

A fork of [cc-mirror](https://github.com/numman-ali/cc-mirror) with added **multi-agent codebase analysis**.

> For full cc-mirror documentation (variants, team mode, providers), see the [original repo](https://github.com/numman-ali/cc-mirror).

---

## Installation

```bash
# Clone the repo
git clone https://github.com/jjoelk/cc-mirror.git
cd cc-mirror

# Install the judge command
./install-judge.sh

# Make sure ~/.local/bin is in your PATH
export PATH="$HOME/.local/bin:$PATH"
```

Now you can use `judge` from anywhere.

---

## Judge Command

Get multiple AI perspectives on your codebase, synthesized by Opus.

```bash
judge "how does the auth system work?"
```

### What You Can Ask

| Type | Example |
|------|---------|
| **Deep Research** | `"how does the routing system work?"` |
| **Code Quality** | `"review the code quality in src/api"` |
| **Architecture** | `"analyze the data flow in this app"` |
| **Bug Hunting** | `"find potential issues in the payment module"` |
| **General** | `"what does this codebase do?"` |

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                          judge                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
            Auto-detects available models
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Workers Investigate (Cheap Models)                     │
│                                                                 │
│  ┌─────────────────────┐    ┌─────────────────────┐            │
│  │  zai (GLM-4)        │    │  minimax (M2.1)     │            │
│  │  • Reads files      │    │  • Reads files      │            │
│  │  • Explores code    │    │  • Traces flow      │            │
│  │  • Uses tools       │    │  • Uses tools       │            │
│  └─────────────────────┘    └─────────────────────┘            │
│            │                          │                         │
│            └──────────┬───────────────┘                         │
│                       ▼                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: JARVIS Synthesis (Claude/Opus)                         │
│                                                                 │
│  • Reads all worker findings                                    │
│  • Creates executive summary                                    │
│  • Highlights agreements/disagreements                          │
│  • Gives actionable recommendations                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Final Verdict + Recommendations
```

### Usage

```bash
# Deep research
judge "how does the auth system work?"

# Code quality review
judge "review code quality and patterns"

# Architecture analysis
judge "analyze the overall architecture"

# Bug hunting
judge "find potential bugs or edge cases"

# Specify models explicitly
judge -m zai,minimax "your question"

# Skip Opus synthesis (just raw model outputs)
judge --no-synthesis "quick check"

# List available sessions
judge --list

# Manual cleanup (if needed)
judge --clean        # Delete small sessions only (with confirmation)
judge --clean-all    # Delete small sessions only (no confirmation)
```

### Auto-Cleanup

Judge automatically cleans up sessions it creates (workers + synthesis) after each run.

**Your real work sessions are NEVER deleted.** The `--clean` command only removes small sessions (<10KB) which are typically judge leftovers. Large sessions (your actual Claude Code work) are always preserved.

### Requirements

- **Worker models**: `zai` and/or `minimax` variants (or just `claude`)
- **Synthesis**: `claude` command in PATH (for Opus)
- **Pretty output**: `rich` library (auto-installed, or `pip install rich`)

```bash
# Create worker variants using cc-mirror
npx cc-mirror quick --provider zai --name zai --api-key $Z_AI_API_KEY
npx cc-mirror quick --provider minimax --name minimax --api-key $MINIMAX_API_KEY
```

The `rich` library renders markdown beautifully in terminal with colors, panels, and syntax highlighting. If not installed, judge falls back to plain text.

### Why Multiple Models?

Different models have different strengths:
- **GLM-4** (zai) - Strong at code analysis and reasoning
- **MiniMax** - Good at pattern recognition and edge cases
- **Opus** - Best at synthesis and nuanced judgment

When they agree, you can be confident. When they disagree, you learn something interesting.

**Cost**: ~$0.01 for workers + ~$0.05 for Opus synthesis = **$0.06 per analysis**

---

## License

MIT — see [LICENSE](LICENSE)

---

<p align="center">
  Fork by <a href="https://github.com/jjoelk">jjoelk</a><br>
  Original <a href="https://github.com/numman-ali/cc-mirror">cc-mirror</a> by <a href="https://github.com/numman-ali">Numman Ali</a>
</p>
