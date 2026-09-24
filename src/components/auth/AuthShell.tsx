import type { ReactNode } from "react";
import { ShaderBackground } from "@/components/ui/ShaderBackground";
import "./AuthShell.css";

/**
 * 로그인/회원가입 공통 레이아웃 — 좌(children으로 받는 폼)/우(WebGL 메쉬 셰이더
 * 배경 + 카피) 분할. 훅이 없는 순수 프레젠테이셔널 컴포넌트라 "use client" 페이지
 * (login/signup)에서 그대로 import해도 안전하다.
 *
 * 우측은 부모 전체를 꽉 채우지 않고 사방에 여백(16px)을 둔 채 둥근 모서리(24px)로
 * 떠 있는 카드처럼 보이게 한다 — ShaderBackground 캔버스는 이 안쪽(.auth-right-inner,
 * 이미 position:absolute라 자체적으로 새 containing block) 기준 absolute inset-0로
 * 깔리고, 카피 텍스트가 그 위에 z-index로 얹힌다.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-left">
        <div className="auth-left-inner">{children}</div>
      </div>
      <div className="auth-right">
        <div className="auth-right-inner">
          <ShaderBackground className="absolute inset-0" />
          <div className="auth-right-copy">
            <h2>
              견적은 간단하게,
              <br />
              계산은 정확하게
            </h2>
          </div>
        </div>
      </div>
    </div>
  );
}
