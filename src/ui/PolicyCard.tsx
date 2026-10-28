import type { Citation, ContentBundle, Policy, PolicyField } from '../content/schema.ts';
import { LOCATOR_LABELS, VERIFICATION_LABELS } from './labels.ts';

const FIELD_LABELS: Record<keyof Policy['fields'], string> = {
  tool: '政策工具',
  scale: '規模',
  funding: '財源',
  deadline: '期限',
};

export function CitationList({ content, citations }: { content: ContentBundle; citations: readonly Citation[] }) {
  return (
    <ul className="citations">
      {citations.map((citation, i) => {
        const source = content.sources.find((s) => s.id === citation.sourceId);
        return (
          <li key={`${citation.sourceId}-${i}`}>
            <blockquote>「{citation.quote}」</blockquote>
            {source ? (
              <p className="cost">
                <a href={source.url} target="_blank" rel="noreferrer noopener">
                  {source.title}
                </a>
                ・{source.publisher}
                {source.publishedAt && `・${source.publishedAt}`}・{LOCATOR_LABELS[citation.locator.kind]}：
                {citation.locator.value}・{VERIFICATION_LABELS[source.verification]}
                {source.archiveUrl && (
                  <>
                    ・
                    <a href={source.archiveUrl} target="_blank" rel="noreferrer noopener">
                      存檔
                    </a>
                  </>
                )}
              </p>
            ) : (
              <p className="cost">找不到來源資料</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function FieldValue({ field }: { field: PolicyField }) {
  return field.stated === null ? <span className="unknown">來源未說明</span> : <span>{field.stated}</span>;
}

/** 唯讀政見卡：摘要、欄位與可展開的原文來源（計畫 8.3） */
export function PolicyCard({ content, policy }: { content: ContentBundle; policy: Policy }) {
  const fieldCitations = Object.values(policy.fields).flatMap((f) => (f.stated === null ? [] : [f.citation]));
  return (
    <article className="policy">
      <p className="eyebrow">{policy.issue}</p>
      <p>{policy.summary}</p>
      <dl className="policy-fields">
        {(Object.keys(FIELD_LABELS) as (keyof Policy['fields'])[]).map((key) => (
          <div key={key}>
            <dt>{FIELD_LABELS[key]}</dt>
            <dd>
              <FieldValue field={policy.fields[key]} />
            </dd>
          </div>
        ))}
      </dl>
      <details>
        <summary>查看原文與來源</summary>
        <CitationList content={content} citations={[...policy.citations, ...fieldCitations]} />
      </details>
    </article>
  );
}
