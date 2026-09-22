"use client";

import { useActionState, useState, useTransition } from "react";
import {
  clearRoleRateOverride,
  deleteRoleRate,
  renameRoleRate,
  setRoleRateOverride,
  type RenameRoleRateState,
  type RoleRateActionState,
} from "@/app/actions/roleRates";

/**
 * 역할별 표준원가 한 행 — 토글/인라인 수정/삭제 UI만 캔버스 디자인으로 입혔고,
 * 실제 로직은 전부 기존 서버 액션(setRoleRateOverride/clearRoleRateOverride) 그대로
 * 호출한다. rename/delete만 이번에 새로 추가된 진짜 서버 액션이다.
 *
 * 역할명 변경이 기존 역할과 겹치면 자동으로 평균내 합치지 않는다 — 먼저 서버가 계산한
 * 미리보기 메시지를 보여주고, "합치기"로 명시적으로 다시 제출해야만 실제로 합친다.
 */
export function RoleRateRow({
  roleName,
  rate,
  isManual,
}: {
  roleName: string;
  rate: number;
  isManual: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [rateInput, setRateInput] = useState(String(Math.round(rate)));
  const [, startTransition] = useTransition();
  const [renameState, renameAction] = useActionState<RenameRoleRateState, FormData>(renameRoleRate, null);
  const [deleteState, deleteAction] = useActionState<RoleRateActionState, FormData>(deleteRoleRate, null);
  const [deleteDismissed, setDeleteDismissed] = useState(false);
  const [mergeCancelled, setMergeCancelled] = useState(false);

  // 값 입력은 캔버스처럼 매 키입력마다 반영하면 실제로는 매번 서버 액션이 나가버리므로,
  // 포커스를 벗어날 때만 실제 setRoleRateOverride를 호출한다(로직은 동일, 트리거만 조정).
  function commitRate() {
    const num = Number(rateInput);
    if (Number.isNaN(num) || num < 0 || Math.round(num) === Math.round(rate)) return;
    const fd = new FormData();
    fd.set("role_name", roleName);
    fd.set("standard_hourly_rate", String(num));
    startTransition(() => {
      setRoleRateOverride(fd);
    });
  }

  function toggleManual() {
    const fd = new FormData();
    fd.set("role_name", roleName);
    if (isManual) {
      startTransition(() => {
        clearRoleRateOverride(fd);
      });
    } else {
      // 토글 ON: 지금 보이는 값(자동계산 값)을 그대로 들고 수동 모드로 진입 — 캔버스와 동일.
      fd.set("standard_hourly_rate", String(Math.round(rate)));
      startTransition(() => {
        setRoleRateOverride(fd);
      });
    }
  }

  const showDeleteWarning = !!deleteState && "error" in deleteState && !deleteDismissed;
  const isConfirmingMerge = !!renameState && "needsConfirm" in renameState && !mergeCancelled;

  return (
    <div className="rate-row">
      {isConfirmingMerge && renameState && "needsConfirm" in renameState ? (
        <form action={renameAction} className="rate-row-edit-form">
          <input type="hidden" name="old_role_name" value={roleName} />
          <input type="hidden" name="new_role_name" value={renameState.newName} />
          <input type="hidden" name="confirm_merge" value="true" />
          <span>{renameState.message}</span>
          <button type="submit" className="btn-text">
            합치기
          </button>
          <button
            type="button"
            className="btn-text muted"
            onClick={() => {
              setMergeCancelled(true);
              setIsEditing(false);
            }}
          >
            취소
          </button>
        </form>
      ) : isEditing ? (
        <form action={renameAction} className="rate-row-edit-form">
          <input type="hidden" name="old_role_name" value={roleName} />
          <input type="text" name="new_role_name" className="role-edit-input" defaultValue={roleName} autoFocus />
          <button type="submit" className="btn-text">
            저장
          </button>
          <button type="button" className="btn-text muted" onClick={() => setIsEditing(false)}>
            취소
          </button>
        </form>
      ) : (
        <>
          <span className="role-name">{roleName}</span>
          {isManual ? (
            <div className="rate-input-wrap">
              <input
                type="number"
                className="rate-input"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                onBlur={commitRate}
              />
              <span className="rate-unit">원/h</span>
            </div>
          ) : (
            <span className="rate-val num">{Math.round(rate).toLocaleString("ko-KR")}원/h</span>
          )}
          <span className="spacer" />
          <span className={`rate-src ${isManual ? "manual" : "auto"}`}>{isManual ? "(수동)" : "(자동계산)"}</span>
          <label className="rate-toggle">
            <input type="checkbox" checked={isManual} onChange={toggleManual} />
            <span className="track" />
            <span className="thumb" />
          </label>
          <div className="rate-actions">
            <button
              type="button"
              className="btn-text"
              onClick={() => {
                setIsEditing(true);
                setMergeCancelled(false);
              }}
            >
              수정
            </button>
            <form action={deleteAction}>
              <input type="hidden" name="role_name" value={roleName} />
              <button type="submit" className="btn-text muted" onClick={() => setDeleteDismissed(false)}>
                삭제
              </button>
            </form>
          </div>
        </>
      )}
      {showDeleteWarning && deleteState && "error" in deleteState && (
        <div className="rate-warning">
          <span>{deleteState.error}</span>
          <button type="button" onClick={() => setDeleteDismissed(true)}>
            확인
          </button>
        </div>
      )}
      {renameState && "error" in renameState && (
        <div className="rate-warning">
          <span>{renameState.error}</span>
        </div>
      )}
    </div>
  );
}
