// DB에 저장한 문구 안의 링크를 처리한다.
//
// 문구를 배포 없이 고치려고 DB(app_texts)에 넣었는데, 링크 위치를 별도 컬럼으로 들고 있으면
// 문구를 고치는 사람이 링크가 어디 걸리는지 알 수 없다. 그래서 문장 안에 마크다운 링크로 적는다.
//
//   [해당 수영장 정보]({source})를 {date} 확인하였습니다.
//
// 지원하는 것은 인라인 링크 하나뿐이다. 볼드·리스트 같은 나머지 마크다운은 처리하지 않는다.
// 문구에 쓸 일이 없고, 파서가 커지면 DB 텍스트가 곧 코드가 된다.
export type RichTextSegment = { text: string; href: string | null };

const LINK = /\[([^\]\n]*)\]\(([^)\s]*)\)/g;

// http(s) 만 링크로 만든다. DB 값이 그대로 href 가 되므로 javascript: 같은 스킴을 막는다.
function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

export function parseRichText(input: string): RichTextSegment[] {
  const segments: RichTextSegment[] = [];
  let cursor = 0;

  for (const match of input.matchAll(LINK)) {
    const [whole, label, url] = match;
    const at = match.index ?? 0;
    if (at > cursor) segments.push({ text: input.slice(cursor, at), href: null });

    const href = safeHref(url);
    // 링크로 만들 수 없으면(주소가 비었거나 http 가 아니면) 표시 글자만 남긴다.
    // 수영장에 근거 URL 이 없을 때 {source} 가 빈 문자열로 치환되는 경우가 여기다.
    if (label && href) segments.push({ text: label, href });
    else if (label) segments.push({ text: label, href: null });
    else if (!href) segments.push({ text: whole, href: null });

    cursor = at + whole.length;
  }

  if (cursor < input.length) segments.push({ text: input.slice(cursor), href: null });
  return segments.filter((segment) => segment.text.length > 0);
}

// 문구 안의 치환자를 채운다. 값이 없으면 빈 문자열로 지운다.
export function fillTemplate(template: string, values: Record<string, string | null>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? (values[key] ?? "") : whole,
  );
}
