---
id: Q001
status: complete
created: 2026-03-28T13:15:00Z
completed: 2026-03-28T13:20:00Z
---

# Quick Task: Fix Gemini Model Deprecation

## Description

Update deprecated Gemini model name from `gemini-1.5-flash` to `gemini-2.5-flash` in backend services.

## Context

UAT testing revealed that `models/gemini-1.5-flash` returns a 404 error from the v1beta API because Gemini 1.5 models have been deprecated and shut down as of 2026. The API now requires Gemini 2.x or 3.x models.

## Files to Update

1. `backend/src/services/gemini.ts:29` - Default model in GeminiClient constructor
2. `backend/src/services/differences.ts:46` - Default model in DifferencesExtractor constructor

## Changes Required

Replace all occurrences of `'gemini-1.5-flash'` with `'gemini-2.5-flash'`

## Success Criteria

- Both services use `gemini-2.5-flash` as default model
- Code compiles without errors
- Changes committed with descriptive message
