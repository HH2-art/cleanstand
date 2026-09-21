import "server-only";
import type { Browser as CoreBrowser } from "puppeteer-core";

// 실제 배포된 프로덕션 500 에러(Vercel 함수 로그)로 확인된 문제:
// @sparticuz/chromium(정식판)은 bin/에 브로틀리로 압축된 Chromium 바이너리를
// ~67MB 번들한다. Next의 정적 파일 트레이서(@vercel/nft)는 이 바이너리를 fs로
// 동적 탐색하는 코드를 감지 못해 배포 산출물에서 빠뜨리고, 런타임에
// "input directory .../bin does not exist" 에러로 죽는다. serverExternalPackages나
// outputFileTracingIncludes로도 못 잡았다 — Sparticuz 공식 문서가 Vercel처럼
// 배포 크기 제한이 있는 곳엔 아예 권장하는 해법(@sparticuz/chromium-min + 원격
// pack 다운로드)으로 바꿨다. chromium-min은 바이너리를 번들하지 않고, 콜드스타트 때
// GitHub Releases에서 pack.tar를 받아 /tmp에 풀어서 쓴다(웜스타트는 캐시 재사용).
const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.x64.tar";

/**
 * 서버사이드 HTML→PDF (사업계획 문서의 기술스택 결정 그대로).
 *
 * 로컬 개발(next dev, NODE_ENV=development)에서는 puppeteer(번들 Chromium 포함,
 * devDependency)를 그대로 쓴다. 프로덕션(Vercel 서버리스)에서는 puppeteer-core +
 * @sparticuz/chromium-min 조합을 쓴다. 두 브랜치 다 puppeteer-core의 Browser
 * 타입을 반환하므로 호출부(estimate/breakdown 라우트)는 어느 쪽이 쓰였는지
 * 신경 쓸 필요 없다.
 */
async function launchBrowser(): Promise<CoreBrowser> {
  if (process.env.NODE_ENV === "development") {
    const puppeteer = await import("puppeteer");
    return puppeteer.default.launch({ headless: true }) as unknown as Promise<CoreBrowser>;
  }

  const [{ default: chromium }, { default: puppeteerCore }] = await Promise.all([
    import("@sparticuz/chromium-min"),
    import("puppeteer-core"),
  ]);

  return puppeteerCore.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
    headless: true,
  });
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    // data: URI 폰트라 네트워크 요청은 없지만, CSS 폰트 적용은 load 이벤트와
    // 별도로 비동기다 — 임베드한 한글 폰트가 실제로 파싱/적용될 때까지 기다린 뒤
    // 인쇄한다. (안 기다리면 폰트 로딩이 늦게 끝나는 환경에서 글자가 다시 빠질 수 있다.)
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: "a4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "16mm", right: "16mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
