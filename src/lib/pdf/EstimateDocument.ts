import { escapeHtml, wrapHtmlDocument } from "./html";
import { formatDate, won, type PdfQuoteData } from "./types";

/** 견적서 — 고객에게 보여주는 요약본. */
export function renderEstimateHtml(data: PdfQuoteData): string {
  const { company, quote } = data;
  const e = escapeHtml;

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
        <h1>견적서</h1>
        <div class="muted">${formatDate(quote.createdAt)}</div>
      </div>
    </div>

    <h2>현장 정보</h2>
    <div class="site-info">
      <div><span class="label">현장명</span>${e(quote.buildingName)}</div>
      <div><span class="label">건물유형</span>${e(quote.buildingType ?? "-")}</div>
      <div><span class="label">면적</span>${quote.areaSqm}㎡</div>
      <div><span class="label">빈도</span>주 ${quote.frequencyPerWeek}회</div>
      <div><span class="label">예상 작업시간</span>${quote.estimatedHours.toFixed(1)}h</div>
      <div><span class="label">투입 인원</span>${quote.estimatedWorkers}명</div>
    </div>

    <h2>견적 내역</h2>
    <table>
      <thead><tr><th>항목</th><th class="amount">금액</th></tr></thead>
      <tbody>
        <tr><td>직접노무비</td><td class="amount">${won(quote.laborCost)}</td></tr>
        ${quote.legalCost > 0 ? `<tr><td>법정비용</td><td class="amount">${won(quote.legalCost)}</td></tr>` : ""}
        <tr><td>현장경비</td><td class="amount">${won(quote.expenseCost)}</td></tr>
        <tr><td>일반관리비</td><td class="amount">${won(quote.adminCost)}</td></tr>
        <tr><td>기업이윤</td><td class="amount">${won(quote.profitAmount)}</td></tr>
        <tr><td>공급가액</td><td class="amount">${won(quote.supplyAmount)}</td></tr>
        <tr><td>부가세 (VAT)</td><td class="amount">${won(quote.vatAmount)}</td></tr>
        <tr class="total-row"><td>합계</td><td class="amount">${won(quote.quoteAmount)}</td></tr>
      </tbody>
    </table>

    <div class="final-amount">
      <div class="muted">최종 견적 금액</div>
      <div class="amount">${won(quote.quoteAmount)}</div>
    </div>
  `;

  return wrapHtmlDocument(`견적서 - ${quote.buildingName}`, body);
}
