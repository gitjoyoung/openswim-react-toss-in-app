import { openExternal } from "../lib/mapLinks";
import { parseRichText } from "../lib/richText";
import { brand } from "../design/tokens";

// DB에 저장한 문구를 그린다. 문구 안의 마크다운 링크만 <a> 로 바꾼다.
// 링크 주소가 없거나 http(s) 가 아니면 파서가 글자만 남기므로 여기서는 따로 거르지 않는다.
export default function RichText({ text }: { text: string }) {
  return (
    <>
      {parseRichText(text).map((segment, index) =>
        segment.href ? (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => {
              event.preventDefault();
              void openExternal(segment.href);
            }}
            style={{
              color: brand.main,
              fontWeight: 600,
              textDecoration: "underline",
            }}
          >
            {segment.text}
          </a>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
