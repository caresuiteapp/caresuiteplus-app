import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Zoom Vercel install contract', () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>;
  };
  const npmrc = fs.readFileSync(path.resolve(process.cwd(), '.npmrc'), 'utf8');

  it('installs every Zoom Meeting SDK runtime peer explicitly', () => {
    expect(packageJson.dependencies).toMatchObject({
      '@zoom/meetingsdk': '^6.2.0',
      lodash: '4.18.1',
      'react-redux': '8.1.2',
      redux: '4.2.1',
      'redux-thunk': '2.4.2',
    });
  });

  it('allows Expo React 18.3.1 alongside Zoom SDK React 18.2 peer metadata', () => {
    expect(npmrc).toMatch(/^legacy-peer-deps=true$/m);
  });
});
