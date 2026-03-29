# 🦉 Moodle OWL • AI & Development Guidelines (claud.md)

This document defines the strict coding standards for the Moodle OWL project. All teammates (human and AI) must adhere to these principles to ensure a maintainable, scalable, and professional codebase.

---

## 🏗️ 1. Architecture: Isolation & Modularity
- **No Spaghetti Code**: Logic must be isolated. Avoid deeply nested conditionals or long, procedural functions.
- **Service-Oriented**: Core logic (AI calls, file processing, audio synthesis) MUST live in `backend/services/`. Routers should only handle HTTP concerns and call services.
- **Single Responsibility**: Each function or class should do ONE thing well.

## 📏 2. File Size & Structure
- **Keep it Small**: Files should be kept small and focused. If a service exceeds 200-300 lines, it is a candidate for refactoring/splitting.
- **Clear Names**: Use descriptive, snake_case names for functions and variables that explain the *intent*.
- **Imports**: Organize imports logically. Group standard library, third-party, and local modules separately.

## 🧹 3. Clean Coding Standards
- **DRY (Don't Repeat Yourself)**: Shared utilities (PDF extraction, path joining) should live in `backend/utils.py` or `backend/config.py`.
- **KISS (Keep It Simple, Stupid)**: Favor readability over "clever" or overly complex code.
- **Type Hinting**: Always use Python type hints (`typing` module) for function signatures to improve clarity and catch errors early.

## 🪵 4. Error Handling & Logging
- **Consistent Catching**: Use `try/except` blocks around external API calls and file I/O.
- **Proactive Logging**: Use the centralized `logger` from `config.py`. 
    - `logger.info()` for startup and successful major steps.
    - `logger.error()` for failures with descriptive messages.
- **Fail Gracefully**: Return useful error messages to the client rather than letting the server crash.

## 🤖 5. Assistant Rules (Special Instructions)
- **Research First**: Always analyze the existing code before suggesting changes.
- **Isolate Changes**: When adding features, create new service files or modules if it helps maintain isolation.
- **Respect established patterns**: Look at `podcast_service.py` or `video_service.py` for how we handle multi-step AI workflows.

---

> "Clean code always looks like it was written by someone who cares." — Robert C. Martin
