# CC-MIRROR + Judge

A fork of [cc-mirror](https://github.com/numman-ali/cc-mirror) with added **multi-agent consensus analysis**.

> For full cc-mirror documentation (variants, team mode, providers), see the [original repo](https://github.com/numman-ali/cc-mirror).

---

## Judge Command

Get second opinions on your Claude Code sessions from multiple AI models, synthesized by Opus.

```bash
python3 judge.py "check my implementation"
```

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                     python3 judge.py                            │
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
│  │  • Verifies claims  │    │  • Checks gaps      │            │
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

### Example Output

```
╔══════════════════════════════════════════════════════════════╗
║                      JUDGE VERDICT                           ║
╚══════════════════════════════════════════════════════════════╝

  Final Verdict: ! CONCERN
  Confidence:    40%
  Agreement:     50%

───────────────────── Worker Analysis ─────────────────────

  ! ZAI — concern (75%)
    The vulnerability is verified but there are presentation risks...

  ✓ MINIMAX — approve (85%)
    The implementation is correct and well-documented...

════════════════════════════════════════════════════════════

JARVIS Synthesis:

# Executive Summary
The vulnerability is real and verified. Both workers confirm the issue
exists, but disagree on severity...

# What the Workers Found
- ZAI found presentation issues that could cause rejection
- MiniMax validated the technical implementation

# My Assessment
The work is solid. Address the minor presentation issues before submitting.
```

### Usage

```bash
# Basic - auto-detects models
python3 judge.py "is my implementation correct?"

# Specify models explicitly
python3 judge.py -m zai,minimax "check for security issues"

# Show live activity (spinner + elapsed time)
python3 judge.py --live "deep dive this code"

# Skip Opus synthesis (just raw model outputs)
python3 judge.py --no-synthesis "quick check"

# List available sessions
python3 judge.py --list
```

### Requirements

- **Worker models**: `zai` and/or `minimax` variants (or just `claude`)
- **Synthesis**: `claude` command in PATH (for Opus)

```bash
# Create worker variants using cc-mirror
npx cc-mirror quick --provider zai --name zai --api-key $Z_AI_API_KEY
npx cc-mirror quick --provider minimax --name minimax --api-key $MINIMAX_API_KEY
```

### Why This Is Useful

| Scenario | How Judge Helps |
|----------|-----------------|
| **Code Review** | Get multiple perspectives on your implementation |
| **Bug Hunting** | Different models catch different issues |
| **Validation** | Verify claims before submitting PRs or reports |
| **Learning** | See how different models analyze the same code |

**Cost**: ~$0.01 for workers + ~$0.05 for Opus synthesis = **$0.06 per analysis**

---

## License

MIT — see [LICENSE](LICENSE)

---

<p align="center">
  Fork by <a href="https://github.com/jjoelk">jjoelk</a><br>
  Original <a href="https://github.com/numman-ali/cc-mirror">cc-mirror</a> by <a href="https://github.com/numman-ali">Numman Ali</a>
</p>
