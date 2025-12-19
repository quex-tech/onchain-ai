# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Core Development Philosophy

## KISS (Keep It Simple, Stupid)
Simplicity should be a key goal in design. Choose straightforward solutions over complex ones whenever possible. Simple solutions are easier to understand, maintain, and debug.

## YAGNI (You Aren't Gonna Need It)
Avoid building functionality on speculation. Implement features only when they are needed, not when you anticipate they might be useful in the future.

## DRY (Don't repeat yourself)
Every piece of knowledge must have a single, unambiguous, authoritative representation within a system

## TDD (Test-Driven Development)
Write tests first, then code to pass them. Red → Green → Refactor.

## Design Principles
- Dependency Inversion: High-level modules should not depend on low-level modules. Both should depend on abstractions.
- Open/Closed Principle: Software entities should be open for extension but closed for modification.
- Single Responsibility: Each function, class, and module should have one clear purpose.
- Fail Fast: Check for potential errors early and raise exceptions immediately when issues occur.

## Project Overview

Threshold-based monitoring service for Quex push-based oracle price feeds. Monitors prices for RBNT/USD, USDT/USD, USDC/USD, WETH/USD, WRBNT/USD, WBTC/USD, LQDX/USD pairs. When any price deviates from its previously pushed value beyond a configurable threshold (default 1%), triggers a batch update pushing all prices in a single request. Pair list and threshold are configurable.