import candidacies from './candidacies.json';
import districts from './districts.json';
import elections from './elections.json';
import events from './events.json';
import people from './people.json';
import policies from './policies.json';
import sources from './sources.json';
import topics from './topics.json';

/** 內容版本；內容變更若影響存檔相容性，須同步更新。 */
export const CONTENT_VERSION = '0.4.0';

export const rawContent = {
  contentVersion: CONTENT_VERSION,
  elections,
  districts,
  people,
  candidacies,
  policies,
  sources,
  events,
  topics,
};
