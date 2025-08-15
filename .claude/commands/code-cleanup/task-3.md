# code-cleanup - Task 3

Execute task 3 for the code-cleanup specification.

## Task Description
Create bundle size analysis script in scripts/cleanup/analyze-bundles.ts

## Requirements Reference
**Requirements**: R3.1, R3.2

## Usage
```
/Task:3-code-cleanup
```

## Instructions

Execute with @spec-task-executor agent the following task: "Create bundle size analysis script in scripts/cleanup/analyze-bundles.ts"

```
Use the @spec-task-executor agent to implement task 3: "Create bundle size analysis script in scripts/cleanup/analyze-bundles.ts" for the code-cleanup specification and include all the below context.

# Steering Context
## Steering Documents Context

No steering documents found or all are empty.

# Specification Context
## Specification Context (Pre-loaded): code-cleanup

### Requirements
# Code Cleanup and Quality Improvement Requirements

## Overview
After completing all core feature implementations, perform comprehensive code cleanup to ensure production-ready code quality and maintainability.

## Scope
This specification covers post-implementation code quality improvements, linting rule restoration, and final code cleanup tasks that should be performed after all feature development is complete.

## Requirements

### 1. ESLint Rules Restoration
- **R1.1**: Restore strict ESLint unused variable rules by removing underscore prefix allowance
- **R1.2**: Fix all resulting unused variable violations with proper code cleanup
- **R1.3**: Ensure no legitimate unused variables remain after cleanup
- **R1.4**: Validate that all packages still build successfully after rule restoration

### 2. Code Quality Improvements
- **R2.1**: Remove any remaining `any` types and replace with proper TypeScript types
- **R2.2**: Eliminate dead code and unused imports across all packages
- **R2.3**: Ensure consistent code formatting across the entire codebase
- **R2.4**: Validate all function and variable names follow project conventions

### 3. Performance Optimization
- **R3.1**: Review and optimize bundle sizes for production builds
- **R3.2**: Eliminate unnecessary dependencies and imports
- **R3.3**: Optimize webpack and build configurations for production
- **R3.4**: Ensure optimal tree-shaking for all packages

### 4. Documentation Cleanup
- **R4.1**: Update all JSDoc comments to reflect final implementations
- **R4.2**: Remove any outdated TODO comments and replace with proper tracking
- **R4.3**: Ensure all public APIs have comprehensive documentation
- **R4.4**: Validate that README files are accurate and up-to-date

### 5. Final Validation
- **R5.1**: Run comprehensive linting across all packages
- **R5.2**: Ensure all TypeScript strict mode compliance
- **R5.3**: Validate cross-browser build compatibility
- **R5.4**: Confirm production build optimization and minification

## Success Criteria
- Zero ESLint errors or warnings across all packages
- All TypeScript compilation passes with strict mode enabled
- No unused variables, imports, or dead code remains
- All packages build successfully for production deployment
- Code quality metrics meet enterprise standards

---

### Design
# Code Cleanup and Quality Improvement Design

## Design Overview
This specification implements a comprehensive code cleanup and quality improvement process to be executed after all core features are implemented. The design ensures production-ready code quality through systematic ESLint rule restoration, dead code elimination, and final validation.

## Architecture

### 1. ESLint Rules Restoration Strategy
The temporary ESLint configuration that allows unused variables with underscore prefixes will be reverted to strict enforcement:

```typescript
// Current temporary rule (to be removed):
'@typescript-eslint/no-unused-vars': [
  'error',
  {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',
    destructuredArrayIgnorePattern: '^_',
  },
],

// Target rule (strict enforcement):
'@typescript-eslint/no-unused-vars': 'error'
```

### 2. Cleanup Process Phases

#### Phase 1: Pre-Cleanup Analysis
- Scan all packages for unused variables, imports, and functions
- Generate comprehensive cleanup report
- Identify false positives and legitimate unused items

#### Phase 2: Automated Cleanup
- Remove unused imports using automated tools
- Eliminate dead code and unreachable functions
- Clean up unnecessary type declarations

#### Phase 3: Manual Review and Cleanup
- Review and fix complex unused variable scenarios
- Ensure proper error handling and logging
- Validate business logic integrity

#### Phase 4: Rule Restoration and Validation
- Restore strict ESLint unused variable rules
- Run full linting and compilation validation
- Ensure all builds pass across browsers

### 3. Code Quality Validation Framework

#### Linting Standards
- Zero ESLint warnings or errors
- Full TypeScript strict mode compliance
- Consistent code formatting via Prettier

#### Build Validation
- All packages build successfully
- Production bundles are optimized
- Cross-browser compatibility maintained

#### Performance Validation
- Bundle size analysis and optimization
- Tree-shaking effectiveness verification
- Production build performance validation

## Implementation Strategy

### 1. Systematic Package-by-Package Cleanup
Process each package individually to maintain focused validation:

1. **packages/shared** - Foundation types and utilities
2. **packages/storage** - Storage and configuration systems  
3. **packages/azure-speech** - Azure integration services
4. **packages/meeting-detector** - Content detection services
5. **packages/meeting-processor** - Content processing services
6. **packages/meeting-core** - Core meeting functionality
7. **packages/ui** - UI component library
8. **packages/hmr** - Development utilities
9. **chrome-extension** - Extension infrastructure
10. **pages/** - Extension pages and interfaces

### 2. Validation Gates
Each cleanup phase must pass validation before proceeding:

- **Compilation Gate**: All TypeScript compilation passes
- **Linting Gate**: Zero ESLint errors/warnings
- **Build Gate**: All production builds succeed
- **Functionality Gate**: Core features remain operational

### 3. Rollback Strategy
If cleanup introduces breaking changes:

- Maintain git stash backups before each phase
- Document specific changes for rapid rollback
- Test core functionality after each major cleanup step

## Quality Metrics

### Before Cleanup (Current State)
- ESLint unused variable rules: Relaxed (underscore prefix allowed)
- Estimated unused variables: ~50+ across all packages
- Lint violations with strict rules: ~100+ potential issues

### After Cleanup (Target State)
- ESLint unused variable rules: Strict (no exceptions)
- Unused variables: 0
- Lint violations: 0
- Dead code: Eliminated
- Bundle size: Optimized

## Risk Mitigation

### 1. Breaking Changes Prevention
- Comprehensive testing after each cleanup phase
- Incremental cleanup with validation checkpoints
- Preserve all legitimate unused parameters (event handlers, etc.)

### 2. Development Workflow Protection
- Only execute after all feature development complete
- Coordinate with team to avoid merge conflicts
- Document all changes for future reference

### 3. Production Readiness Validation
- Cross-browser build testing
- Performance regression testing
- Functionality verification across all features

## Timeline and Dependencies

### Prerequisites
- All 9 core feature specifications completed (112 remaining tasks)
- Comprehensive testing suite operational
- CI/CD pipeline validation ready

### Execution Timeline
- **Phase 1**: Analysis and Planning (1-2 hours)
- **Phase 2**: Automated Cleanup (2-3 hours)  
- **Phase 3**: Manual Review (3-4 hours)
- **Phase 4**: Validation and Rule Restoration (1-2 hours)
- **Total**: 7-11 hours of focused cleanup work

This design ensures systematic, risk-mitigated code cleanup that maintains functionality while achieving enterprise-grade code quality standards.

**Note**: Specification documents have been pre-loaded. Do not use get-content to fetch them again.

## Task Details
- Task ID: 3
- Description: Create bundle size analysis script in scripts/cleanup/analyze-bundles.ts
- Requirements: R3.1, R3.2

## Instructions
- Implement ONLY task 3: "Create bundle size analysis script in scripts/cleanup/analyze-bundles.ts"
- Follow all project conventions and leverage existing code
- Mark the task as complete using: claude-code-spec-workflow get-tasks code-cleanup 3 --mode complete
- Provide a completion summary
```

## Task Completion
When the task is complete, mark it as done:
```bash
claude-code-spec-workflow get-tasks code-cleanup 3 --mode complete
```

## Next Steps
After task completion, you can:
- Execute the next task using /code-cleanup-task-[next-id]
- Check overall progress with /spec-status code-cleanup
