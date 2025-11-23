/**
 * Default EventBus Contract Test Runner
 *
 * Runs the shared contract test suite against the default EventBus implementation.
 *
 * @see tests/contract/event-bus.shared.test.ts
 * @see src/events/EventBus.ts
 */

import { describe } from '@jest/globals';
import { runEventBusContractTests } from './event-bus.shared.test';
import { EventBus } from '../../src/events/EventBus';

describe('DefaultEventBus Contract Compliance', () => {
  runEventBusContractTests(async () => {
    const eventBus = new EventBus();
    await eventBus.initialize();
    return eventBus;
  });
});
