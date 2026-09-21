export interface PdfLineItem {
  category: string;
  label: string;
  amount: number;
  roleName: string | null;
  workerCount: number | null;
}

export interface PdfQuoteData {
  company: {
    name: string;
    businessRegistrationNumber: string | null;
    representativeName: string | null;
    address: string | null;
    phone: string | null;
    logoUrl: string | null;
  };
  quote: {
    buildingName: string;
    buildingType: string | null;
    areaSqm: number;
    frequencyPerWeek: number;
    mode: "private" | "public";
    regulationLabel: string | null;
    estimatedHours: number;
    estimatedWorkers: number;
    laborCost: number;
    legalCost: number;
    expenseCost: number;
    adminCost: number;
    profitAmount: number;
    supplyAmount: number;
    vatAmount: number;
    quoteAmount: number;
    createdAt: string;
  };
  lineItems: PdfLineItem[];
}

export function won(amount: number): string {
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}
