# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow
- Default branch: `main` (for all repos in this project)
- One commit = one logical change
- Commit messages: short, one-line (if you need multiple lines, split into separate commits)
- Do not include Co-Authored-By in commits

# Core Development Philosophy

## KISS (Keep It Simple, Stupid)
Simplicity should be a key goal in design. Choose straightforward solutions over complex ones whenever possible. Simple solutions are easier to understand, maintain, and debug.

## YAGNI (You Aren't Gonna Need It)
Avoid building functionality on speculation. Implement features only when they are needed, not when you anticipate they might be useful in the future.

## DRY (Don't repeat yourself)
Every piece of knowledge must have a single, unambiguous, authoritative representation within a system

## Design Principles
- Dependency Inversion: High-level modules should not depend on low-level modules. Both should depend on abstractions.
- Open/Closed Principle: Software entities should be open for extension but closed for modification.
- Single Responsibility: Each function, class, and module should have one clear purpose.
- Fail Fast: Check for potential errors early and raise exceptions immediately when issues occur.

## Functional Programming Style
Prefer clean, pure functions where possible:
- **Pure functions**: Given the same input, always return the same output. No hidden dependencies.
- **Minimize side effects**: Isolate state changes. Separate computation from mutation.
- **Small, focused functions**: Each function does one thing well. Compose small functions into larger ones.
- **Explicit inputs/outputs**: All data a function needs comes through parameters. No reliance on hidden global state.
- **Early returns**: Reduce nesting with guard clauses. Handle edge cases first, then the main logic.
- **Immutability preference**: Avoid mutating data when possible. Create new values instead.
- **Use `view`/`pure` in Solidity**: Mark functions that don't modify state. Helps reasoning and gas optimization.

## EXAMPLES
- Quex examples are available at http://github.com/quex-tech/quex-v1-examples

## DOCUMENTATION
- Quex documentation is available at https://docs.quex.tech/ (sources at https://github.com/quex-tech/developer-docs) 

## TDD Workflow

### Agents

Three agents handle the red-green-refactor cycle:

- `@test-writer` - RED: writes failing tests from requirements
- `@implementer` - GREEN: writes minimal code to pass tests
- `@refactorer` - REFACTOR: improves code while tests stay green

### Workflow

For each feature or change:

```
1. RED:    @test-writer "<requirement>"
           → Must produce failing test before proceeding

2. GREEN:  @implementer
           → Must make test pass with minimal code

3. REFACTOR: @refactorer (optional but recommended)
           → Improve structure, tests must stay green

4. REPEAT from step 1 for next requirement
```

### Rules

- Never skip RED phase
- Never write implementation before failing test exists
- Never modify tests to make them pass
- Write minimal implementation that pass tests
- Each agent operates in isolation - no context sharing
- If GREEN fails repeatedly, return to RED to refine test

## Commands

- `/tdd <feature>` - Start full TDD cycle
- `/red <requirement>` - Write failing test only
- `/green` - Implement to pass current failing test
- `/refactor` - Improve current implementation

## Quality gates

Before any commit:
- All tests pass
- No skipped tests
- Coverage maintained or improved

## Project Overview
