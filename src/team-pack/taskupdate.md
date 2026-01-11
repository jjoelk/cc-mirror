<!--
name: 'Tool Description: TaskUpdate'
description: Description for the TaskUpdate tool (Team Mode version)
ccVersion: 2.0.72
-->

Use this tool to update a task in the task list.

## When to Use This Tool

**Mark tasks as resolved:**

- When you have completed the work described in a task
- When a task is no longer needed or has been superseded
- IMPORTANT: Always mark your assigned tasks as resolved when you finish them
- After resolving, call TaskList to find your next task

**Update task details:**

- When requirements change or become clearer
- When you need to add context via comments
- When establishing dependencies between tasks

## Fields You Can Update

- **status**: Set to 'resolved' when work is complete, or 'open' to reopen
- **subject**: Change the task title
- **description**: Change the task description
- **addComment**: Add a comment with {author, content} to track progress or decisions.
- **addReferences**: Link to related tasks (bidirectional)
- **addBlocks**: Mark tasks that cannot start until this one completes
- **addBlockedBy**: Mark tasks that must complete before this one can start

## Staleness

Make sure to read a task's latest state using `TaskGet` before updating it.

## Examples

Mark task as resolved after completing work:

```json
{ "taskId": "1", "status": "resolved" }
```

Add a progress comment:

```json
{ "taskId": "2", "addComment": { "author": "agent", "content": "Found the root cause, fixing now" } }
```

Mark resolved with a completion comment:

```json
{ "taskId": "3", "status": "resolved", "addComment": { "author": "agent", "content": "Implemented and tested" } }
```
