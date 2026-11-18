/** Read every page with stable primary-key ordering, including data beyond the API row limit. */
export async function readPayrollRows<T>(buildQuery: () => any, label: string): Promise<T[]> {
  const result: T[] = [];
  const pageSize = 1000;
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await buildQuery().order("id", { ascending: true }).range(start, start + pageSize - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    if (!Array.isArray(data)) throw new Error(`${label}: استجابة بيانات غير صالحة`);
    result.push(...data);
    if (data.length < pageSize) return result;
  }
}

/** Bound employee-ID filters to keep URLs within common proxy request limits. */
export async function readPayrollEmployeeRows<T>(ids: string[], buildQuery: (batch: string[]) => any, label: string): Promise<T[]> {
  const result: T[] = [];
  for (let start = 0; start < ids.length; start += 100) {
    const batch = ids.slice(start, start + 100);
    result.push(...await readPayrollRows<T>(() => buildQuery(batch), label));
  }
  return result;
}
