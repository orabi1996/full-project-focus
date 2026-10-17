/**
 * Employee AI Summary — HR-only server function
 * Generates a concise operational summary of an employee record via Lovable AI Gateway.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "../../integrations/supabase/auth-middleware";
import { assertRole } from "./guards";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";

interface SummaryEmployeeRow {
  id: string;
  employee_no: string;
  full_name: string;
  job_title: string;
  position_title: string | null;
  contract_type: string;
  status: string;
  hire_date: string;
  probation_end_date: string | null;
  nationality: string | null;
  basic_salary: number;
  total_salary: number;
  completion_score: number;
  department_id: string | null;
  manager_id: string | null;
}

export const generateEmployeeAiSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { employeeId: string }) => {
    if (!input?.employeeId) throw new Error("يرجى اختيار الموظف أولاً");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // HR-only: super_admin, org_admin, hr_manager, line_manager
    await assertRole(supabase, userId, [
      "super_admin",
      "org_admin",
      "hr_manager",
      "line_manager",
    ]);

    const { data: employee, error } = await supabase
      .from("employees")
      .select(
        "id, employee_no, full_name, job_title, position_title, contract_type, status, hire_date, probation_end_date, nationality, basic_salary, total_salary, completion_score, department_id, manager_id"
      )
      .eq("id", data.employeeId)
      .single();

    if (error || !employee) throw new Error("تعذر العثور على ملف الموظف المحدد");
    const emp = employee as unknown as SummaryEmployeeRow;

    let departmentName: string | null = null;
    if (emp.department_id) {
      const { data: dept } = await supabase
        .from("departments")
        .select("name_ar, name_en")
        .eq("id", emp.department_id)
        .maybeSingle();
      const d = dept as { name_ar?: string; name_en?: string } | null;
      departmentName = d?.name_ar || d?.name_en || null;
    }

    let managerName: string | null = null;
    if (emp.manager_id) {
      const { data: mgr } = await supabase
        .from("employees")
        .select("full_name")
        .eq("id", emp.manager_id)
        .maybeSingle();
      managerName = (mgr as { full_name?: string } | null)?.full_name || null;
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("مفتاح خدمة الذكاء الاصطناعي غير مكوّن");

    const record = {
      "الرقم الوظيفي": emp.employee_no,
      "الاسم": emp.full_name,
      "المسمى الوظيفي": emp.job_title,
      "المنصب": emp.position_title,
      "الإدارة": departmentName,
      "المدير المباشر": managerName,
      "نوع العقد": emp.contract_type,
      "الحالة": emp.status,
      "تاريخ التعيين": emp.hire_date,
      "نهاية فترة التجربة": emp.probation_end_date,
      "الجنسية": emp.nationality,
      "الراتب الأساسي": emp.basic_salary,
      "إجمالي الراتب": emp.total_salary,
      "اكتمال الملف %": emp.completion_score,
    };

    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        instructions:
          "أنت مساعد موارد بشرية مؤسسي. أنشئ ملخصًا عمليًا موجزًا بالعربية لملف الموظف من البيانات المرفقة فقط، دون اختلاق أي معلومة. نظّم الملخص في نقاط قصيرة: الهوية الوظيفية، الوضع التعاقدي وفترة التجربة، الهيكل التنظيمي، الحزمة المالية، وأي ملاحظات متابعة مستحقة (مثل قرب انتهاء التجربة أو اكتمال الملف).",
        input: `بيانات الموظف:\n${JSON.stringify(record, null, 2)}`,
        reasoning: { effort: "low" },
        store: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      if (response.status === 402 || response.status === 403) {
        throw new Error("رصيد الذكاء الاصطناعي غير كافٍ أو الوصول موقوف — يرجى مراجعة إعدادات الأرصدة");
      }
      if (response.status === 429) {
        throw new Error("الخدمة مشغولة حاليًا، يرجى المحاولة بعد قليل");
      }
      throw new Error(`تعذر إنشاء الملخص الذكي (${response.status})`);
    }

    // Consume the SSE stream server-side and accumulate final text.
    const reader = response.body?.getReader();
    if (!reader) throw new Error("تعذر قراءة استجابة خدمة الذكاء الاصطناعي");

    const decoder = new TextDecoder();
    let buffer = "";
    let summary = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() || "";
      for (const frame of frames) {
        const dataLine = frame
          .split("\n")
          .find((l) => l.startsWith("data:"));
        if (!dataLine) continue;
        const payload = dataLine.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload) as {
            type?: string;
            delta?: string;
          };
          if (evt.type === "response.output_text.delta" && evt.delta) {
            summary += evt.delta;
          }
        } catch {
          // ignore non-JSON frames (pings, comments)
        }
      }
    }

    if (!summary.trim()) {
      throw new Error("لم تُرجع خدمة الذكاء الاصطناعي ملخصًا — يرجى المحاولة مجددًا");
    }

    return {
      summary: summary.trim(),
      employeeName: emp.full_name,
      employeeNo: emp.employee_no,
      model: MODEL,
      generatedAt: new Date().toISOString(),
    };
  });

export const listEmployeesForSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertRole(supabase, userId, [
      "super_admin",
      "org_admin",
      "hr_manager",
      "line_manager",
    ]);
    const { data, error } = await supabase
      .from("employees")
      .select("id, employee_no, full_name, job_title, status")
      .order("full_name", { ascending: true })
      .limit(200);
    if (error) throw new Error("تعذر تحميل قائمة الموظفين");
    return data ?? [];
  });
