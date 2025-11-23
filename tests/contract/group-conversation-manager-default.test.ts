/**
 * Default GroupConversationManager Contract Test Runner
 *
 * Runs the shared contract test suite against the default GroupConversationManager implementation.
 *
 * @see tests/contract/group-conversation-manager.shared.test.ts
 * @see src/group/GroupConversationManager.ts
 */

import { describe } from '@jest/globals';
import { runGroupConversationManagerContractTests } from './group-conversation-manager.shared.test';
import { GroupConversationManager } from '../../src/group/GroupConversationManagerAdapter';

describe('DefaultGroupConversationManager Contract Compliance', () => {
  runGroupConversationManagerContractTests(() => {
    return new GroupConversationManager();
  });
});
