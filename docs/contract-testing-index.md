# Contract Testing for Storage Adapters - Documentation Index

## Overview

This directory contains comprehensive documentation for implementing contract testing for SmallTalk's storage adapters. The approach ensures all adapter implementations (FileSystem, Redis, InMemory, etc.) conform to the same interface contract with minimal boilerplate.

---

## Documentation Files

### 1. Quick Start Guide ⚡
**File**: [`contract-testing-quick-start.md`](/home/gyasis/Documents/code/smalltalk/docs/contract-testing-quick-start.md)

**For**: Developers who want to implement adapter tests immediately

**Contents**:
- TL;DR implementation steps
- Code templates ready to copy/paste
- Real-world examples
- Common troubleshooting
- 3-minute implementation guide

**Start here if**: You need to add tests for a new adapter right now.

---

### 2. Full Recommendation 📋
**File**: [`contract-testing-recommendation.md`](/home/gyasis/Documents/code/smalltalk/docs/contract-testing-recommendation.md)

**For**: Team leads, architects, and developers who want to understand the full approach

**Contents**:
- Complete recommendation with rationale
- Full contract test suite implementation (18 tests)
- Detailed usage examples for all adapter types
- Comparison with alternative approaches
- Best practices and guidelines
- Type safety features

**Start here if**: You're evaluating the approach or implementing it from scratch.

---

### 3. Architecture Diagrams 🎨
**File**: [`contract-testing-diagram.md`](/home/gyasis/Documents/code/smalltalk/docs/contract-testing-diagram.md)

**For**: Visual learners and team presentations

**Contents**:
- Pattern overview diagrams
- Test execution flow charts
- Adding new adapter workflow
- Contract compliance matrix
- Type safety flow visualization
- Error message examples

**Start here if**: You want to understand the architecture visually or present to team.

---

## Quick Navigation

### By Role

| Role | Start With | Then Read |
|------|------------|-----------|
| **Developer adding adapter** | Quick Start | (Optional) Recommendation |
| **Tech Lead reviewing approach** | Recommendation | Diagrams |
| **Team presenting approach** | Diagrams | Recommendation |
| **New team member** | Quick Start | Diagrams → Recommendation |

### By Task

| Task | Documentation |
|------|---------------|
| Implement new adapter tests | Quick Start → Templates |
| Understand why this approach | Recommendation → Comparison |
| Present to team | Diagrams → Benefits |
| Debug failing tests | Quick Start → Troubleshooting |
| Extend contract tests | Recommendation → Full test suite |
| Review architecture | Diagrams → Type Safety Flow |

---

## Implementation Phases

### Phase 1: Foundation (One Time)
1. Read: [Recommendation](/home/gyasis/Documents/code/smalltalk/docs/contract-testing-recommendation.md) → "Core Structure"
2. Create: `src/types/index.ts` → StorageAdapter interface
3. Create: `src/__tests__/contracts/StorageAdapterContract.ts`
4. Copy: Full contract test suite from recommendation

### Phase 2: Per Adapter
1. Read: [Quick Start](/home/gyasis/Documents/code/smalltalk/docs/contract-testing-quick-start.md) → "Adapter Test Template"
2. Create: `src/__tests__/adapters/[AdapterName].test.ts`
3. Copy: Template and customize factory/cleanup
4. Run: `npm test -- [AdapterName].test.ts`

### Phase 3: Verification
1. Review: [Diagrams](/home/gyasis/Documents/code/smalltalk/docs/contract-testing-diagram.md) → "Contract Compliance Matrix"
2. Verify: All adapters pass 18 contract tests
3. Add: Adapter-specific tests for unique features
4. Document: Any special setup requirements

---

## Key Concepts

### Shared Test Suite Pattern
One test suite, tested against multiple implementations using factory functions.

**Benefits**:
- Single source of truth for contract
- Minimal boilerplate per adapter
- Automatic contract updates for all adapters
- Type-safe with TypeScript

### Factory Pattern
Each adapter test provides a factory function that creates a configured instance.

**Example**:
```typescript
testStorageAdapterContract(
  'FileSystemAdapter',
  () => new FileSystemAdapter({ path: './test-data' }),
  () => { /* cleanup */ }
);
```

### Contract Tests
18 tests covering all StorageAdapter interface methods:
- Session Management (6 tests)
- Message Management (4 tests)
- Memory Management (5 tests)
- Error Handling (2 tests)
- Data Persistence (1 test)

---

## File Locations

```
smalltalk/
├── src/
│   ├── types/
│   │   └── index.ts                    # StorageAdapter interface
│   ├── adapters/
│   │   ├── FileSystemAdapter.ts        # Implementation
│   │   ├── RedisAdapter.ts             # Implementation
│   │   └── InMemoryAdapter.ts          # Implementation
│   └── __tests__/
│       ├── contracts/
│       │   └── StorageAdapterContract.ts  # Contract test suite
│       └── adapters/
│           ├── FileSystemAdapter.test.ts  # Contract + specific tests
│           ├── RedisAdapter.test.ts       # Contract + specific tests
│           └── InMemoryAdapter.test.ts    # Contract + specific tests
└── docs/
    ├── contract-testing-index.md          # This file
    ├── contract-testing-recommendation.md # Full documentation
    ├── contract-testing-diagram.md        # Visual diagrams
    └── contract-testing-quick-start.md    # Implementation guide
```

---

## Common Questions

### Q: How long does it take to add tests for a new adapter?
**A**: ~3 minutes using the Quick Start templates.

### Q: What if my adapter has unique features?
**A**: Add adapter-specific tests in the same file after the contract tests.

### Q: Can I modify the contract tests?
**A**: Yes! Edit `StorageAdapterContract.ts` and all adapters automatically use the updated tests.

### Q: Do I need to run all adapter tests every time?
**A**: No. Run specific adapter tests with `npm test -- [AdapterName].test.ts`

### Q: What if a contract test fails?
**A**: Jest will show exactly which method/assertion failed with clear error messages. See Diagrams → Error Message Quality.

### Q: Can I use this pattern for other contracts (not just storage)?
**A**: Absolutely! The pattern works for any interface contract. Just create a new contract test suite.

---

## Testing Commands Reference

```bash
# Run all adapter contract tests
npm test -- src/__tests__/adapters

# Run specific adapter
npm test -- FileSystemAdapter.test.ts

# Run only contract tests (no adapter-specific)
npm test -- StorageAdapterContract

# Watch mode for development
npm test -- --watch src/__tests__/adapters

# Coverage report
npm test -- --coverage src/__tests__/adapters

# Verbose output
npm test -- --verbose FileSystemAdapter.test.ts
```

---

## Success Metrics

After implementing contract testing, you should see:

✅ **Consistency**: All adapters pass the same 18 contract tests
✅ **Confidence**: New adapters automatically verified against contract
✅ **Speed**: New adapter tests added in ~3 minutes
✅ **Maintainability**: Contract updates apply to all adapters automatically
✅ **Clarity**: Clear error messages when contract violations occur
✅ **Type Safety**: TypeScript ensures compile-time contract compliance

---

## Additional Resources

- **Jest Documentation**: https://jestjs.io/docs/getting-started
- **TypeScript Generics**: https://www.typescriptlang.org/docs/handbook/2/generics.html
- **Contract Testing Pattern**: Used by Prisma, Socket.io, Winston, and other major projects

---

## Support

If you encounter issues:

1. **Check Troubleshooting**: [Quick Start](/home/gyasis/Documents/code/smalltalk/docs/contract-testing-quick-start.md) → Troubleshooting section
2. **Review Examples**: [Recommendation](/home/gyasis/Documents/code/smalltalk/docs/contract-testing-recommendation.md) → Usage Examples
3. **Verify Setup**: [Diagrams](/home/gyasis/Documents/code/smalltalk/docs/contract-testing-diagram.md) → Test Execution Flow

---

## Document Versions

- **contract-testing-recommendation.md**: 22KB - Comprehensive guide with full implementation
- **contract-testing-diagram.md**: 18KB - Visual architecture and flows
- **contract-testing-quick-start.md**: 14KB - Rapid implementation templates
- **contract-testing-index.md**: This file - Navigation and overview

**Last Updated**: 2025-11-23
**Status**: Ready for implementation
**Recommended Reading Order**: Quick Start → Diagrams → Recommendation
