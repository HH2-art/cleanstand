"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import "./ConfirmDialog.css";

/**
 * 브라우저 기본 confirm()/alert() 대신 쓰는 공통 확인 모달 — 앱 전체(직원관리/
 * 생산성기준/경비항목 등)에서 재사용한다. 여러 설정 페이지의 서로 다른 .btn 스타일에
 * 기대지 않고 자체 스타일(ConfirmDialog.css, .cs-app-shell 스코프)을 가져서, 어느
 * 페이지에서 띄우든 항상 같은 톤으로 보인다.
 *
 * 가장 가까운 .cs-app-shell 루트에 포털로 그린다(document.body가 아니다) — 테이블
 * 행/스크롤 컨테이너 등 조상의 overflow에는 안 잘리면서도, --brand/--surface/
 * --shadow-lg 같은 디자인 토큰은 전부 .cs-app-shell 스코프에서만 정의돼 있어서
 * body에 바로 붙이면 그 토큰들을 못 읽어 스타일이 깨진다(순수 React state + CSS,
 * 새 라이브러리 아님 — react-dom은 이미 있음).
 *
 * 이 컴포넌트는 순전히 "보여주고 닫는" 역할만 한다 — 실제 삭제/병합 등 액션 로직은
 * 전부 호출하는 쪽(onConfirm)에서 기존 서버 액션을 그대로 호출한다. 여기서 바뀐 건
 * confirm() 팝업을 이 UI로 감싼 것뿐, 액션 자체는 손대지 않았다.
 */
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 삭제류처럼 되돌리기 어려운 액션이면 true — 확인 버튼이 위험색(빨강)이 된다. 기본은 브랜드블루. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  // open은 항상 클라이언트 쪽 상태(클릭 등)로만 true가 되므로, 이 아래는 서버
  // 렌더링(SSR) 경로에서 절대 실행되지 않는다 — document 접근에 typeof 가드가
  // 따로 필요 없다. querySelector는 부수효과가 없는 순수 조회라 useEffect+state로
  // 한 번 더 렌더링을 돌릴 필요 없이 렌더 중에 바로 계산한다(react-hooks/
  // set-state-in-effect가 정확히 이런 "effect 안에서 곧장 setState" 패턴을
  // 불필요한 렌더 캐스케이드로 보고 잡아낸다).
  if (!open) return null;
  const portalTarget = document.querySelector(".cs-app-shell") ?? document.body;

  return createPortal(
    <div className="confirm-overlay" onClick={onCancel}>
      <div
        className="confirm-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="confirm-title">
          {title}
        </h2>
        {description && <p className="confirm-desc">{description}</p>}
        <div className="confirm-actions">
          <button type="button" className="confirm-btn confirm-btn-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-btn ${danger ? "confirm-btn-danger" : "confirm-btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    portalTarget,
  );
}
