import { clearRoleRateOverride, setRoleRateOverride } from "@/app/actions/roleRates";

interface RoleRate {
  role_name: string;
  standard_hourly_rate: number;
  is_manual_override: boolean;
}

export function RoleRatesPanel({ rates }: { rates: RoleRate[] }) {
  if (rates.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        직원을 추가하면 역할별 표준원가가 자동으로 계산됩니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rates.map((rate) => (
        <div
          key={rate.role_name}
          className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 px-3 py-2 text-sm"
        >
          <span className="w-24 font-medium">{rate.role_name}</span>
          <span className="text-gray-500">
            {Math.round(rate.standard_hourly_rate).toLocaleString()}원/h
            {rate.is_manual_override ? " (수동)" : " (자동계산)"}
          </span>

          <form action={setRoleRateOverride} className="flex items-center gap-2">
            <input type="hidden" name="role_name" value={rate.role_name} />
            <input
              type="number"
              name="standard_hourly_rate"
              defaultValue={Math.round(rate.standard_hourly_rate)}
              className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
            <button type="submit" className="text-xs underline">
              수동 설정
            </button>
          </form>

          {rate.is_manual_override && (
            <form action={clearRoleRateOverride}>
              <input type="hidden" name="role_name" value={rate.role_name} />
              <button type="submit" className="text-xs text-gray-500 underline">
                자동계산으로 되돌리기
              </button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}
