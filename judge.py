#!/usr/bin/env python3
"""
Judge - Multi-agent codebase analysis

Usage:
    python3 judge.py "how does auth work?"       # Deep research
    python3 judge.py "review code quality"       # Code review
    python3 judge.py "find potential bugs"       # Bug hunting
    python3 judge.py "check the architecture"    # Architecture review
    python3 judge.py --list                      # List sessions
    python3 judge.py --help                      # Show help
"""

import argparse
import json
import os
import pty
import re
import select
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

# Try to import rich for beautiful markdown rendering
try:
    from rich.console import Console
    from rich.markdown import Markdown
    from rich.panel import Panel
    from rich.style import Style
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False

# ANSI colors
GREEN = "\033[32m"
RED = "\033[31m"
YELLOW = "\033[33m"
CYAN = "\033[36m"
GRAY = "\033[90m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

VERDICT_COLORS = {
    "approve": GREEN,
    "reject": RED,
    "concern": YELLOW,
    "mixed": CYAN,
    "neutral": GRAY,
}

VERDICT_ICONS = {
    "approve": "✓",
    "reject": "✗",
    "concern": "!",
    "mixed": "?",
    "neutral": "○",
}

# Spinner frames
SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]


def render_markdown(text: str, title: str = None):
    """Render markdown beautifully in terminal using rich, or fallback to plain text."""
    if RICH_AVAILABLE:
        console = Console()
        md = Markdown(text)
        if title:
            panel = Panel(md, title=f"[bold cyan]{title}[/bold cyan]", border_style="cyan")
            console.print(panel)
        else:
            console.print(md)
    else:
        # Fallback: basic formatting without rich
        if title:
            print(f"\n{BOLD}{CYAN}╭─ {title} {'─' * (50 - len(title))}╮{RESET}")
        print(text)
        if title:
            print(f"{CYAN}╰{'─' * 56}╯{RESET}")


class LiveDisplay:
    """Live display for worker activity."""

    def __init__(self, workers: list):
        self.workers = {w: {"status": "waiting", "activity": "Starting...", "done": False, "start_time": time.time()} for w in workers}
        self.lock = threading.Lock()
        self.running = True
        self.spinner_idx = 0
        self.thread = None
        self.start_time = time.time()

    def start(self):
        """Start the display thread."""
        self.thread = threading.Thread(target=self._render_loop, daemon=True)
        self.thread.start()

    def stop(self):
        """Stop the display thread."""
        self.running = False
        if self.thread:
            self.thread.join(timeout=1)
        # Clear the display lines
        print(f"\033[{len(self.workers) + 1}A\033[J", end="")

    def update(self, worker: str, activity: str, done: bool = False):
        """Update worker activity."""
        with self.lock:
            if worker in self.workers:
                self.workers[worker]["activity"] = activity
                self.workers[worker]["done"] = done
                if done:
                    self.workers[worker]["status"] = "done"
                    self.workers[worker]["elapsed"] = time.time() - self.workers[worker]["start_time"]

    def _render_loop(self):
        """Render the display in a loop."""
        # Initial render
        print("\n" * len(self.workers), end="")

        while self.running:
            self._render()
            time.sleep(0.08)  # Faster updates for smoother animation
            self.spinner_idx = (self.spinner_idx + 1) % len(SPINNER)

    def _render(self):
        """Render current state."""
        with self.lock:
            # Move cursor up
            print(f"\033[{len(self.workers)}A", end="")

            for worker, state in self.workers.items():
                elapsed = state.get("elapsed", time.time() - state["start_time"])
                elapsed_str = f"{elapsed:.0f}s"

                if state["done"]:
                    icon = f"{GREEN}✓{RESET}"
                    activity = f"{DIM}Done ({elapsed_str}){RESET}"
                else:
                    icon = f"{CYAN}{SPINNER[self.spinner_idx]}{RESET}"
                    activity = state["activity"][:55]
                    if len(state["activity"]) > 55:
                        activity += "..."
                    activity = f"{activity} {DIM}[{elapsed_str}]{RESET}"

                # Clear line and print
                print(f"\033[K  {icon} {BOLD}{worker.upper()}{RESET}: {activity}")

            sys.stdout.flush()


def parse_activity_from_output(line: str) -> Optional[str]:
    """Parse Claude Code output to detect tool usage and activity."""
    line = line.strip()
    if not line:
        return None

    line_lower = line.lower()

    # Detect Claude Code tool usage patterns (what it actually outputs)

    # Read tool patterns
    if any(p in line_lower for p in ["read tool", "reading file", "let me read", "i'll read", "reading the"]):
        # Extract file path
        file_match = re.search(r'[`"\']?([a-zA-Z0-9_./-]+\.(go|ts|tsx|js|jsx|py|rs|md|json|yaml|toml|txt|sh|sql|html|css|c|cpp|h|hpp|java|kt|rb|php|swift|sol|move))[`"\']?', line)
        if file_match:
            return f"Reading {file_match.group(1)[-50:]}"
        return "Reading file..."

    # Grep/Search patterns
    if any(p in line_lower for p in ["grep tool", "searching for", "let me search", "i'll search", "i'll grep", "searching the", "grep for"]):
        # Try to extract search term
        pattern_match = re.search(r'(?:for|pattern)\s*[`"\']([^`"\']+)[`"\']', line)
        if pattern_match:
            return f"Searching: '{pattern_match.group(1)[:30]}'"
        return "Searching codebase..."

    # Glob/Find patterns
    if any(p in line_lower for p in ["glob tool", "finding files", "let me find", "looking for files", "i'll find"]):
        return "Finding files..."

    # Bash/Command patterns
    if any(p in line_lower for p in ["bash tool", "running command", "let me run", "i'll run", "executing", "running:"]):
        cmd_match = re.search(r'[`"\']([^`"\']+)[`"\']', line)
        if cmd_match and len(cmd_match.group(1)) < 50:
            return f"Running: {cmd_match.group(1)[:40]}"
        return "Running command..."

    # Tool result patterns (Claude shows these after tool use)
    if "file_path" in line_lower and "result" not in line_lower:
        file_match = re.search(r'file_path["\']?\s*[:=]\s*["\']?([^"\'}\s,]+)', line)
        if file_match:
            return f"Reading {file_match.group(1)[-50:]}"

    # Analysis/thinking patterns
    if any(p in line_lower for p in ["let me investigate", "investigating", "i need to check", "checking the"]):
        return "Investigating..."
    if any(p in line_lower for p in ["let me verify", "verifying", "i'll verify"]):
        return "Verifying..."
    if any(p in line_lower for p in ["analyzing", "let me analyze", "i'll analyze"]):
        return "Analyzing..."
    if any(p in line_lower for p in ["examining", "let me examine", "looking at"]):
        return "Examining code..."

    # Code block with file path (common in Claude output)
    if line.startswith("```") and "/" in line:
        return f"Showing code..."

    # Direct file path mentions in output
    file_match = re.search(r'[`]([a-zA-Z0-9_./]+\.(go|ts|tsx|js|jsx|py|rs|md|json|yaml|toml|sol|move))[`]', line)
    if file_match:
        return f"Looking at {file_match.group(1)[-50:]}"

    # Line number references (common when showing findings)
    if re.search(r'line\s*\d+|:\d+:', line_lower):
        return "Examining specific lines..."

    # Function/method investigation
    if any(p in line_lower for p in ["function", "method", "calls", "implementation"]) and len(line) < 100:
        return "Tracing code flow..."

    return None

# General investigation prompt - let the model use its own personality
GENERAL_PROMPT = """Analyze this Claude Code conversation and answer the question below.

## QUESTION
{question}

## YOUR TOOLS
You have FULL access to: Read, Grep, Glob, Bash. USE THEM to explore the codebase.

## WHAT YOU CAN DO
- **Code Quality**: Review structure, patterns, readability, maintainability
- **Deep Research**: Explore how things work, trace through the codebase
- **Architecture**: Analyze design decisions, dependencies, data flow
- **Bug Hunting**: Find issues, edge cases, potential problems
- **General Questions**: Answer anything about the code or conversation

## CONVERSATION
---
{context}
---

## HOW TO RESPOND
1. Use your tools to actually explore the codebase (don't just guess)
2. Show your investigation process
3. Give your honest assessment based on what you find

End with this JSON:
{{"verdict": "approve|reject|concern|neutral", "confidence": <0-100>, "summary": "<your findings>", "concerns": ["<issue 1>", "<issue 2>"], "recommendations": ["<suggestion>"]}}"""


# Legacy personality prompts (kept for --personality flag)
PERSONALITY_PROMPTS = {
    "skeptic": """You are a critical reviewer. Question everything, verify all claims.
{question}

You have tools: Read, Grep, Glob, Bash. USE THEM.

CONVERSATION:
---
{context}
---

Investigate thoroughly, then output JSON:
{{"verdict": "approve|reject|concern|neutral", "confidence": <0-100>, "summary": "<findings>", "concerns": [], "recommendations": []}}""",

    "auditor": """You are a thorough auditor. Check completeness and correctness.
{question}

You have tools: Read, Grep, Glob, Bash. USE THEM.

CONVERSATION:
---
{context}
---

Investigate thoroughly, then output JSON:
{{"verdict": "approve|reject|concern|neutral", "confidence": <0-100>, "summary": "<findings>", "concerns": [], "recommendations": []}}""",
}

# For backward compat
WORKER_PROMPTS = PERSONALITY_PROMPTS


@dataclass
class WorkerVerdict:
    worker: str
    verdict: str
    confidence: int
    summary: str
    concerns: list
    recommendations: list
    raw_output: str
    error: Optional[str] = None


@dataclass
class Consensus:
    final_verdict: str
    confidence: int
    agreement: int
    summary: str
    all_concerns: list
    all_recommendations: list


def encode_project_path(project_path: str) -> str:
    """Encode project path to Claude session directory format."""
    # Claude uses leading dash: /mnt/c/foo -> -mnt-c-foo
    return project_path.replace("/", "-")


def get_sessions_dir(project_path: str) -> Path:
    """Get the sessions directory for a project."""
    encoded = encode_project_path(project_path)
    return Path.home() / ".claude" / "projects" / encoded


def list_sessions(project_path: str, min_size: int = 500) -> list:
    """List all sessions for a project, sorted by most recent.

    Filters out empty/tiny sessions (< min_size bytes).
    """
    sessions_dir = get_sessions_dir(project_path)
    if not sessions_dir.exists():
        return []

    sessions = []
    for f in sessions_dir.iterdir():
        if f.suffix == ".jsonl" and not f.name.startswith("agent-"):
            size = f.stat().st_size
            # Skip empty/tiny sessions
            if size >= min_size:
                sessions.append({
                    "id": f.stem,
                    "path": f,
                    "modified": f.stat().st_mtime,
                    "size": size,
                })

    return sorted(sessions, key=lambda x: x["modified"], reverse=True)


def parse_session(session_path: Path) -> list:
    """Parse a session JSONL file and return messages."""
    messages = []
    with open(session_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                if data.get("message") and data.get("type") in ("user", "assistant"):
                    if not data.get("isMeta"):
                        messages.append(data)
            except json.JSONDecodeError:
                continue
    return messages


def extract_context(messages: list, max_messages: int = 30, max_chars: int = 60000) -> str:
    """Extract conversation context from messages."""
    recent = messages[-max_messages:]

    formatted = []
    for m in recent:
        role = "Human" if m.get("type") == "user" else "Assistant"
        content = m.get("message", {}).get("content", "")
        formatted.append(f"{role}: {content}")

    result = "\n\n".join(formatted)

    if len(result) > max_chars:
        result = "[...earlier messages truncated]\n\n" + result[-max_chars:]

    return result


def spawn_worker_streaming(worker_name: str, prompt: str, variant: str, bin_dir: Path, timeout: int, display: Optional[LiveDisplay] = None) -> WorkerVerdict:
    """Spawn a worker with streaming output for live display using PTY."""
    import shutil

    # Handle both PATH commands (like 'claude') and bin_dir variants (like 'zai')
    if shutil.which(variant):
        wrapper_path = variant  # Use from PATH
    else:
        wrapper_path = str(bin_dir / variant)
        if not Path(wrapper_path).exists():
            return WorkerVerdict(
                worker=worker_name,
                verdict="neutral",
                confidence=0,
                summary=f"Variant '{variant}' not found",
                concerns=[],
                recommendations=[],
                raw_output="",
                error=f"Variant not found at {wrapper_path}",
            )

    try:
        env = os.environ.copy()
        env["CC_MIRROR_SPLASH"] = "0"
        env["TERM"] = "dumb"  # Simpler terminal for parsing

        # Use PTY for unbuffered streaming output
        master_fd, slave_fd = pty.openpty()

        process = subprocess.Popen(
            [str(wrapper_path), "--dangerously-skip-permissions", "--print", "-p", prompt],
            stdout=slave_fd,
            stderr=slave_fd,
            stdin=subprocess.DEVNULL,
            env=env,
            close_fds=True,
        )

        os.close(slave_fd)  # Close slave in parent

        output_chunks = []
        buffer = ""
        start_time = time.time()
        last_activity = "Starting analysis..."
        last_activity_time = time.time()
        chunk_count = 0
        first_output = False
        thinking_messages = [
            "Thinking...",
            "Analyzing context...",
            "Processing request...",
            "Building investigation plan...",
            "Preparing tools...",
            "Reviewing conversation...",
        ]
        thinking_idx = 0

        if display:
            display.update(worker_name, last_activity)

        try:
            while True:
                # Show thinking messages if no output yet
                if not first_output and display and time.time() - last_activity_time > 3:
                    thinking_idx = (thinking_idx + 1) % len(thinking_messages)
                    display.update(worker_name, thinking_messages[thinking_idx])
                    last_activity_time = time.time()

                # Check timeout
                elapsed = time.time() - start_time
                if elapsed > timeout:
                    process.kill()
                    if display:
                        display.update(worker_name, "Timed out", done=True)
                    return WorkerVerdict(
                        worker=worker_name,
                        verdict="neutral",
                        confidence=0,
                        summary="Worker timed out",
                        concerns=[],
                        recommendations=[],
                        raw_output="".join(output_chunks),
                        error="Timeout",
                    )

                # Non-blocking read with select
                ready, _, _ = select.select([master_fd], [], [], 0.1)
                if ready:
                    try:
                        chunk = os.read(master_fd, 4096).decode('utf-8', errors='replace')
                        if not chunk:
                            break
                        output_chunks.append(chunk)
                        buffer += chunk
                        chunk_count += 1
                        first_output = True

                        # Process buffer for activity detection
                        if display:
                            lines = buffer.split('\n')
                            buffer = lines[-1]  # Keep incomplete line

                            for line in lines[:-1]:
                                activity = parse_activity_from_output(line)
                                if activity:
                                    last_activity = activity
                                    last_activity_time = time.time()
                                    display.update(worker_name, activity)

                            # Fallback: show raw content more aggressively
                            if time.time() - last_activity_time > 0.5:
                                # Show what we're seeing - extract meaningful text
                                recent_text = ''.join(output_chunks[-3:]) if len(output_chunks) >= 3 else ''.join(output_chunks)
                                # Clean up ANSI codes
                                clean = re.sub(r'\x1b\[[0-9;]*[mKHJ]', '', recent_text)
                                clean = re.sub(r'\r', '', clean)
                                # Get last meaningful line
                                clean_lines = [l.strip() for l in clean.split('\n') if l.strip() and len(l.strip()) > 3]
                                if clean_lines:
                                    last_line = clean_lines[-1][:55]
                                    if last_line:
                                        display.update(worker_name, last_line)
                                        last_activity_time = time.time()
                                elif chunk_count % 10 == 0:
                                    display.update(worker_name, f"Working... ({chunk_count} chunks)")
                                    last_activity_time = time.time()

                    except OSError:
                        break
                elif process.poll() is not None:
                    # Process finished, read any remaining data
                    try:
                        while True:
                            ready, _, _ = select.select([master_fd], [], [], 0.1)
                            if not ready:
                                break
                            chunk = os.read(master_fd, 4096).decode('utf-8', errors='replace')
                            if not chunk:
                                break
                            output_chunks.append(chunk)
                    except OSError:
                        pass
                    break

        finally:
            os.close(master_fd)

        output = "".join(output_chunks)
        # Clean ANSI escape codes for parsing
        output_clean = re.sub(r'\x1b\[[0-9;]*[mK]', '', output)

        if display:
            display.update(worker_name, "Done", done=True)

        return parse_worker_output_to_verdict(worker_name, output_clean, "")

    except Exception as e:
        if display:
            display.update(worker_name, f"Error: {str(e)[:30]}", done=True)
        return WorkerVerdict(
            worker=worker_name,
            verdict="neutral",
            confidence=0,
            summary=str(e),
            concerns=[],
            recommendations=[],
            raw_output="",
            error=str(e),
        )


def parse_worker_output_to_verdict(worker_name: str, output: str, stderr: str) -> WorkerVerdict:
    """Parse worker output into a verdict (extracted from spawn_worker for reuse)."""
    # Parse JSON from output - try multiple patterns
    json_match = re.search(
        r'\{\s*"verdict"\s*:\s*"[^"]+"\s*,\s*"confidence"\s*:\s*\d+.*?"recommendations"\s*:\s*\[.*?\]\s*\}',
        output,
        re.DOTALL
    )

    if not json_match:
        matches = list(re.finditer(r'\{[^{}]*"verdict"[^{}]*\}', output))
        if matches:
            json_match = matches[-1]

    if not json_match:
        json_match = re.search(r'\{[^}]*"verdict"\s*:\s*"(approve|reject|concern|neutral)"[^}]*\}', output)

    if json_match:
        try:
            json_str = json_match.group()
            json_str = re.sub(r',\s*}', '}', json_str)
            json_str = re.sub(r',\s*]', ']', json_str)

            data = json.loads(json_str)
            return WorkerVerdict(
                worker=worker_name,
                verdict=data.get("verdict", "neutral"),
                confidence=data.get("confidence", 50),
                summary=data.get("summary", ""),
                concerns=data.get("concerns", []) if isinstance(data.get("concerns"), list) else [],
                recommendations=data.get("recommendations", []) if isinstance(data.get("recommendations"), list) else [],
                raw_output=output,
            )
        except json.JSONDecodeError as e:
            verdict_match = re.search(r'"verdict"\s*:\s*"(approve|reject|concern|neutral)"', output)
            conf_match = re.search(r'"confidence"\s*:\s*(\d+)', output)
            summary_match = re.search(r'"summary"\s*:\s*"([^"]*)"', output)

            if verdict_match:
                return WorkerVerdict(
                    worker=worker_name,
                    verdict=verdict_match.group(1),
                    confidence=int(conf_match.group(1)) if conf_match else 50,
                    summary=summary_match.group(1) if summary_match else "Partial parse",
                    concerns=[],
                    recommendations=[],
                    raw_output=output,
                    error=f"Partial JSON parse: {e}",
                )

    # Smart fallback - analyze text content
    output_lower = output.lower()
    approve_signals = ["real bug", "vulnerability is proven", "verified", "confirmed", "correct", "✅", "valid finding"]
    reject_signals = ["not a bug", "invalid", "false positive", "incorrect", "doesn't exist", "no vulnerability"]
    concern_signals = ["concern", "issue", "problem", "discrepancy", "missing", "⚠️", "however", "but"]

    approve_count = sum(1 for s in approve_signals if s in output_lower)
    reject_count = sum(1 for s in reject_signals if s in output_lower)
    concern_count = sum(1 for s in concern_signals if s in output_lower)

    summary = "Analysis completed but no JSON verdict provided."
    if "### " in output:
        for header in ["conclusion", "summary", "core issue", "bottom line", "verdict"]:
            idx = output_lower.find(f"### {header}")
            if idx == -1:
                idx = output_lower.find(f"## {header}")
            if idx != -1:
                section = output[idx:idx+500]
                lines = section.split('\n')[1:4]
                summary = ' '.join(line.strip() for line in lines if line.strip() and not line.startswith('#'))
                break

    if "real bug" in output_lower or "vulnerability is proven" in output_lower or "verified" in output_lower:
        return WorkerVerdict(
            worker=worker_name,
            verdict="approve" if reject_count == 0 else "concern",
            confidence=70 if approve_count > 3 else 50,
            summary=summary[:500],
            concerns=[],
            recommendations=[],
            raw_output=output,
            error="Inferred from text analysis",
        )

    if approve_count > reject_count and approve_count > concern_count:
        inferred, conf = "approve", min(60, 30 + approve_count * 5)
    elif reject_count > approve_count:
        inferred, conf = "reject", min(60, 30 + reject_count * 5)
    elif concern_count > 0:
        inferred, conf = "concern", min(60, 30 + concern_count * 3)
    else:
        inferred, conf = "neutral", 20

    if output.strip():
        return WorkerVerdict(
            worker=worker_name,
            verdict=inferred,
            confidence=conf,
            summary=summary[:500],
            concerns=[],
            recommendations=[],
            raw_output=output,
            error="Inferred from text analysis",
        )

    return WorkerVerdict(
        worker=worker_name,
        verdict="neutral",
        confidence=0,
        summary=f"Failed to parse. Stderr: {stderr[:200] if stderr else 'none'}",
        concerns=[],
        recommendations=[],
        raw_output=output,
        error="JSON parsing failed",
    )


def spawn_worker(worker_name: str, prompt: str, variant: str, bin_dir: Path, timeout: int) -> WorkerVerdict:
    """Spawn a cc-mirror variant worker and capture output."""
    import shutil

    # Handle both PATH commands (like 'claude') and bin_dir variants (like 'zai')
    if shutil.which(variant):
        wrapper_path = variant  # Use from PATH
    else:
        wrapper_path = str(bin_dir / variant)
        if not Path(wrapper_path).exists():
            return WorkerVerdict(
                worker=worker_name,
                verdict="neutral",
                confidence=0,
                summary=f"Variant '{variant}' not found",
                concerns=[],
                recommendations=[],
                raw_output="",
                error=f"Variant not found at {wrapper_path}",
            )

    try:
        env = os.environ.copy()
        env["CC_MIRROR_SPLASH"] = "0"

        # Use --dangerously-skip-permissions to allow tool use without prompts
        # Use --print for single-turn output
        result = subprocess.run(
            [str(wrapper_path), "--dangerously-skip-permissions", "--print", "-p", prompt],
            capture_output=True,
            text=True,
            timeout=timeout,
            env=env,
        )

        output = result.stdout
        stderr = result.stderr

        # Parse JSON from output - try multiple patterns
        # Pattern 1: JSON with nested arrays (most complex)
        json_match = re.search(
            r'\{\s*"verdict"\s*:\s*"[^"]+"\s*,\s*"confidence"\s*:\s*\d+.*?"recommendations"\s*:\s*\[.*?\]\s*\}',
            output,
            re.DOTALL
        )

        # Pattern 2: Simpler - find last JSON object with "verdict"
        if not json_match:
            # Find all potential JSON objects
            matches = list(re.finditer(r'\{[^{}]*"verdict"[^{}]*\}', output))
            if matches:
                json_match = matches[-1]  # Take the last one

        # Pattern 3: Most permissive - any JSON with verdict
        if not json_match:
            json_match = re.search(r'\{[^}]*"verdict"\s*:\s*"(approve|reject|concern|neutral)"[^}]*\}', output)

        if json_match:
            try:
                # Try to parse, might need cleanup
                json_str = json_match.group()
                # Fix common JSON issues
                json_str = re.sub(r',\s*}', '}', json_str)  # trailing comma
                json_str = re.sub(r',\s*]', ']', json_str)  # trailing comma in array

                data = json.loads(json_str)
                return WorkerVerdict(
                    worker=worker_name,
                    verdict=data.get("verdict", "neutral"),
                    confidence=data.get("confidence", 50),
                    summary=data.get("summary", ""),
                    concerns=data.get("concerns", []) if isinstance(data.get("concerns"), list) else [],
                    recommendations=data.get("recommendations", []) if isinstance(data.get("recommendations"), list) else [],
                    raw_output=output,
                )
            except json.JSONDecodeError as e:
                # Try extracting just the verdict
                verdict_match = re.search(r'"verdict"\s*:\s*"(approve|reject|concern|neutral)"', output)
                conf_match = re.search(r'"confidence"\s*:\s*(\d+)', output)
                summary_match = re.search(r'"summary"\s*:\s*"([^"]*)"', output)

                if verdict_match:
                    return WorkerVerdict(
                        worker=worker_name,
                        verdict=verdict_match.group(1),
                        confidence=int(conf_match.group(1)) if conf_match else 50,
                        summary=summary_match.group(1) if summary_match else "Partial parse - see raw output",
                        concerns=[],
                        recommendations=[],
                        raw_output=output,
                        error=f"Partial JSON parse: {e}",
                    )

        # Last resort - check if there's any indication of verdict in text
        for v in ["reject", "concern", "approve"]:
            if f'verdict": "{v}"' in output.lower() or f"verdict: {v}" in output.lower():
                return WorkerVerdict(
                    worker=worker_name,
                    verdict=v,
                    confidence=30,
                    summary="Extracted verdict from text - JSON malformed",
                    concerns=[],
                    recommendations=[],
                    raw_output=output,
                    error="Fallback text extraction",
                )

        # Smart fallback: analyze the text content to infer verdict
        output_lower = output.lower()

        # Look for strong signals in the text
        approve_signals = ["real bug", "vulnerability is proven", "verified", "confirmed", "correct", "✅", "valid finding"]
        reject_signals = ["not a bug", "invalid", "false positive", "incorrect", "doesn't exist", "no vulnerability"]
        concern_signals = ["concern", "issue", "problem", "discrepancy", "missing", "⚠️", "however", "but"]

        approve_count = sum(1 for s in approve_signals if s in output_lower)
        reject_count = sum(1 for s in reject_signals if s in output_lower)
        concern_count = sum(1 for s in concern_signals if s in output_lower)

        # Extract a summary from the text
        summary = "Analysis completed but no JSON verdict provided."

        # Try to find a summary section
        if "### " in output:
            # Look for conclusion/summary headers
            for header in ["conclusion", "summary", "core issue", "bottom line", "verdict"]:
                idx = output_lower.find(f"### {header}")
                if idx == -1:
                    idx = output_lower.find(f"## {header}")
                if idx != -1:
                    # Extract text after this header
                    section = output[idx:idx+500]
                    lines = section.split('\n')[1:4]  # Get next few lines
                    summary = ' '.join(line.strip() for line in lines if line.strip() and not line.startswith('#'))
                    break

        # If we found "real bug" or similar strong confirmation
        if "real bug" in output_lower or "vulnerability is proven" in output_lower or "verified" in output_lower:
            return WorkerVerdict(
                worker=worker_name,
                verdict="approve" if reject_count == 0 else "concern",
                confidence=70 if approve_count > 3 else 50,
                summary=summary[:500],
                concerns=[],
                recommendations=[],
                raw_output=output,
                error="Inferred from text analysis (no JSON)",
            )

        # Infer based on signal counts
        if approve_count > reject_count and approve_count > concern_count:
            inferred = "approve"
            conf = min(60, 30 + approve_count * 5)
        elif reject_count > approve_count:
            inferred = "reject"
            conf = min(60, 30 + reject_count * 5)
        elif concern_count > 0:
            inferred = "concern"
            conf = min(60, 30 + concern_count * 3)
        else:
            inferred = "neutral"
            conf = 20

        if output.strip():  # If there's any output, try to use it
            return WorkerVerdict(
                worker=worker_name,
                verdict=inferred,
                confidence=conf,
                summary=summary[:500],
                concerns=[],
                recommendations=[],
                raw_output=output,
                error="Inferred from text analysis (no JSON)",
            )

        return WorkerVerdict(
            worker=worker_name,
            verdict="neutral",
            confidence=0,
            summary=f"Failed to parse worker response. Stderr: {stderr[:200] if stderr else 'none'}",
            concerns=[],
            recommendations=[],
            raw_output=output,
            error="JSON parsing failed",
        )

    except subprocess.TimeoutExpired:
        return WorkerVerdict(
            worker=worker_name,
            verdict="neutral",
            confidence=0,
            summary="Worker timed out",
            concerns=[],
            recommendations=[],
            raw_output="",
            error="Timeout",
        )
    except Exception as e:
        return WorkerVerdict(
            worker=worker_name,
            verdict="neutral",
            confidence=0,
            summary=str(e),
            concerns=[],
            recommendations=[],
            raw_output="",
            error=str(e),
        )


def calculate_consensus(verdicts: list) -> Consensus:
    """Calculate consensus from multiple worker verdicts."""
    if not verdicts:
        return Consensus(
            final_verdict="mixed",
            confidence=0,
            agreement=0,
            summary="No worker verdicts available",
            all_concerns=[],
            all_recommendations=[],
        )

    counts = {"approve": 0, "reject": 0, "concern": 0, "neutral": 0}
    for v in verdicts:
        if v.verdict in counts:
            counts[v.verdict] += 1

    # Determine final verdict
    if counts["reject"] > 0 and counts["reject"] >= counts["approve"]:
        final_verdict = "reject"
    elif counts["approve"] > counts["concern"] + counts["reject"]:
        final_verdict = "approve"
    elif counts["concern"] > 0 or counts["reject"] > 0:
        final_verdict = "concern"
    else:
        final_verdict = "mixed"

    # Calculate agreement
    max_count = max(counts.values())
    agreement = round((max_count / len(verdicts)) * 100)

    # Calculate confidence
    avg_confidence = sum(v.confidence for v in verdicts) / len(verdicts)
    confidence = round(avg_confidence * (agreement / 100))

    # Aggregate concerns and recommendations
    all_concerns = list(set(c for v in verdicts for c in v.concerns))
    all_recommendations = list(set(r for v in verdicts for r in v.recommendations))

    # Summary
    parts = [f"{len(verdicts)} workers analyzed."]
    if agreement == 100:
        parts.append(f"Unanimous: {final_verdict.upper()}.")
    else:
        parts.append(f"{agreement}% agreement: {final_verdict.upper()}.")
    if all_concerns:
        parts.append(f"{len(all_concerns)} concern(s) raised.")

    return Consensus(
        final_verdict=final_verdict,
        confidence=confidence,
        agreement=agreement,
        summary=" ".join(parts),
        all_concerns=all_concerns,
        all_recommendations=all_recommendations,
    )


def synthesize_findings(question: str, verdicts: list, consensus: Consensus) -> str:
    """Generate a basic synthesis of worker findings (fallback when no AI synthesis)."""

    # Build synthesis narrative
    lines = []
    lines.append(f"{BOLD}Here's my synthesis:{RESET}\n")

    # What each worker found - show key insight, not full summary
    for v in verdicts:
        if v.verdict == "neutral" and v.confidence == 0:
            lines.append(f"  {BOLD}{v.worker.upper()}{RESET} couldn't complete analysis.")
        else:
            stance = {
                "approve": "validates the work",
                "reject": "found critical issues",
                "concern": "raised concerns",
                "neutral": "is uncertain"
            }.get(v.verdict, "responded")
            lines.append(f"  {BOLD}{v.worker.upper()}{RESET} {stance} ({v.confidence}%):")
            # Show first sentence or up to 300 chars
            summary = v.summary
            first_sentence = summary.split('. ')[0] + '.' if '. ' in summary else summary
            if len(first_sentence) > 300:
                first_sentence = first_sentence[:300] + "..."
            lines.append(f"    {first_sentence}")
            lines.append("")

    # Agreement analysis
    if consensus.agreement == 100:
        lines.append(f"  {BOLD}Consensus:{RESET} Both workers {consensus.final_verdict.upper()} - they agree.")
    elif consensus.agreement >= 50:
        lines.append(f"  {BOLD}Split verdict:{RESET} Workers disagree. Majority says {consensus.final_verdict.upper()}.")
    else:
        lines.append(f"  {BOLD}No consensus:{RESET} Workers have different views.")

    lines.append("")

    # Key issues (deduplicated, prioritized)
    if consensus.all_concerns:
        lines.append(f"  {BOLD}Key issues to address:{RESET}")
        # Show top 3 most important - full text
        for i, concern in enumerate(consensus.all_concerns[:3], 1):
            lines.append(f"    {i}. {concern}")
        if len(consensus.all_concerns) > 3:
            lines.append(f"    ... and {len(consensus.all_concerns) - 3} more (use --verbose to see all)")
        lines.append("")

    # Bottom line
    lines.append(f"  {BOLD}Bottom line:{RESET}")
    if consensus.final_verdict == "approve":
        lines.append(f"    {GREEN}You're good to go.{RESET} Workers validated your work.")
    elif consensus.final_verdict == "reject":
        lines.append(f"    {RED}Stop and fix.{RESET} Critical issues found that need addressing.")
        if consensus.all_recommendations:
            lines.append(f"\n  {BOLD}Priority fix:{RESET}")
            lines.append(f"    {consensus.all_recommendations[0]}")
    elif consensus.final_verdict == "concern":
        lines.append(f"    {YELLOW}Review needed.{RESET} The work is mostly solid but has gaps.")
        if consensus.all_recommendations:
            lines.append(f"\n  {BOLD}Top recommendation:{RESET}")
            lines.append(f"    {consensus.all_recommendations[0]}")
    else:
        lines.append(f"    {CYAN}Unclear.{RESET} Workers couldn't reach agreement - use your judgment.")

    return "\n".join(lines)


SYNTHESIS_PROMPT = """You are JARVIS - a brilliant AI synthesizer. You've just received analysis from multiple expert workers who investigated a coding session.

Your job: Create a clear, insightful synthesis that helps the human understand what was found.

## WORKER REPORTS
{worker_reports}

## ORIGINAL QUESTION/CONTEXT
{question}

## YOUR TASK
Synthesize the worker findings into a coherent narrative. Be like Jarvis from Iron Man - intelligent, direct, helpful.

Structure your response as:

1. **Executive Summary** (2-3 sentences) - What's the bottom line?

2. **What the Workers Found**
   - Summarize each worker's key finding in 1-2 sentences
   - Note where they agree and disagree

3. **Critical Issues** (if any)
   - List the most important problems found
   - Prioritize by severity

4. **My Assessment**
   - Your synthesized view combining all worker insights
   - What the human should do next

5. **Confidence Level**
   - How confident are you in this synthesis? (High/Medium/Low)
   - What would increase confidence?

Keep it concise but thorough. No fluff. Be direct like Jarvis."""


def run_opus_synthesis(verdicts: list, question: str, variant: str, bin_dir: Path, timeout: int = 120) -> Optional[str]:
    """Run Opus to synthesize worker findings into a Jarvis-style summary."""
    import shutil

    # Handle both PATH commands (like 'claude') and bin_dir variants
    if shutil.which(variant):
        wrapper_path = variant  # Use from PATH
    else:
        wrapper_path = str(bin_dir / variant)
        if not Path(wrapper_path).exists():
            return None

    # Build worker reports
    worker_reports = []
    for v in verdicts:
        report = f"""### {v.worker.upper()}
Verdict: {v.verdict.upper()} (Confidence: {v.confidence}%)
Summary: {v.summary}
Concerns: {', '.join(v.concerns) if v.concerns else 'None listed'}
Recommendations: {', '.join(v.recommendations) if v.recommendations else 'None listed'}

Raw Investigation Output:
{v.raw_output[:3000] if v.raw_output else 'No raw output'}
{'[truncated]' if v.raw_output and len(v.raw_output) > 3000 else ''}
"""
        worker_reports.append(report)

    prompt = SYNTHESIS_PROMPT.format(
        worker_reports="\n---\n".join(worker_reports),
        question=question if question else "General analysis of the coding session"
    )

    try:
        env = os.environ.copy()
        env["CC_MIRROR_SPLASH"] = "0"

        result = subprocess.run(
            [str(wrapper_path), "--dangerously-skip-permissions", "--print", "-p", prompt],
            capture_output=True,
            text=True,
            timeout=timeout,
            env=env,
        )

        output = result.stdout.strip()
        if output:
            # Clean any ANSI codes
            output = re.sub(r'\x1b\[[0-9;]*[mKHJ]', '', output)
            return output
        return None

    except Exception as e:
        print(f"{DIM}Synthesis error: {e}{RESET}")
        return None


def print_verdict(consensus: Consensus, verdicts: list, verbose: bool = False, debug: bool = False, as_json: bool = False, question: str = "", ai_synthesis: Optional[str] = None):
    """Print the verdict to console."""
    if as_json:
        output = {
            "consensus": {
                "final_verdict": consensus.final_verdict,
                "confidence": consensus.confidence,
                "agreement": consensus.agreement,
                "summary": consensus.summary,
                "concerns": consensus.all_concerns,
                "recommendations": consensus.all_recommendations,
            },
            "verdicts": [
                {
                    "worker": v.worker,
                    "verdict": v.verdict,
                    "confidence": v.confidence,
                    "summary": v.summary,
                    "concerns": v.concerns,
                    "recommendations": v.recommendations,
                }
                for v in verdicts
            ],
        }
        print(json.dumps(output, indent=2))
        return

    color = VERDICT_COLORS.get(consensus.final_verdict, GRAY)
    icon = VERDICT_ICONS.get(consensus.final_verdict, "?")

    print()
    print(f"{BOLD}╔══════════════════════════════════════════════════════════╗{RESET}")
    print(f"{BOLD}║                      JUDGE VERDICT                       ║{RESET}")
    print(f"{BOLD}╚══════════════════════════════════════════════════════════╝{RESET}")
    print()

    print(f"  {BOLD}Final Verdict:{RESET} {color}{icon} {consensus.final_verdict.upper()}{RESET}")
    print(f"  {BOLD}Confidence:{RESET}    {consensus.confidence}%")
    print(f"  {BOLD}Agreement:{RESET}     {consensus.agreement}%")
    print()

    print(f"{DIM}───────────────────── Worker Analysis ─────────────────────{RESET}")
    print()

    for v in verdicts:
        v_color = VERDICT_COLORS.get(v.verdict, GRAY)
        v_icon = VERDICT_ICONS.get(v.verdict, "?")

        print(f"  {v_color}{v_icon}{RESET} {BOLD}{v.worker.upper()}{RESET} — {v_color}{v.verdict}{RESET} ({v.confidence}%)")
        print(f"    {DIM}{v.summary}{RESET}")

        # Debug mode: always show raw output for failed parses
        if debug and (v.error or v.verdict == "neutral" and v.confidence == 0):
            print(f"\n    {RED}─── DEBUG: Parse Failed ───{RESET}")
            print(f"    {RED}Error: {v.error}{RESET}")
            print(f"    {RED}Raw output ({len(v.raw_output)} chars):{RESET}")
            print(f"    {DIM}{'='*50}{RESET}")
            # Show full raw output for debugging
            for line in v.raw_output.split('\n')[:100]:  # First 100 lines
                print(f"    {line}")
            if v.raw_output.count('\n') > 100:
                print(f"    {DIM}... [{v.raw_output.count(chr(10)) - 100} more lines]{RESET}")
            print(f"    {DIM}{'='*50}{RESET}")

        if verbose:
            # Show full investigation output
            if v.raw_output:
                print(f"\n    {CYAN}─── Investigation Chain ───{RESET}")
                # Show raw output (truncate if very long)
                raw = v.raw_output.strip()
                if len(raw) > 3000:
                    raw = raw[:1500] + f"\n\n    {DIM}... [truncated {len(raw) - 3000} chars] ...{RESET}\n\n" + raw[-1500:]
                for line in raw.split('\n'):
                    print(f"    {DIM}{line}{RESET}")
                print(f"    {CYAN}────────────────────────────{RESET}")

            if v.concerns:
                print(f"    {YELLOW}Concerns:{RESET}")
                for c in v.concerns:
                    print(f"      • {c}")

        print()

    # Only show detailed concerns/recommendations in verbose mode
    if verbose:
        if consensus.all_concerns:
            print(f"{DIM}─────────────────────── Concerns ──────────────────────────{RESET}")
            print()
            for c in consensus.all_concerns:
                print(f"  {YELLOW}•{RESET} {c}")
            print()

        if consensus.all_recommendations:
            print(f"{DIM}────────────────────── Recommendations ────────────────────{RESET}")
            print()
            for r in consensus.all_recommendations:
                print(f"  {CYAN}→{RESET} {r}")
            print()

    # Jarvis-style synthesis (always shown)
    print()
    if ai_synthesis:
        render_markdown(ai_synthesis, "JARVIS Synthesis")
    else:
        synthesis = synthesize_findings(question, verdicts, consensus)
        render_markdown(synthesis, "Summary")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Conductor Consensus - Multi-agent session analysis",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 judge.py "how does auth work?"     # Deep research
  python3 judge.py "review code quality"     # Code review
  python3 judge.py "find bugs"               # Bug hunting
  python3 judge.py --list                    # List sessions
  python3 judge.py --clean                   # Clean up sessions

What happens:
  1. Each model investigates independently (reads files, explores code)
  2. Claude (Opus) synthesizes all findings into JARVIS summary

Options:
  -m, --models        Models to use (default: auto-detect zai,minimax)
  --no-synthesis      Skip Opus synthesis (just raw model outputs)
  --list              List available sessions
  --clean             Clean up sessions (with confirmation)
  --clean-all         Clean ALL sessions without confirmation
        """,
    )

    parser.add_argument("question", nargs="*", default=[], help="Question to focus analysis on")
    parser.add_argument("--project", "-p", default=os.getcwd(), help="Project path (default: cwd)")
    parser.add_argument("--session", "-s", help="Specific session ID")
    parser.add_argument("--models", "-m", default="auto", help="Comma-separated models to use (default: auto-detect zai,minimax)")
    parser.add_argument("--synthesizer", default="auto", help="Synthesis model (default: claude)")
    parser.add_argument("--personality", action="store_true", help="Use personality prompts (skeptic/auditor) instead of general")
    parser.add_argument("--timeout", "-t", type=int, default=300, help="Worker timeout in seconds")
    parser.add_argument("--list", "-l", action="store_true", help="List available sessions")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--verbose", action="store_true", help="Show detailed output")
    parser.add_argument("--debug", action="store_true", help="Dump raw worker output (for debugging)")
    parser.add_argument("--live", action="store_true", help="Show live worker activity")
    parser.add_argument("--sequential", action="store_true", help="Run workers sequentially (default: parallel)")
    parser.add_argument("--no-synthesis", action="store_true", help="Skip Opus synthesis")
    parser.add_argument("--clean", action="store_true", help="Clean up sessions for this project")
    parser.add_argument("--clean-all", action="store_true", help="Clean ALL sessions without confirmation")
    parser.add_argument("--bin-dir", default=str(Path.home() / ".local" / "bin"), help="Variant bin directory")

    args = parser.parse_args()
    bin_dir = Path(args.bin_dir)

    # Auto-detect variants
    import shutil

    def find_variant(candidates: list) -> Optional[str]:
        """Find first available variant from candidates."""
        for v in candidates:
            if (bin_dir / v).exists():
                return v
        return None

    def command_exists(cmd: str) -> bool:
        """Check if a command exists in PATH."""
        return shutil.which(cmd) is not None

    # Find available models
    available_models = []
    for v in ["zai", "minimax"]:
        if find_variant([v]):
            available_models.append(v)

    # Fallback to claude if no cheap models
    if not available_models:
        if command_exists("claude"):
            available_models = ["claude"]
        else:
            print(f"{RED}Error:{RESET} No models found!")
            print(f"Create zai: npx cc-mirror quick --provider zai --name zai --api-key $Z_AI_API_KEY")
            print(f"Create minimax: npx cc-mirror quick --provider minimax --name minimax --api-key $MINIMAX_API_KEY")
            sys.exit(1)

    # Determine which models to use as workers
    if args.models == "auto":
        worker_models = available_models[:2]  # Use up to 2 models
    else:
        worker_models = [m.strip() for m in args.models.split(",") if m.strip()]
        # Validate models exist
        for m in worker_models:
            if not find_variant([m]) and not command_exists(m):
                print(f"{RED}Error:{RESET} Model '{m}' not found")
                sys.exit(1)

    # Each model IS the worker (no separate personality mapping)
    worker_variant_map = {m: m for m in worker_models}
    worker_variant = worker_models[0]  # For backward compat

    # Synthesis: always use 'claude' command (Opus)
    synth_variant = args.synthesizer
    if synth_variant == "auto":
        if command_exists("claude"):
            synth_variant = "claude"
        else:
            synth_variant = worker_variant
            if not args.json:
                print(f"{YELLOW}Note:{RESET} 'claude' command not found. Using {synth_variant} for synthesis.")

    if not args.json:
        print(f"{DIM}Models: {', '.join(worker_models)} | Synthesis: {synth_variant}{RESET}")

    # List mode
    if args.list:
        sessions = list_sessions(args.project)
        if not sessions:
            print(f"No sessions found for: {args.project}")
            return

        print(f"\nSessions for {args.project}:\n")
        for s in sessions[:20]:
            from datetime import datetime
            dt = datetime.fromtimestamp(s["modified"])
            size_kb = s["size"] / 1024
            print(f"  {s['id'][:8]}...  {dt.strftime('%Y-%m-%d %H:%M')}  ({size_kb:.1f} KB)")

        if len(sessions) > 20:
            print(f"  ... and {len(sessions) - 20} more")
        print()
        return

    # Clean mode - only delete small sessions (likely judge leftovers, not real work)
    if args.clean or args.clean_all:
        sessions_dir = get_sessions_dir(args.project)
        if not sessions_dir.exists():
            print(f"No sessions directory found for: {args.project}")
            return

        all_sessions = list_sessions(args.project, min_size=0)
        if not all_sessions:
            print(f"No sessions found for: {args.project}")
            return

        # Separate small sessions (likely judge) from large ones (likely real work)
        # 10KB threshold - real work sessions are usually much larger
        SMALL_THRESHOLD = 10 * 1024  # 10 KB
        small_sessions = [s for s in all_sessions if s["size"] < SMALL_THRESHOLD]
        large_sessions = [s for s in all_sessions if s["size"] >= SMALL_THRESHOLD]

        from datetime import datetime

        if large_sessions:
            print(f"\n{BOLD}Real work sessions (KEPT):{RESET}\n")
            for s in large_sessions:
                dt = datetime.fromtimestamp(s["modified"])
                size_kb = s["size"] / 1024
                print(f"  {GREEN}✓{RESET} {s['id'][:8]}...  {dt.strftime('%Y-%m-%d %H:%M')}  ({size_kb:.1f} KB)")

        if small_sessions:
            print(f"\n{BOLD}Small sessions (to delete):{RESET}\n")
            total_size = 0
            for s in small_sessions:
                dt = datetime.fromtimestamp(s["modified"])
                size_kb = s["size"] / 1024
                total_size += s["size"]
                print(f"  {RED}✗{RESET} {s['id'][:8]}...  {dt.strftime('%Y-%m-%d %H:%M')}  ({size_kb:.1f} KB)")

            print(f"\n  {BOLD}Total: {len(small_sessions)} small sessions, {total_size / 1024:.1f} KB{RESET}\n")

            if args.clean_all:
                confirm = True
            else:
                try:
                    response = input(f"Delete {len(small_sessions)} small sessions? [y/N]: ").strip().lower()
                    confirm = response in ("y", "yes")
                except (KeyboardInterrupt, EOFError):
                    print("\nCancelled.")
                    return

            if confirm:
                deleted = 0
                for s in small_sessions:
                    try:
                        s["path"].unlink()
                        deleted += 1
                    except Exception as e:
                        print(f"{RED}Failed to delete {s['id'][:8]}: {e}{RESET}")

                print(f"{GREEN}Deleted {deleted} small sessions. Real work sessions preserved.{RESET}")
            else:
                print("Cancelled.")
        else:
            print(f"\n{GREEN}No small sessions to clean up.{RESET}")
        return

    # Get session
    sessions = list_sessions(args.project)
    if not sessions:
        print(f"{RED}Error:{RESET} No sessions found for: {args.project}")
        print("Make sure you're in a directory where you've used Claude Code.")
        sys.exit(1)

    if args.session:
        session = next((s for s in sessions if s["id"].startswith(args.session)), None)
        if not session:
            print(f"{RED}Error:{RESET} Session not found: {args.session}")
            sys.exit(1)
    else:
        session = sessions[0]

    # Parse and extract context
    messages = parse_session(session["path"])
    if not messages:
        print(f"{RED}Error:{RESET} Session has no messages.")
        sys.exit(1)

    context = extract_context(messages)

    # Track existing sessions (so we can clean up new ones later)
    existing_session_ids = {s["id"] for s in sessions}
    analyzed_session_id = session["id"]

    # Progress
    if not args.json:
        print(f"{DIM}\nAnalyzing session {session['id'][:8]}...{RESET}")
        print(f"{DIM}Models: {', '.join(worker_models)}{RESET}")
        print(f"{DIM}Context: {len(messages)} messages{RESET}")
        if args.live:
            print(f"{DIM}Live mode enabled{RESET}")
        print()

    # Build prompt
    question = " ".join(args.question) if args.question else ""
    question_text = f"\nFOCUS: {question}" if question else ""

    # Choose prompt template
    if args.personality:
        # Use personality-based prompts (legacy mode)
        def get_prompt(model_name, idx):
            personalities = ["skeptic", "auditor"]
            p = personalities[idx % len(personalities)]
            return PERSONALITY_PROMPTS.get(p, GENERAL_PROMPT).format(context=context, question=question_text)
    else:
        # Use general prompt - let models be themselves
        def get_prompt(model_name, idx):
            return GENERAL_PROMPT.format(context=context, question=question_text)

    # Run workers with optional live display
    if args.live and not args.json:
        # Live display mode - show real-time activity
        display = LiveDisplay(worker_models)
        display.start()

        def run_worker_live(model_name, idx):
            prompt = get_prompt(model_name, idx)
            return spawn_worker_streaming(model_name, prompt, model_name, bin_dir, args.timeout, display)

        try:
            if args.sequential:
                verdicts = [run_worker_live(m, i) for i, m in enumerate(worker_models)]
            else:
                with ThreadPoolExecutor(max_workers=len(worker_models)) as executor:
                    futures = {executor.submit(run_worker_live, m, i): m for i, m in enumerate(worker_models)}
                    verdicts = []
                    for future in as_completed(futures):
                        verdicts.append(future.result())
        finally:
            display.stop()
    else:
        # Standard mode
        def run_worker(model_name, idx):
            prompt = get_prompt(model_name, idx)
            return spawn_worker(model_name, prompt, model_name, bin_dir, args.timeout)

        if args.sequential:
            verdicts = [run_worker(m, i) for i, m in enumerate(worker_models)]
        else:
            with ThreadPoolExecutor(max_workers=len(worker_models)) as executor:
                futures = {executor.submit(run_worker, m, i): m for i, m in enumerate(worker_models)}
                verdicts = []
                for future in as_completed(futures):
                    verdicts.append(future.result())

    # Sort by model order
    verdicts.sort(key=lambda v: worker_models.index(v.worker) if v.worker in worker_models else 999)

    # Calculate consensus
    consensus = calculate_consensus(verdicts)

    # AI Synthesis (always runs unless --no-synthesis)
    ai_synthesis = None
    if not args.no_synthesis and not args.json:
        # Check if synth_variant is available (either in PATH or bin_dir)
        synth_available = command_exists(synth_variant) or (bin_dir / synth_variant).exists()
        if synth_available:
            print(f"\n{CYAN}Running JARVIS synthesis via {synth_variant}...{RESET}")
            ai_synthesis = run_opus_synthesis(verdicts, question, synth_variant, bin_dir, timeout=180)
            if not ai_synthesis:
                print(f"{YELLOW}Warning: AI synthesis failed, falling back to basic synthesis{RESET}")
        else:
            print(f"{YELLOW}Warning: Synthesizer '{synth_variant}' not found{RESET}")

    # Output
    print_verdict(consensus, verdicts, verbose=args.verbose, debug=args.debug, as_json=args.json, question=question, ai_synthesis=ai_synthesis)

    # Auto-cleanup: Delete sessions created during this run (but keep the one we analyzed)
    if not args.json:
        new_sessions = list_sessions(args.project, min_size=0)
        sessions_to_delete = [
            s for s in new_sessions
            if s["id"] not in existing_session_ids and s["id"] != analyzed_session_id
        ]

        if sessions_to_delete:
            deleted = 0
            for s in sessions_to_delete:
                try:
                    s["path"].unlink()
                    deleted += 1
                except Exception:
                    pass

            if deleted > 0:
                print(f"{DIM}Cleaned up {deleted} judge session(s).{RESET}")


if __name__ == "__main__":
    main()
