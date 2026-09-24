"use client";

import { useId, useState } from "react";

/**
 * 보기/숨기기 토글이 달린 비밀번호 입력 — 실제 폼 검증(required/minLength)과
 * 서버 액션이 읽는 필드명(name)은 그대로 유지한 채, type만 text/password로
 * 토글한다. 새 라이브러리 설치 없이 인라인 SVG 아이콘만 사용.
 */
export function PasswordInput({
  id,
  name,
  autoComplete,
  minLength,
}: {
  id: string;
  name: string;
  autoComplete: string;
  minLength?: number;
}) {
  const [show, setShow] = useState(false);
  const reactId = useId();
  const toggleId = `${id || reactId}-toggle`;

  return (
    <div className="glass-input-wrapper">
      <div className="password-field">
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          className="auth-input"
        />
        <button
          type="button"
          id={toggleId}
          className="password-toggle"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "비밀번호 숨기기" : "비밀번호 보기"}
        >
          {show ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 8 11 8a13.16 13.16 0 0 1-1.67 2.68" />
              <path d="M6.61 6.61A13.526 13.526 0 0 0 1 12s4 8 11 8a9.74 9.74 0 0 0 5.39-1.61" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
