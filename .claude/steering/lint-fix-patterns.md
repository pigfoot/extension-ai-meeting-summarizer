# Lint Fix Patterns

This document provides standard patterns for fixing common lint errors in the codebase.

## Function Declaration Style

### Pattern: Convert function declarations to arrow functions

**ESLint Rule**: Prefer consistent function style (usually arrow functions)

**Before:**
```typescript
function extractMeetingMetadata(): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    title: document.title,
    url: window.location.href,
  };
  return metadata;
}
```

**After:**
```typescript
const extractMeetingMetadata = (): Record<string, unknown> => {
  const metadata: Record<string, unknown> = {
    title: document.title,
    url: window.location.href,
  };
  return metadata;
};
```

**Key changes:**
- Replace `function functionName()` with `const functionName = ()`
- Add `=>` after parameter list
- Add semicolon after closing brace

## Unused Parameters

### Pattern: Prefix unused parameters with underscore

**ESLint Rule**: `@typescript-eslint/no-unused-vars`

**Before:**
```typescript
private handleLayoutChange(change: { type: string; target?: Element }): void {
  // TODO: Implement layout change handling
}
```

**After:**
```typescript
private handleLayoutChange(_change: { type: string; target?: Element }): void {
  // TODO: Implement layout change handling
}
```

## Unused Variables/Imports

### Pattern: Prefix with underscore or remove

**ESLint Rule**: `@typescript-eslint/no-unused-vars`

**Option 1 - Prefix with underscore:**
```typescript
const _unusedVariable = getValue();
```

**Option 2 - Remove if truly unused:**
```typescript
// Remove the unused import/variable entirely
```

## React Hooks Dependencies

### Pattern: Wrap objects in useMemo() to prevent re-renders

**ESLint Rule**: `react-hooks/exhaustive-deps`

**Before:**
```typescript
const actions: PopupStateActions = {
  updateJobs: useCallback((jobs: JobDisplayInfo[]) => {
    setState(prev => ({ ...prev, activeJobs: jobs }));
  }, []),
  // ... other actions
};
```

**After:**
```typescript
const actions: PopupStateActions = useMemo(
  () => ({
    updateJobs: (jobs: JobDisplayInfo[]) => {
      setState(prev => ({ ...prev, activeJobs: jobs }));
    },
    // ... other actions
  }),
  [loadInitialData, onError], // Add all dependencies
);
```

## Prettier Formatting

### Pattern: Fix missing punctuation

**Common issues:**
- Missing commas in function parameters
- Missing semicolons at end of statements

**Before:**
```typescript
const handleContentDetection = async (
  message: { type: string; tabId?: number; url?: string },
  sender: chrome.runtime.MessageSender,        // Missing comma
  sendResponse: (response: unknown) => void
) => {
  // function body
}  // Missing semicolon
```

**After:**
```typescript
const handleContentDetection = async (
  message: { type: string; tabId?: number; url?: string },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,   // Added comma
) => {
  // function body
};  // Added semicolon
```

## Environment Variables

### Pattern: Use IS_DEV instead of process.env.NODE_ENV

**Before:**
```typescript
if (process.env.NODE_ENV === 'development') {
  // debug code
}
```

**After:**
```typescript
import { IS_DEV } from '@extension/env';

if (IS_DEV) {
  // debug code
}
```

## Auto-Fix Commands

For automatic fixes, use:

```bash
# Fix formatting issues
pnpm run format

# Fix linting issues automatically
pnpm run lint --fix

# Or for specific packages
cd packages/specific-package && pnpm run lint --fix
```

## Systematic Approach

1. **Run linter first** to identify all issues
2. **Group similar errors** (formatting, unused vars, function style, etc.)
3. **Apply patterns consistently** across the codebase
4. **Verify fixes** by running lint again
5. **Commit changes** with descriptive message

## Priority Order

When fixing multiple lint errors:

1. **Prettier/formatting errors** (automatic fix)
2. **Function declaration style** (convert to arrow functions)
3. **Unused variables/parameters** (prefix with underscore)
4. **Type annotations** (replace `any` with specific types)
5. **React hooks dependencies** (add to dependency arrays or use useMemo)

This systematic approach ensures consistent code style and reduces lint errors efficiently.