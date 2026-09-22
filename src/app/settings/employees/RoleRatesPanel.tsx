import { RoleRateRow } from "./RoleRateRow";

interface RoleRate {
  role_name: string;
  standard_hourly_rate: number;
  is_manual_override: boolean;
}

export function RoleRatesPanel({ rates }: { rates: RoleRate[] }) {
  return (
    <div className="card">
      <h2>역할별 표준원가</h2>
      {rates.length > 0 ? (
        <div className="rate-rows">
          {rates.map((rate) => (
            <RoleRateRow
              key={rate.role_name}
              roleName={rate.role_name}
              rate={rate.standard_hourly_rate}
              isManual={rate.is_manual_override}
            />
          ))}
        </div>
      ) : (
        <p className="empty-hint">직원을 추가하면 역할별 표준원가가 자동으로 계산됩니다.</p>
      )}
    </div>
  );
}
