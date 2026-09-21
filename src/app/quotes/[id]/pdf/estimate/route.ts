import { NextResponse } from "next/server";
import { renderEstimateHtml } from "@/lib/pdf/EstimateDocument";
import { loadQuoteData } from "@/lib/pdf/loadQuoteData";
import { renderHtmlToPdf } from "@/lib/pdf/renderPdf";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadQuoteData(id);
  if (!data) return NextResponse.json({ error: "견적을 찾을 수 없습니다." }, { status: 404 });

  const html = renderEstimateHtml(data);
  const pdf = await renderHtmlToPdf(html);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="estimate-${id}.pdf"`,
    },
  });
}
