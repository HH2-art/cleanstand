import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // puppeteer-core와 @sparticuz/chromium-min은 __dirname 기준 상대경로로 자기
  // 에셋을 찾는다. Next의 번들러가 이걸 청크로 옮겨버리면 그 상대경로가 깨진다 —
  // serverExternalPackages로 등록해서 번들링하지 말고 node_modules에서 그대로
  // require하게 한다. (chromium-min은 바이너리를 번들하지 않고 런타임에 원격
  // pack.tar를 받아오므로 outputFileTracingIncludes는 필요 없다 — src/lib/pdf/renderPdf.ts 참고.)
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium-min"],
};

export default nextConfig;
