/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  globalThis.fetch = jest.fn(async () => ({
    ok: false,
    status: 503,
    text: async () => 'offline in test',
  })) as jest.Mock;

  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(tree?.toJSON()).toBeTruthy();

  await ReactTestRenderer.act(async () => {
    tree?.unmount();
  });
}, 15000);
