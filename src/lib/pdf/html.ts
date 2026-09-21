import { NOTO_SANS_KR_BOLD_BASE64 } from "./fonts/notoSansKRBold";
import { NOTO_SANS_KR_REGULAR_BASE64 } from "./fonts/notoSansKRRegular";

/** 사용자 입력값을 HTML에 그대로 꽂아 넣으므로 반드시 이스케이프한다. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 프로덕션(Vercel, @sparticuz/chromium-min)에서 한글 라벨이 전부 사라지는 문제가
// 있었다 — 서버리스 Linux 환경엔 한글 폰트가 아예 없어서 Hangul 글리프를 그릴 수
// 없었던 것(순수 영문/숫자는 살아남고 한글만 빠지는 증상으로 확인). 로컬(macOS)은
// Apple SD Gothic Neo가 있어서 몰랐던 것뿐. OS 폰트에 의존하지 않도록 Noto Sans KR을
// base64로 직접 임베드해서 완전히 자체 완결된 PDF를 만든다 — 로컬/프로덕션 어디서
// 렌더링하든 결과가 동일해진다. 사용자가 입력하는 현장명/직원명 등도 임의의 한글이
// 올 수 있어서 부분 서브셋이 아니라 전체 한글 음절을 포함한 폰트를 그대로 썼다.
const FONT_FACES = `
  @font-face {
    font-family: 'Noto Sans KR';
    font-weight: 400;
    src: url(data:font/woff2;base64,${NOTO_SANS_KR_REGULAR_BASE64}) format('woff2');
  }
  @font-face {
    font-family: 'Noto Sans KR';
    font-weight: 700;
    src: url(data:font/woff2;base64,${NOTO_SANS_KR_BOLD_BASE64}) format('woff2');
  }
`;

const STYLE = `
  ${FONT_FACES}
  * { box-sizing: border-box; }
  body {
    font-family: 'Noto Sans KR', sans-serif;
    color: #111;
    font-size: 12px;
    margin: 0;
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 24px 0 8px; }
  .muted { color: #666; }
  .company-logo { max-height: 40px; max-width: 200px; object-fit: contain; margin-bottom: 8px; display: block; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 12px; }
  th { background: #f5f5f5; font-weight: 700; }
  td.amount, th.amount { text-align: right; font-variant-numeric: tabular-nums; }
  .total-row td { font-weight: 700; border-top: 2px solid #111; }
  .site-info { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 24px; margin-bottom: 16px; }
  .site-info div span.label { color: #666; margin-right: 6px; }
  .final-amount { text-align: right; margin-top: 16px; padding-top: 12px; border-top: 2px solid #111; }
  .final-amount .amount { font-size: 22px; font-weight: 700; }
`;

export function wrapHtmlDocument(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}
