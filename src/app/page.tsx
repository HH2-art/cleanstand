import Link from "next/link";
import "@/styles/app-shell.css";
// home.css가 dashboard.css/productivity.css/new-quote.css보다 먼저 로드돼야 한다:
// 히어로 미니 프리뷰(.dash-preview-frame)와 "어떻게 사용하나요?" 스텝 프리뷰(.hiw-panel)는
// 전부 .home-page 안에 .dashboard-page/.productivity-page/.quotes-new-page를 중첩해서
// 두 스코프가 동시에 걸린다 — .btn/.badge*/.card/.section-head 처럼 여러 파일이 같은
// 이름을 정의하는 클래스는 동일 우선순위에서 "나중에 로드된 쪽이 이긴다"는 CSS 캐스케이드
// 규칙을 탄다. 이 세 파일을 home.css보다 나중에 로드해야 각 프리뷰 안에서는 실제 그
// 화면의 값이, 그 밖(예: 4번 섹션의 뱃지)에서는 home.css 값이 각각 맞게 적용된다 —
// 세 파일의 모든 선택자는 각자의 스코프 클래스로 스코프돼 있어(전역으로 새는 규칙 없음,
// 직접 확인함) 그 밖의 홈페이지 요소에는 애초에 영향을 주지 않는다. 세 파일 사이의
// 순서는 서로 무관하다 — 서로 다른 스코프 클래스를 쓰기 때문에 셋이 동시에 DOM에 있어도
// 서로 충돌하지 않는다.
import "./home.css";
import "@/app/dashboard/dashboard.css";
import "@/app/settings/productivity/productivity.css";
import "@/app/quotes/new/new-quote.css";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/company";
import {
  RevealOnScroll,
  HomeNav,
  DashboardPreview,
  HowItWorksPreview,
  QuoteMetricCard,
  type DashboardPreviewSnapshot,
} from "@/components/home/Interactive";

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const BENEFITS = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
    title: "시간 단축",
    desc: "복잡한 계산과 문서 작업을 자동화하여 견적 시간을 최대 70% 절감합니다.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z" />
      </svg>
    ),
    title: "실수 방지",
    desc: "공식 누락, 계산 오류 등 사람이 놓치기 쉬운 부분을 자동으로 검수합니다.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3v4a1 1 0 0 0 1 1h4" />
        <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
      </svg>
    ),
    title: "전문성 강화",
    desc: "복잡한 계산 공식과 법정 기준을 외우지 않아도, 전문가 수준의 견적서를 만들 수 있습니다.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
      </svg>
    ),
    title: "누적 데이터 활용",
    desc: "이전 견적 내역을 저장하고 참고하여, 다음 견적을 더 빠르고 정확하게 작성할 수 있습니다.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
      </svg>
    ),
    title: "지난 견적 참고",
    desc: "같은 건물유형의 과거 견적을 불러와, 더 빠르게 새 견적을 작성할 수 있습니다.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="6" x2="20" y2="6" />
        <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
        <line x1="4" y1="18" x2="20" y2="18" />
        <circle cx="7" cy="18" r="2" fill="currentColor" stroke="none" />
      </svg>
    ),
    title: "회사 맞춤 설정",
    desc: "요율, 생산성 기준, 직원 단가까지 전부 회사 사정에 맞게 커스터마이징할 수 있습니다.",
  },
];

const PROMISES = [
  { keyword: "더 빠르게", desc: "반복되는 계산을 직접 하지 않아도 됩니다." },
  { keyword: "더 정확하게", desc: "인원·노무비·경비 계산을 일관된 기준으로 처리합니다." },
  { keyword: "더 깔끔하게", desc: "계산한 내용을 바로 견적서로 정리할 수 있습니다." },
];

/** 히어로 미니 대시보드 프리뷰용 정적 스냅샷 — 실제 쿼리 없이 5.5초 간격으로 순환. */
/** 히어로 미니 대시보드 프리뷰용 정적 스냅샷 — DashboardContent/AppSidebar가 실제로
 * 받는 것과 동일한 shape(DashboardQuoteRow/DashboardActivityRow)의 목업 데이터.
 * 실제 쿼리 없이 5.5초 간격으로 3세트가 순환한다. */
const DASH_SNAPSHOTS: DashboardPreviewSnapshot[] = [
  {
    currentMonthKey: "2026-09",
    prevMonthKey: "2026-08",
    quotes: [
      { id: "p1-1", name: "강남 A오피스빌딩", buildingType: "오피스", area: 12500, mode: "private", status: "sent", amount: 6200000, date: "2026.09.18", monthKey: "2026-09" },
      { id: "p1-2", name: "분당 종합병원", buildingType: "병원", area: 15000, mode: "public", status: "won", amount: 13980340, date: "2026.09.15", monthKey: "2026-09" },
      { id: "p1-3", name: "수원 물류센터", buildingType: "공장", area: 22000, mode: "private", status: "draft", amount: 7623242, date: "2026.09.10", monthKey: "2026-09" },
      { id: "p1-4", name: "여의도 IT타워", buildingType: "오피스", area: 8200, mode: "private", status: "won", amount: 6450000, date: "2026.09.05", monthKey: "2026-09" },
      { id: "p1-5", name: "대전 고등학교", buildingType: "학교", area: 9600, mode: "public", status: "lost", amount: 7800000, date: "2026.09.02", monthKey: "2026-09" },
      { id: "p1-6", name: "인천 상가빌딩", buildingType: "상가", area: 5400, mode: "private", status: "sent", amount: 3120000, date: "2026.08.27", monthKey: "2026-08" },
      { id: "p1-7", name: "서울 화장품공장", buildingType: "공장", area: 18000, mode: "private", status: "won", amount: 9800000, date: "2026.08.20", monthKey: "2026-08" },
    ],
    activity: [
      { description: "강남 A오피스빌딩 견적을 발송했습니다.", time: "9월 18일 10:24" },
      { description: "분당 종합병원 견적이 수주 확정되었습니다.", time: "9월 15일 16:02" },
      { description: "여의도 IT타워 견적이 수주 확정되었습니다.", time: "9월 5일 09:41" },
      { description: "대전 고등학교 견적이 반려되었습니다.", time: "9월 2일 14:18" },
    ],
  },
  {
    currentMonthKey: "2026-09",
    prevMonthKey: "2026-08",
    quotes: [
      { id: "p2-1", name: "마포 스튜디오빌딩", buildingType: "오피스", area: 6800, mode: "private", status: "won", amount: 4150000, date: "2026.09.20", monthKey: "2026-09" },
      { id: "p2-2", name: "일산 요양병원", buildingType: "병원", area: 11200, mode: "public", status: "sent", amount: 10230000, date: "2026.09.19", monthKey: "2026-09" },
      { id: "p2-3", name: "김포 물류창고", buildingType: "공장", area: 26000, mode: "private", status: "won", amount: 12480000, date: "2026.09.17", monthKey: "2026-09" },
      { id: "p2-4", name: "송파 쇼핑몰", buildingType: "상가", area: 9400, mode: "private", status: "sent", amount: 5760000, date: "2026.09.14", monthKey: "2026-09" },
      { id: "p2-5", name: "성남 중학교", buildingType: "학교", area: 8100, mode: "public", status: "won", amount: 6390000, date: "2026.09.11", monthKey: "2026-09" },
      { id: "p2-6", name: "노원 오피스타운", buildingType: "오피스", area: 14300, mode: "private", status: "won", amount: 8020000, date: "2026.09.08", monthKey: "2026-09" },
      { id: "p2-7", name: "용인 데이터센터", buildingType: "기타", area: 9000, mode: "public", status: "draft", amount: 7100000, date: "2026.09.04", monthKey: "2026-09" },
      { id: "p2-8", name: "안양 편집샵", buildingType: "상가", area: 3200, mode: "private", status: "lost", amount: 1980000, date: "2026.08.29", monthKey: "2026-08" },
    ],
    activity: [
      { description: "마포 스튜디오빌딩 견적이 수주 확정되었습니다.", time: "9월 20일 11:03" },
      { description: "김포 물류창고 견적이 수주 확정되었습니다.", time: "9월 17일 15:47" },
      { description: "성남 중학교 견적이 수주 확정되었습니다.", time: "9월 11일 09:12" },
      { description: "용인 데이터센터 견적을 임시저장했습니다.", time: "9월 4일 17:30" },
    ],
  },
  {
    currentMonthKey: "2026-09",
    prevMonthKey: "2026-08",
    quotes: [
      { id: "p3-1", name: "홍대 상가건물", buildingType: "상가", area: 4100, mode: "private", status: "sent", amount: 2340000, date: "2026.09.21", monthKey: "2026-09" },
      { id: "p3-2", name: "잠실 초등학교", buildingType: "학교", area: 7600, mode: "public", status: "draft", amount: 5480000, date: "2026.09.16", monthKey: "2026-09" },
      { id: "p3-3", name: "구로 제조공장", buildingType: "공장", area: 19500, mode: "private", status: "won", amount: 9260000, date: "2026.09.09", monthKey: "2026-09" },
      { id: "p3-4", name: "종로 치과병원", buildingType: "병원", area: 2200, mode: "private", status: "lost", amount: 1540000, date: "2026.09.03", monthKey: "2026-09" },
      { id: "p3-5", name: "강서 오피스빌딩", buildingType: "오피스", area: 10800, mode: "private", status: "won", amount: 6870000, date: "2026.08.26", monthKey: "2026-08" },
      { id: "p3-6", name: "부천 상가건물", buildingType: "상가", area: 5000, mode: "private", status: "won", amount: 3210000, date: "2026.08.19", monthKey: "2026-08" },
    ],
    activity: [
      { description: "홍대 상가건물 견적을 발송했습니다.", time: "9월 21일 13:55" },
      { description: "구로 제조공장 견적이 수주 확정되었습니다.", time: "9월 9일 10:20" },
      { description: "종로 치과병원 견적이 반려되었습니다.", time: "9월 3일 16:44" },
    ],
  },
];

const RECENT_QUOTES = [
  { no: "Q-2026-014", site: "여의도 IT타워", type: "오피스 일반청소", area: "8,200㎡", mode: "민간", amount: "6,450,000원", status: "발송완료", statusCls: "badge-brand", modeCls: "badge-mode-private", date: "2026.09.12" },
  { no: "Q-2026-013", site: "분당 종합병원", type: "병원", area: "15,000㎡", mode: "공공", amount: "18,900,000원", status: "수주성공", statusCls: "badge-success", modeCls: "badge-mode-public", date: "2026.09.08" },
  { no: "Q-2026-012", site: "수원 물류센터", type: "공장", area: "22,000㎡", mode: "민간", amount: "11,200,000원", status: "임시저장", statusCls: "badge-neutral", modeCls: "badge-mode-private", date: "2026.09.05" },
  { no: "Q-2026-011", site: "대전 고등학교", type: "학교", area: "9,600㎡", mode: "공공", amount: "7,800,000원", status: "수주성공", statusCls: "badge-success", modeCls: "badge-mode-public", date: "2026.08.29" },
];

const FAQS = [
  { q: "정말 무료인가요?", a: "네, 현재는 무료로 이용하실 수 있습니다." },
  {
    q: "공공입찰 견적이랑 일반 견적 둘 다 낼 수 있나요?",
    a: "네, 모드 전환으로 공공입찰용(법정 상한 자동 적용)과 일반 민간 견적을 각각 계산할 수 있습니다.",
  },
  {
    q: "우리 회사 사정에 맞게 계산 기준을 바꿀 수 있나요?",
    a: "네, 직원 시급과 업무별 생산성 기준(㎡/시간)을 회사에 맞게 직접 설정할 수 있고, 기본 요율(관리비·이윤율)도 회사별로 조정 가능합니다.",
  },
  {
    q: "견적서는 어떤 형태로 받아볼 수 있나요?",
    a: "견적서와 산출내역서, 2종류의 PDF로 바로 생성·다운로드하실 수 있습니다.",
  },
  {
    q: "직원 여러 명이 같이 쓸 수 있나요?",
    a: "네, 하나의 계정으로 여러 명이 함께 이용하실 수 있습니다. 직원별 개별 로그인은 없고, 회사 계정 하나로 관리하는 구조입니다.",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;
  const company = isLoggedIn ? await getCurrentCompany() : null;

  return (
    <div className="cs-app-shell home-page">
      <HomeNav isLoggedIn={isLoggedIn} companyName={company?.name} logoUrl={company?.logo_url} />

      <main>
        {/* 1. 히어로
             relative만으로는 안 된다 — position:relative + z-index:auto인 요소는
             그 자체로 새 스태킹 컨텍스트를 만들지 않아서, 안의 -z-10 그라데이션
             레이어가 이 섹션을 그냥 지나쳐 더 바깥(루트) 스태킹 컨텍스트로 "탈출"
             한다. 그러면 이 섹션 자신의 배경(투명)과는 무관하게, 루트 컨텍스트 안에서
             .home-page(흰 배경, position:static)가 "포지션드 후손(stack level 0)"
             단계에서 그라데이션(negative z-index 단계)보다 나중에 칠해져 그라데이션을
             완전히 덮어버린다 — 실제로 브라우저 렌더링 화면을 픽셀 단위로 읽어서
             확인한 버그(계산상으론 보여야 하는데 실측은 순백색이었다). isolate로 이
             섹션이 직접 새 스태킹 컨텍스트를 만들게 하면, -z-10 레이어가 이 섹션
             안에서만 "제일 뒤"로 확실히 고정된다. */}
        <section className="home-hero relative isolate">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[radial-gradient(80%_80%_at_50%_-20%,#c7d2fe_40%,transparent_100%)]"
          />
          <div className="home-hero-inner">
            <div className="home-hero-copy">
              <span className="home-eyebrow">청소업체를 위한 원가·견적 자동화 솔루션</span>
              <h1>
                청소 견적,
                <br />
                엑셀로 계산하지 마세요.
              </h1>
              <p className="home-hero-sub">
                면적과 작업 조건만 입력하면 필요 인원부터 실제 원가, 이윤, VAT까지 자동으로 계산합니다.
              </p>
              <ul className="home-checklist">
                <li>
                  <span className="check-chip">
                    <CheckIcon />
                  </span>
                  공공입찰 산출내역서 지원
                </li>
                <li>
                  <span className="check-chip">
                    <CheckIcon />
                  </span>
                  4대보험·퇴직금 포함 노무비 계산
                </li>
                <li>
                  <span className="check-chip">
                    <CheckIcon />
                  </span>
                  견적서 PDF 자동 생성
                </li>
              </ul>
              <div className="home-hero-actions">
                <Link href="/signup" className="btn btn-primary btn-lg">
                  무료로 시작하기
                </Link>
              </div>
            </div>

            <RevealOnScroll className="home-hero-preview">
              <DashboardPreview companyName="그린클린 주식회사" snapshots={DASH_SNAPSHOTS} />
            </RevealOnScroll>
          </div>
        </section>

        {/* 2. 사용자 이득 */}
        <section className="home-section" id="features">
          <RevealOnScroll className="section-head">
            <h2>왜 클린스탠드를 써야 할까요?</h2>
            <p>단순한 계산 도구가 아닙니다. 청소업체의 견적 업무 전체를 더 빠르고, 정확하고, 체계적으로 바꿔주는 업무 파트너입니다.</p>
          </RevealOnScroll>
          <RevealOnScroll className="benefit-marquee">
            <div className="benefit-track">
              {[...BENEFITS, ...BENEFITS].map((b, i) => (
                <div className="benefit-card" key={`${b.title}-${i}`}>
                  <span className="benefit-icon">{b.icon}</span>
                  <h3>{b.title}</h3>
                  <p>{b.desc}</p>
                </div>
              ))}
            </div>
          </RevealOnScroll>
        </section>

        {/* 3. 더 빠르고, 더 정확하고, 더 깔끔하게 — 카드/아이콘 없이 타이포그래피만
             쓰는 가로 리스트. 키워드(브랜드블루, 굵게) : 설명(회색) = 대략 1:2 비율,
             줄 사이에만 얇은 구분선(마지막 줄엔 없음). */}
        <section className="home-section" id="promise">
          <div className="promise-list">
            {PROMISES.map((item) => (
              <RevealOnScroll key={item.keyword} className="promise-row">
                <span className="promise-keyword">{item.keyword}</span>
                <span className="promise-desc">{item.desc}</span>
              </RevealOnScroll>
            ))}
          </div>
        </section>

        {/* 4. 어떻게 사용하나요? — 3단계 스텝 프리뷰(자동 3초 순환 + 클릭 전환). */}
        <section className="home-section" id="how-it-works">
          <RevealOnScroll className="section-head">
            <h2>복잡한 견적 계산, 세 단계면 됩니다.</h2>
            <p>회사 기준을 설정하고 현장 정보를 입력하면, 정확한 견적이 자동으로 완성됩니다.</p>
          </RevealOnScroll>
          <RevealOnScroll delay={100}>
            <HowItWorksPreview />
          </RevealOnScroll>
        </section>

        {/* 5. 최근 견적 내역 (정적 예시) — 왼쪽 표(70~75%) + 오른쪽 월별 현황 미니
             막대그래프(25~30%), align-items:stretch로 높이를 맞춘다. */}
        <section className="home-section">
          <RevealOnScroll className="section-head">
            <h2>만든 견적은 계속 쌓입니다</h2>
            <p>비슷한 현장의 견적이 있으면, 참고해서 더 빠르고 정확하게 새 견적을 시작하세요.</p>
          </RevealOnScroll>
          <div className="recent-split">
            <RevealOnScroll delay={100} className="recent-table-wrap">
              <table className="recent-table">
                <thead>
                  <tr>
                    <th>현장명</th>
                    <th>건물유형</th>
                    <th className="num">면적</th>
                    <th>모드</th>
                    <th className="num">견적금액</th>
                    <th>상태</th>
                    <th>작성일</th>
                  </tr>
                </thead>
                <tbody>
                  {RECENT_QUOTES.map((q) => (
                    <tr key={q.no}>
                      <td data-label="현장명">{q.site}</td>
                      <td data-label="건물유형">{q.type}</td>
                      <td className="num" data-label="면적">{q.area}</td>
                      <td data-label="모드">
                        <span className={`badge ${q.modeCls}`}>{q.mode}</span>
                      </td>
                      <td className="num" data-label="견적금액">{q.amount}</td>
                      <td data-label="상태">
                        <span className={`badge ${q.statusCls}`}>{q.status}</span>
                      </td>
                      <td className="muted-cell" data-label="작성일">{q.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </RevealOnScroll>

            {/* 카운트업 + 스파크라인이 자동 순환하는 지표 카드 — 내부에서 스스로
                 IntersectionObserver로 화면에 들어온 시점을 감지해 그때부터 순환을
                 시작한다(QuoteMetricCard, Interactive.tsx). RevealOnScroll로는 카드
                 자체의 최초 진입 페이드만 맡긴다. */}
            <RevealOnScroll delay={180} className="qm-card-wrap">
              <QuoteMetricCard />
            </RevealOnScroll>
          </div>
        </section>

        {/* 6. FAQ + CTA (2단 배치) */}
        <section className="home-section alt" id="faq">
          <div className="faq-cta-grid">
            <RevealOnScroll className="faq-col">
              <div className="faq-head">
                <h2>궁금한 점이 있으신가요?</h2>
                <p>클린스탠드를 사용하면서 자주 묻는 질문을 확인해보세요.</p>
              </div>
              <div className="faq-list">
                {FAQS.map((f) => (
                  <details key={f.q} className="faq-item">
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </RevealOnScroll>

            <RevealOnScroll delay={120} className="cta-card">
              <h2>
                더 빠르고 정확한
                <br />
                청소 견적의 시작
              </h2>
              <Link href="/signup" className="btn btn-cta">
                무료로 시작하기 →
              </Link>
            </RevealOnScroll>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-footer-inner">
          <div className="home-footer-brand">
            <span className="home-logo">
              <span className="home-logo-mark">CS</span>
              <span className="home-logo-word">클린스탠드</span>
            </span>
            <p>청소업체를 위한 원가·견적 자동화 솔루션</p>
          </div>
          <nav className="home-footer-links">
            <a href="#features">기능</a>
            <a href="#how-it-works">이용방법</a>
            <a href="#faq">FAQ</a>
            {isLoggedIn ? (
              <Link href="/dashboard">대시보드</Link>
            ) : (
              <>
                <Link href="/login">로그인</Link>
                <Link href="/signup">무료로 시작하기</Link>
              </>
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
}
