/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  jest.useFakeTimers();
  globalThis.fetch = jest.fn(async () => ({
    ok: false,
    status: 503,
    text: async () => 'offline in test',
  })) as jest.Mock;

  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
    await Promise.resolve();
  });

  await ReactTestRenderer.act(async () => {
    tree?.unmount();
  });
  jest.clearAllTimers();
  jest.useRealTimers();
});
