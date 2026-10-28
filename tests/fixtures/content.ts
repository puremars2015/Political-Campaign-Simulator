import { validateContent } from '../../src/content/validate.ts';
import type { ContentBundle } from '../../src/content/schema.ts';
import { rawContent } from './content-data.ts';

export { rawContent as rawFixture };

export function loadFixture(): ContentBundle {
  const result = validateContent(rawContent);
  if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
  return result.bundle;
}
