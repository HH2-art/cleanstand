"use client";

/**
 * 홈페이지 전용 가벼운 인터랙션 모음 — 무거운 애니메이션 라이브러리 없이 순수
 * CSS 트랜지션 + 네이티브 IntersectionObserver/requestAnimationFrame으로 구현.
 */

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { CompanyAvatar } from "@/components/CompanyAvatar";
import { DashboardContent, type DashboardActivityRow, type DashboardQuoteRow } from "@/app/dashboard/DashboardContent";
import { WorkTypeIcon } from "@/app/settings/productivity/WorkTypeIcon";

export function RevealOnScroll({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${visible ? "is-visible" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function HomeNav({
  isLoggedIn,
  companyName,
  logoUrl,
}: {
  isLoggedIn: boolean;
  companyName?: string | null;
  logoUrl?: string | null;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`home-nav ${scrolled ? "is-scrolled" : ""}`}>
      <div className="home-nav-inner">
        <Link href="/" className="home-logo">
          <span className="home-logo-mark">CS</span>
          <span className="home-logo-word">클린스탠드</span>
        </Link>
        <nav className="home-nav-links">
          <a href="#features">기능</a>
          <a href="#how-it-works">이용방법</a>
          <a href="#faq">FAQ</a>
        </nav>
        {isLoggedIn ? (
          <div className="home-nav-actions">
            <Link href="/dashboard" className="home-nav-avatar-link" aria-label="대시보드로 이동">
              <CompanyAvatar name={companyName ?? "?"} logoUrl={logoUrl} size={36} />
            </Link>
          </div>
        ) : (
          <div className="home-nav-actions">
            <Link href="/login" className="btn btn-ghost">
              로그인
            </Link>
            <Link href="/signup" className="btn btn-primary">
              무료로 시작하기
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

export interface DashboardPreviewSnapshot {
  quotes: DashboardQuoteRow[];
  activity: DashboardActivityRow[];
  currentMonthKey: string;
  prevMonthKey: string;
}

// 실측(puppeteer로 .dash-preview-natural을 width:1600px 고정 상태에서 직접 측정,
// 스코프 마커 없이 자연 높이를 그대로 잼): 사이드바+페이지타이틀+스탯카드3개+
// 최근견적목록(5행+페이지네이션)+최근활동·도넛 카드까지 전부 포함한 실제 렌더링
// 높이는 1033px였다(이전에 손으로 추정했던 1000~1300px과 달리 실측값). 여기에
// 최소 패딩 정도의 버퍼만(10~20px 요청 → 27px) 더해 1060으로 잡는다 — 화면의
// 몇 분의 1을 차지하는 큰 여백을 만들지 않기 위해서다.
const FULL_NATURAL_WIDTH = 1600;
const FULL_NATURAL_HEIGHT = 1060;
// 모바일: 사이드바/표/하단 카드는 숨기고 스탯카드 3개만 보여준다(같은 실제 컴포넌트를
// 그대로 두고 CSS로 나머지를 가리는 것 — 내용을 다시 그리지 않는다). 캔버스 자체를
// 좁게 잡아야, 카드 3개만 남았을 때도 숫자가 큼직하게 보인다.
const COMPACT_NATURAL_WIDTH = 760;
const COMPACT_NATURAL_HEIGHT = 220;
// 프리뷰의 실제 렌더 폭이 이보다 좁으면(=거의 폰 화면) 축약 모드로 전환.
const COMPACT_BREAKPOINT = 460;
// 히어로 우측 컬럼이 아무리 넓어져도 프리뷰가 과도하게 커지지 않도록 거는 상한
// (요청한 "컨테이너에 overflow:hidden과 max-width를 반드시" 조건의 max-width).
const MAX_FRAME_WIDTH = 820;

/**
 * 히어로용 대시보드 미니 프리뷰 — 새로 그리지 않고 실제 AppSidebar/DashboardContent
 * 컴포넌트를 있는 그대로 렌더링한다(정적 목업 데이터, 실제 쿼리 없음).
 *
 * 크기 계산 순서(요청받은 그대로):
 *  1) 이 컴포넌트를 감싼 실제 컨테이너(.dash-preview-viewport)의 렌더 폭을
 *     ResizeObserver로 측정한다 — 히어로가 좌(텍스트)/우(프리뷰) 2컬럼이라, 이 폭은
 *     항상 우측 컬럼에 실제로 배정된 만큼만 나온다(CSS: minmax(0,1fr) — 아래 참고).
 *  2) 실제 콘텐츠(사이드바+본문)의 원본 렌더링 크기 FULL_NATURAL_WIDTH/HEIGHT는
 *     puppeteer로 실측한 값이다(주석 참고).
 *  3) scale = 측정폭 / FULL_NATURAL_WIDTH.
 *  4) .dash-preview-frame에 overflow:hidden + max-width를 걸어(home.css) scale이
 *     얼마든 컨테이너 박스 자체가 그 경계를 넘지 않게 한다.
 *
 * 클릭하면 실제 라우팅(견적 상세 등)이나 실제 로그아웃이 일어나면 안 되므로,
 * 이 프리뷰 전체를 pointer-events:none으로 막는다(home.css).
 */
export function DashboardPreview({ companyName, snapshots }: { companyName: string; snapshots: DashboardPreviewSnapshot[] }) {
  const [index, setIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  // 측정 전(첫 페인트) 기본값 — 측정이 끝나기 전 한 프레임 동안 원본 크기로
  // 번쩍였다 줄어드는 게 안 보이게 보수적인 값으로 시작한다.
  const [renderWidth, setRenderWidth] = useState(480);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function measure() {
      const w = Math.min(el!.getBoundingClientRect().width, MAX_FRAME_WIDTH);
      if (w > 0) setRenderWidth(w);
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % snapshots.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [snapshots.length]);

  const snap = snapshots[index];
  const isCompact = renderWidth < COMPACT_BREAKPOINT;
  const naturalWidth = isCompact ? COMPACT_NATURAL_WIDTH : FULL_NATURAL_WIDTH;
  const naturalHeight = isCompact ? COMPACT_NATURAL_HEIGHT : FULL_NATURAL_HEIGHT;
  const scale = renderWidth / naturalWidth;

  return (
    <div className="dash-preview-frame">
      <div className="dash-preview-viewport" ref={viewportRef} style={{ height: naturalHeight * scale }}>
        <div
          className={`cs-app-shell dash-preview-natural ${isCompact ? "is-compact" : ""}`}
          style={{ width: naturalWidth, height: naturalHeight, transform: `scale(${scale})` }}
        >
          <AppSidebar current="dashboard" companyName={companyName} />
          <div className="main">
            <div className="main-inner dashboard-page">
              <DashboardContent
                quotes={snap.quotes}
                activity={snap.activity}
                currentMonthKey={snap.currentMonthKey}
                prevMonthKey={snap.prevMonthKey}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- "어떻게 사용하나요?" 3단계 스텝 프리뷰 ----------
 * 아래 세 패널은 실제 화면을 새로 그린 게 아니라, 각 화면의 실제 소스(
 * settings/productivity/page.tsx, quotes/new/NewQuoteForm.tsx)를 직접 읽어 그
 * CSS 클래스와 DOM 구조를 그대로 옮긴 정적 마크업이다(목업 데이터, 실제 쿼리/
 * 서버 액션 없음). 두 화면 다 서버 컴포넌트이거나 실제 DB row에 의존하는 props를
 * 받기 때문에 컴포넌트 자체를 그대로 import할 수 없었다 — 대신 그 스코프
 * 마커 클래스(.productivity-page / .quotes-new-page)를 그대로 씌워서, 각 페이지의
 * CSS 파일(productivity.css / new-quote.css, 둘 다 home.css보다 나중에 import돼
 * 있다 — page.tsx 상단 주석 참고)이 실제와 동일하게 적용되게 한다. 유일하게 실제
 * 컴포넌트를 그대로 재사용한 것은 WorkTypeIcon(순수 프레젠테이셔널, 서버 의존 없음).
 * 모든 인터랙티브 엘리먼트(버튼/드롭다운)는 disabled/readOnly로 막아, 실수로도
 * 실제 폼 제출이나 서버 액션이 일어나지 않는다. */

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
const HIW_CUSTOM_RATES = [
  { workType: "carpet_cleaning", name: "카펫청소", sqmPerHour: 35, updatedAt: "2026.08.12 14:30" },
  { workType: "sofa_cleaning", name: "소파청소", sqmPerHour: 18, updatedAt: "2026.07.29 11:05" },
];

function HowItWorksStep1() {
  return (
    <div className="productivity-page productivity-container">
      <div className="card">
        <div className="section-head">
          <div>
            <div className="section-title-row">
              <h2>회사 커스텀</h2>
              <span className="count-badge">{HIW_CUSTOM_RATES.length}개</span>
            </div>
            <p className="section-note">목록에 없는 청소 항목(예: 카펫청소)을 새로 추가할 때 여기를 써요.</p>
          </div>
          <button type="button" className="btn btn-primary" disabled>
            <PlusIcon /> 새 기준 추가
          </button>
        </div>
        <div className="hiw-table-scroll">
        <table className="pt-table">
          <thead>
            <tr>
              <th>업무유형</th>
              <th>생산성 기준 (㎡/시간)</th>
              <th>최근 수정일</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {HIW_CUSTOM_RATES.map((rate) => (
              <tr key={rate.workType}>
                <td>
                  <div className="wt-row">
                    <span className="wt-icon custom">
                      <WorkTypeIcon workType={rate.workType} />
                    </span>
                    <span className="wt-name">{rate.name}</span>
                  </div>
                </td>
                <td>
                  <div className="rate-input-row">
                    <input type="number" className="rate-input" readOnly value={rate.sqmPerHour} />
                    <button type="button" className="btn-text" disabled>
                      저장
                    </button>
                  </div>
                </td>
                <td className="muted-cell">{rate.updatedAt}</td>
                <td className="actions">
                  <span className="actions-row">
                    <button type="button" className="btn-text" disabled>
                      수정
                    </button>
                    <button type="button" className="btn-text danger" disabled>
                      삭제
                    </button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function HowItWorksStep2() {
  return (
    <div className="quotes-new-page">
      <div className="card">
        <div className="card-head">
          <h2>현장정보</h2>
          <span className="step">2</span>
        </div>
        <div className="field-grid">
          <div className="field">
            <label>
              현장명 <span className="req">*</span>
            </label>
            <input type="text" readOnly value="강남 A오피스빌딩" />
          </div>
          <div className="field">
            <label>건물유형</label>
            <select disabled value="오피스" onChange={() => {}}>
              <option>오피스</option>
            </select>
          </div>
        </div>

        <div className="field-grid" style={{ marginTop: 16 }}>
          <div className="field">
            <label>
              청소범위 (작업유형) <span className="req">*</span>
            </label>
            <select disabled value="오피스 일반청소" onChange={() => {}}>
              <option>오피스 일반청소</option>
            </select>
          </div>
          <div className="field">
            <label>작업속도 (오피스 일반청소 기준 프리필, 수정 가능)</label>
            <div className="unit-suffix">
              <input type="number" readOnly value={70} />
              <span>㎡ / 인시간</span>
            </div>
          </div>
        </div>

        <div className="field-grid" style={{ marginTop: 16 }}>
          <div className="field">
            <label>
              면적 <span className="req">*</span>
            </label>
            <div className="unit-suffix">
              <input type="number" readOnly value={1200} />
              <span>㎡</span>
            </div>
          </div>
          <div className="field">
            <label>
              빈도 <span className="req">*</span>
            </label>
            <div className="freq-row">
              <input type="number" readOnly value={5} />
              <div className="unit-toggle">
                <button type="button" className="active" disabled>
                  주
                </button>
                <button type="button" disabled>
                  월
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HowItWorksStep3() {
  return (
    <div className="quotes-new-page">
      <div className="sidebar-wrap">
        <div className="sidebar-card">
          <div className="sidebar-head">
            <h2>계산결과</h2>
          </div>
          <div className="sidebar-body">
            <div className="sr">
              <span className="l">예상 작업시간</span>
              <span className="v num">17.1h</span>
            </div>
            <div className="sr">
              <span className="l">필요 인원</span>
              <span className="v num">3명</span>
            </div>
            <div className="sr indent">
              <span className="l">일반청소원 (2명)</span>
              <span className="v num">2,835,000원</span>
            </div>
            <div className="sr indent">
              <span className="l">반장 (1명)</span>
              <span className="v num">945,000원</span>
            </div>
            <div className="sr">
              <span className="l">경비</span>
              <span className="v num">180,000원</span>
            </div>
            <div className="sr">
              <span className="l">관리비 (7%)</span>
              <span className="v num">277,000원</span>
            </div>
            <div className="sr">
              <span className="l">이윤 (8%)</span>
              <span className="v num">339,000원</span>
            </div>
            <div className="sr">
              <span className="l">VAT</span>
              <span className="v num">458,000원</span>
            </div>
          </div>
          <div className="sidebar-final">
            <span className="l">최종 견적</span>
            <span className="v num">5,034,000원</span>
          </div>
          <div className="sidebar-actions">
            <button type="button" className="btn btn-secondary" disabled>
              임시저장
            </button>
            <button type="button" className="btn btn-primary" disabled>
              견적서 생성
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const HIW_STEPS = [
  { n: 1 as const, label: "회사 기준으로 설정", desc: "생산성과 회사 기준을 미리 설정합니다" },
  { n: 2 as const, label: "현장 정보 입력", desc: "면적과 작업 조건을 입력합니다" },
  { n: 3 as const, label: "견적 확인", desc: "필요 인원과 원가를 계산하고 견적을 완성합니다" },
];
// 한 단계가 "머무는" 시간이자, 다음 단계로 이어지는 연결선이 채워지는 데 걸리는
// 시간이기도 하다(선 채우기가 다 끝나는 시점 = 다음 단계로 넘어가는 시점).
const HIW_FILL_MS = 3000;
// 화면 전환 크로스페이드 — 이 시간만큼 현재 화면이 fade-out한 뒤 콘텐츠를 바꾸고,
// 같은 시간만큼 다시 fade-in한다(요청한 200~300ms 범위 안).
const HIW_FADE_MS = 250;

/**
 * 1→2→3→1 자동 순환. 번호 클릭 시 즉시 그 단계로 전환하고 그 지점부터 다시 3초
 * 채우기를 시작한다(타이머 리셋). 두 개의 독립적인 타이밍이 물려 있다:
 *  1) 연결선 채우기 — CSS transform:scaleX() 3초 linear transition. 매번 새로
 *     채우기를 시작할 때 scaleX(0)으로 순간 리셋한 뒤(transition 없이) 다음 프레임에
 *     transition을 켜고 scaleX(1)로 바꿔야 실제로 0%부터 재생된다 — 리셋과 재생을
 *     같은 렌더에서 같이 하면 브라우저가 그 사이 프레임을 건너뛰어 트랜지션이 아예
 *     재생 안 될 수 있어서, requestAnimationFrame을 두 번 중첩해 "리셋 프레임이 실제
 *     로 페인트된 다음" 재생을 시작하게 강제한다(fillPlaying).
 *  2) 화면 크로스페이드 — displayStep(실제 렌더되는 콘텐츠)을 activeStep(목표 단계)
 *     보다 HIW_FADE_MS만큼 늦게 따라가게 한다: activeStep이 바뀌면 먼저 지금 콘텐츠를
 *     fading 클래스로 즉시 페이드아웃시키고, HIW_FADE_MS 뒤에 displayStep을 옮겨
 *     콘텐츠를 교체한 다음(이때도 fading은 아직 true라 새 콘텐츠가 투명한 채로
 *     나타난다), 다시 두 번의 rAF 뒤 fading을 꺼서 0→1로 페이드인시킨다.
 */
export function HowItWorksPreview() {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [displayStep, setDisplayStep] = useState<1 | 2 | 3>(1);
  const [fading, setFading] = useState(false);
  const [fillPlaying, setFillPlaying] = useState(false);

  const fillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentScale, setContentScale] = useState(1);

  function startFill() {
    setFillPlaying(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFillPlaying(true);
      });
    });
  }

  function goToStep(next: 1 | 2 | 3) {
    if (fillTimerRef.current) clearTimeout(fillTimerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);

    setActiveStep(next);
    setFading(true);
    fadeTimerRef.current = setTimeout(() => {
      setDisplayStep(next);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFading(false);
        });
      });
    }, HIW_FADE_MS);

    if (next < 3) {
      startFill();
    } else {
      // 3단계는 다음에 이어지는 연결선이 없어 채울 것이 없다 — 그냥 3초 머물다 1로 돌아간다.
      setFillPlaying(false);
    }

    fillTimerRef.current = setTimeout(() => {
      goToStep(next === 3 ? 1 : ((next + 1) as 1 | 2 | 3));
    }, HIW_FILL_MS);
  }

  useEffect(() => {
    goToStep(1);
    return () => {
      if (fillTimerRef.current) clearTimeout(fillTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectStep(n: 1 | 2 | 3) {
    goToStep(n);
  }

  // 박스 높이는 고정(home.css .hiw-panel)이라, 콘텐츠가 그 안에 실제로 들어갈 수
  // 있는 높이(.hiw-panel-viewport의 렌더 높이 = 패널 높이 - 패딩)보다 크면
  // transform:scale로 줄인다. 작으면 1 그대로 두고 .hiw-panel-viewport의
  // align-items:center가 세로 중앙 정렬을 맡는다. scrollHeight는 transform의 영향을
  // 받지 않는 값이라 이미 스케일된 상태에서 다시 재도 항상 "원본 크기" 기준으로
  // 정확히 잰다.
  useLayoutEffect(() => {
    const el = contentRef.current;
    const viewport = el?.parentElement;
    if (!el || !viewport) return;
    const available = viewport.clientHeight;
    const natural = el.scrollHeight;
    setContentScale(natural > available && available > 0 ? available / natural : 1);
  }, [displayStep]);

  function segmentStyle(segmentIndex: 0 | 1): CSSProperties {
    const segStartStep = (segmentIndex + 1) as 1 | 2;
    if (activeStep > segStartStep) return { transform: "scaleX(1)", transition: "none" };
    if (activeStep === segStartStep) {
      return fillPlaying
        ? { transform: "scaleX(1)", transition: `transform ${HIW_FILL_MS}ms linear` }
        : { transform: "scaleX(0)", transition: "none" };
    }
    return { transform: "scaleX(0)", transition: "none" };
  }

  return (
    <div className="hiw-wrap">
      <div className="hiw-progress">
        <div className="hiw-track">
          <span className="hiw-track-seg-bg" style={{ left: "16.6667%" }} />
          <span className="hiw-track-seg-bg" style={{ left: "50%" }} />
          <span className="hiw-track-seg-fill" style={{ left: "16.6667%", ...segmentStyle(0) }} />
          <span className="hiw-track-seg-fill" style={{ left: "50%", ...segmentStyle(1) }} />
          {HIW_STEPS.map((step) => (
            <div className="hiw-circle-col" key={step.n}>
              <button
                type="button"
                className={`hiw-circle ${activeStep === step.n ? "active" : ""}`}
                onClick={() => selectStep(step.n)}
                aria-label={`${step.n}단계: ${step.label}`}
              >
                {step.n}
              </button>
            </div>
          ))}
        </div>
        <div className="hiw-labels">
          {HIW_STEPS.map((step) => (
            <div className="hiw-label-col" key={step.n}>
              <div className={`hiw-step-label ${activeStep === step.n ? "active" : ""}`}>{step.label}</div>
              <div className="hiw-step-desc">{step.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="hiw-panel">
        <div className="hiw-panel-viewport">
          <div
            key={displayStep}
            ref={contentRef}
            className={`hiw-panel-content ${fading ? "is-fading" : ""}`}
            style={{ transform: contentScale !== 1 ? `scale(${contentScale})` : undefined }}
          >
            {displayStep === 1 && <HowItWorksStep1 />}
            {displayStep === 2 && <HowItWorksStep2 />}
            {displayStep === 3 && <HowItWorksStep3 />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- "만든 견적은 계속 쌓입니다" 섹션 우측 지표 카드 ----------
 * 지표 2개(누적 견적/진행 중 견적)가 4.5초마다 자동 전환된다. 전환마다: (1) 숫자·
 * 라벨·스파크라인을 opacity로 fade-out, (2) 다음 지표로 교체, (3) fade-in과 동시에
 * 숫자가 0→목표값으로 ease-out 카운트업(rAF 기반, 라이브러리 없음). 스파크라인은
 * 지표마다 다른 점 데이터로 새로 그려서(같은 SVG viewBox) 내용 전환과 함께 같이
 * 바뀐다 — path 모양을 서로 보간(morph)하지는 않는다(포인트 개수가 이미 같아도
 * 매끄러운 모양 보간에는 별도 라이브러리가 필요해서, "같이 전환"만 만족시킨다). */

interface QuoteMetric {
  label: string;
  value: number;
  suffix: string;
  change: string;
  spark: number[];
}

const QUOTE_METRICS: QuoteMetric[] = [
  {
    label: "이번 달 누적 견적",
    value: 18,
    suffix: "건",
    change: "지난달 대비 42% 증가",
    spark: [10, 13, 11, 15, 14, 17, 16, 19, 18, 21, 20, 24],
  },
  {
    label: "진행 중 견적",
    value: 4,
    suffix: "건",
    change: "임시저장 + 발송완료 합계",
    spark: [3, 5, 3, 6, 4, 5, 3, 6, 4, 5, 4, 4],
  },
];

const QM_DWELL_MS = 4500;
const QM_FADE_MS = 250;
const QM_COUNT_MS = 900;
const QM_SPARK_W = 160;
const QM_SPARK_H = 44;

/** 점 데이터를 <polyline points="..."> 문자열로 — 베지어로 뭉개지 않고 각 지점을
 * 직선으로 그대로 이어서, 실제 주가 차트/대시보드 미니 라인처럼 꺾이는 지점이
 * 자연스럽게 각지게 보이게 한다(이전엔 이등분점을 지나는 2차 베지어로 스무딩했는데,
 * 곡선이 과해서 부자연스럽다는 피드백으로 직선 연결로 바꿨다). */
function buildSparkPoints(points: number[], w: number, h: number, pad = 4): string {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const innerH = h - pad * 2;
  const stepX = w / (points.length - 1);
  return points
    .map((v, i) => {
      const x = i * stepX;
      const y = pad + innerH - ((v - min) / range) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function QuoteMetricCard() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);

  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  function runCountUp(target: number) {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / QM_COUNT_MS);
      const eased = 1 - (1 - t) ** 3; // ease-out cubic
      setDisplayValue(Math.round(target * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function goTo(index: number) {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);

    setActiveIndex(index);
    setFading(true);
    fadeTimerRef.current = setTimeout(() => {
      setDisplayIndex(index);
      runCountUp(QUOTE_METRICS[index].value);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFading(false);
        });
      });
    }, QM_FADE_MS);

    dwellTimerRef.current = setTimeout(() => {
      goTo((index + 1) % QUOTE_METRICS.length);
    }, QM_DWELL_MS);
  }

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    runCountUp(QUOTE_METRICS[0].value);
    dwellTimerRef.current = setTimeout(() => {
      goTo(1 % QUOTE_METRICS.length);
    }, QM_DWELL_MS);
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  function selectMetric(index: number) {
    if (index === activeIndex) return;
    goTo(index);
  }

  const metric = QUOTE_METRICS[displayIndex];
  const sparkPoints = buildSparkPoints(metric.spark, QM_SPARK_W, QM_SPARK_H);

  return (
    <div className="qm-card" ref={rootRef}>
      <div className={`qm-content ${fading ? "is-fading" : ""}`}>
        <span className="qm-label">{metric.label}</span>
        <div className="qm-value">
          {displayValue}
          <span className="qm-suffix">{metric.suffix}</span>
        </div>
        <span className="qm-change">{metric.change}</span>
        <svg className="qm-spark" viewBox={`0 0 ${QM_SPARK_W} ${QM_SPARK_H}`} preserveAspectRatio="none" aria-hidden="true">
          <polyline points={sparkPoints} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="qm-dots">
        {QUOTE_METRICS.map((m, i) => (
          <button
            type="button"
            key={m.label}
            className={`qm-dot ${i === activeIndex ? "active" : ""}`}
            aria-label={m.label}
            onClick={() => selectMetric(i)}
          />
        ))}
      </div>
    </div>
  );
}
