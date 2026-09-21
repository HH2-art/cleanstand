import { escapeHtml, wrapHtmlDocument } from "./html";
import { formatDate, won, type PdfQuoteData } from "./types";

/** 산출내역서 — 비목별 상세(노무비/경비/일반관리비/이윤/VAT). 용역이라 재료비는 제외한 4단 구조. */
export function renderBreakdownHtml(data: PdfQuoteData): string {
  const { company, quote, lineItems } = data;
  const e = escapeHtml;

  const laborItems = lineItems.filter((item) => item.category === "labor");
  const legalItem = lineItems.find((item) => item.category === "other");

  const adminBase = quote.laborCost + quote.legalCost + quote.expenseCost;
  const appliedGeneralAdminRate = adminBase > 0 ? (quote.adminCost / adminBase) * 100 : 0;
  const profitBase = adminBase + quote.adminCost;
  const appliedProfitRate = profitBase > 0 ? (quote.profitAmount / profitBase) * 100 : 0;

  const laborRows = laborItems
    .map(
      (item) => `
        <tr>
          <td>${e(item.roleName ?? "-")}</td>
          <td class="amount">${item.workerCount}명</td>
          <td class="amount">${quote.estimatedHours.toFixed(1)}h</td>
          <td class="amount">${won(item.amount)}</td>
        </tr>`,
    )
    .join("");

  // "1. 노무비"는 아래 body에 고정으로 박혀있다 — 나머지 섹션 번호를 그 뒤로 이어 매긴다.
  const legalNum = legalItem ? 2 : null;
  const expenseNum = legalItem ? 3 : 2;
  const adminNum = legalItem ? 4 : 3;

  const legalSection = legalItem
    ? `
    <h2>${legalNum}. 법정비용</h2>
    <table><tbody>
      <tr><td>4대보험 회사부담분 등</td><td class="amount">${won(quote.legalCost)}</td></tr>
    </tbody></table>`
    : "";

  const body = `
    <div class="header">
      <div>
        ${company.logoUrl ? `<img src="${e(company.logoUrl)}" alt="${e(company.name)} 로고" class="company-logo" />` : ""}
        <h1>${e(company.name)}</h1>
        ${company.representativeName ? `<div class="muted">대표 ${e(company.representativeName)}</div>` : ""}
        ${company.businessRegistrationNumber ? `<div class="muted">사업자등록번호 ${e(company.businessRegistrationNumber)}</div>` : ""}
        ${company.address ? `<div class="muted">${e(company.address)}</div>` : ""}
        ${company.phone ? `<div class="muted">${e(company.phone)}</div>` : ""}
      </div>
      <div style="text-align:right">
        <h1>산출내역서</h1>
        <div class="muted">${formatDate(quote.createdAt)}</div>
      </div>
    </div>

    <div class="site-info">
      <div><span class="label">현장명</span>${e(quote.buildingName)}</div>
      <div><span class="label">건물유형</span>${e(quote.buildingType ?? "-")}</div>
      <div><span class="label">면적</span>${quote.areaSqm}㎡</div>
      <div><span class="label">빈도</span>주 ${quote.frequencyPerWeek}회</div>
      <div><span class="label">모드</span>${quote.mode === "private" ? "일반 견적" : "공공입찰 원가계산"}</div>
      <div><span class="label">예상 작업시간</span>${quote.estimatedHours.toFixed(1)}h</div>
      ${
        quote.mode === "public" && quote.regulationLabel
          ? `<div><span class="label">적용 기준</span>${e(quote.regulationLabel)}</div>`
          : ""
      }
    </div>

    ${
      quote.mode === "public"
        ? `<p class="muted" style="margin-top:0">본 산출내역서는 「공공부문 도급 노동자 보호지침」(2026.9.9 시행)에 따라 노무비를 별도 항목으로 구분하여 작성하였습니다.${quote.regulationLabel ? ` 노무비 단가 및 관리비·이윤율 상한은 ${e(quote.regulationLabel)} 법정기준값을 적용했습니다.` : ""}</p>`
        : ""
    }

    <h2>1. 노무비</h2>
    <table>
      <thead><tr><th>역할</th><th class="amount">인원</th><th class="amount">작업시간</th><th class="amount">금액</th></tr></thead>
      <tbody>
        ${laborRows}
        <tr class="total-row"><td colspan="3">노무비 소계</td><td class="amount">${won(quote.laborCost)}</td></tr>
      </tbody>
    </table>

    ${legalSection}

    <h2>${expenseNum}. 경비</h2>
    <table><tbody>
      <tr><td>청소용품·장비·피복·운반 등</td><td class="amount">${won(quote.expenseCost)}</td></tr>
    </tbody></table>

    <h2>${adminNum}. 일반관리비 / 이윤</h2>
    <table><tbody>
      <tr><td>일반관리비 (${appliedGeneralAdminRate.toFixed(2)}%)</td><td class="amount">${won(quote.adminCost)}</td></tr>
      <tr><td>기업이윤 (${appliedProfitRate.toFixed(2)}%)</td><td class="amount">${won(quote.profitAmount)}</td></tr>
    </tbody></table>

    <h2>합계</h2>
    <table><tbody>
      <tr><td>공급가액</td><td class="amount">${won(quote.supplyAmount)}</td></tr>
      <tr><td>부가세 (VAT)</td><td class="amount">${won(quote.vatAmount)}</td></tr>
      <tr class="total-row"><td>총액</td><td class="amount">${won(quote.quoteAmount)}</td></tr>
    </tbody></table>
  `;

  return wrapHtmlDocument(`산출내역서 - ${quote.buildingName}`, body);
}
