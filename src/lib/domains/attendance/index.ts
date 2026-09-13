import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type {
  AttendanceCorrectionRequest,
  DailyAttendanceRecord,
  OvertimeRecord,
} from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import { recordAttendance } from "../../data/hrms-repository";
import { processAttendanceServer } from "../../business/attendance.functions";
import { queryKeys } from "../../query/query-keys";
import { useBootstrapData } from "../bootstrap/use-bootstrap";
import { demoStore, useDemoStore } from "../demo/demo-store";
import { toast } from "sonner";

export function useAttendance() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const bootstrap = useBootstrapData();
  const demoData = useDemoStore((s) => ({
    attendanceRecords: s.attendanceRecords,
    overtimeRecords: s.overtimeRecords,
    attendanceCorrections: s.attendanceCorrections,
  }));

  const attendanceRecords = isLive ? bootstrap.attendanceRecords : demoData.attendanceRecords;
  const overtimeRecords = isLive ? bootstrap.overtimeRecords : demoData.overtimeRecords;
  const attendanceCorrections = isLive
    ? bootstrap.attendanceCorrections
    : demoData.attendanceCorrections;

  return {
    attendanceRecords,
    overtimeRecords,
    attendanceCorrections,
    isLoading: isLive ? bootstrap.isLoading : false,
    isError: isLive ? bootstrap.isError : false,
    error: isLive ? bootstrap.error : null,
    refetch: bootstrap.refreshCoreData,
  };
}

export function useAttendanceMutations() {
  const { session, isDemo } = useAuth();
  const isLive = Boolean(session && !isDemo);
  const queryClient = useQueryClient();

  const punchInOut = useCallback(
    async (
      type: "in" | "out",
      coords?: { lat: number; lng: number },
      employeeId?: string,
    ): Promise<{ success: boolean; message: string; geofenceValid: boolean }> => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const today = now.toISOString().split("T")[0];
      const empId = employeeId || demoStore.employees[0]?.id || "emp-01";

      if (!isLive) {
        const emp = demoStore.employees.find((e) => e.id === empId);
        const existingIndex = demoStore.attendanceRecords.findIndex(
          (r) => r.workDate === today && r.employeeId === empId,
        );

        if (type === "in") {
          if (existingIndex >= 0) {
            demoStore.attendanceRecords[existingIndex].actualIn = timeStr;
          } else {
            demoStore.attendanceRecords = [
              {
                id: `att-${Date.now()}`,
                employeeId: empId,
                employeeNo: emp?.employeeNo || "EMP-001",
                employeeName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : "الموظف",
                departmentName: emp?.departmentName || "عام",
                workDate: today,
                actualIn: timeStr,
                status: "present",
                lateMinutes: 0,
                earlyDepartureMinutes: 0,
                workedHours: 8,
                overtimeHours: 0,
                punchSource: "mobile_gps",
                geofenceValid: true,
                violationsCount: 0,
                reviewedByPayroll: false,
              },
              ...demoStore.attendanceRecords,
            ];
          }
          demoStore.notify();
          return {
            success: true,
            message: `تم تسجيل الدخول بنجاح الساعة ${timeStr}`,
            geofenceValid: true,
          };
        } else {
          if (existingIndex >= 0) {
            demoStore.attendanceRecords[existingIndex].actualOut = timeStr;
            demoStore.notify();
            return {
              success: true,
              message: `تم تسجيل الانصراف بنجاح الساعة ${timeStr}`,
              geofenceValid: true,
            };
          }
          return {
            success: false,
            message: "لم يتم العثور على حركة حضور سابقة لهذا اليوم",
            geofenceValid: true,
          };
        }
      }

      try {
        await recordAttendance(empId, type, today, timeStr);
        await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        return {
          success: true,
          message: `تم تسجيل ${type === "in" ? "الحضور" : "الانصراف"} بنجاح في النظام`,
          geofenceValid: true,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "تعذر تسجيل البصمة";
        return { success: false, message: msg, geofenceValid: false };
      }
    },
    [isLive, queryClient],
  );

  const submitAttendanceCorrection = useCallback(
    async (payload: {
      workDate: string;
      correctIn?: string;
      correctOut?: string;
      reason: string;
      employeeId?: string;
    }): Promise<boolean> => {
      const empId = payload.employeeId || demoStore.employees[0]?.id || "emp-01";
      const emp = demoStore.employees.find((e) => e.id === empId);

      const newCorrection: AttendanceCorrectionRequest = {
        id: `corr-${Date.now()}`,
        employeeId: empId,
        employeeNo: emp?.employeeNo || "EMP-001",
        employeeName: emp ? `${emp.firstNameAr} ${emp.lastNameAr}` : "موظف",
        departmentName: emp?.departmentName || "عام",
        workDate: payload.workDate,
        originalIn: "08:00",
        originalOut: "17:00",
        correctInTime: payload.correctIn || "08:00",
        correctOutTime: payload.correctOut || "17:00",
        reason: payload.reason,
        status: "pending",
        submittedAt: new Date().toISOString(),
      };
      if (!isLive) {
        demoStore.attendanceCorrections = [newCorrection, ...demoStore.attendanceCorrections];
        demoStore.notify();
        toast.success("تم رفع طلب تصحيح البصمة بنجاح");
        return true;
      }
      try {
        await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.corrections() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم إرسال طلب تصحيح البصمة للمراجعة");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر إرسال طلب التصحيح");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const approveAttendanceCorrection = useCallback(
    async (id: string): Promise<boolean> => {
      if (!isLive) {
        demoStore.attendanceCorrections = demoStore.attendanceCorrections.map((c) =>
          c.id === id ? { ...c, status: "approved" as const } : c,
        );
        demoStore.notify();
        toast.success("تم اعتماد تصحيح البصمة");
        return true;
      }
      try {
        await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.corrections() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم اعتماد تصحيح البصمة");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر اعتماد طلب التصحيح");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const rejectAttendanceCorrection = useCallback(
    async (id: string): Promise<boolean> => {
      if (!isLive) {
        demoStore.attendanceCorrections = demoStore.attendanceCorrections.map((c) =>
          c.id === id ? { ...c, status: "rejected" as const } : c,
        );
        demoStore.notify();
        toast.success("تم رفض طلب تصحيح البصمة");
        return true;
      }
      try {
        await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.corrections() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم رفض طلب تصحيح البصمة");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر رفض طلب التصحيح");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const submitOvertimeRequest = useCallback(
    async (record: Omit<OvertimeRecord, "id" | "status" | "createdAt">): Promise<boolean> => {
      const newOT: OvertimeRecord = {
        ...record,
        id: `ot-${Date.now()}`,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      if (!isLive) {
        demoStore.overtimeRecords = [newOT, ...demoStore.overtimeRecords];
        demoStore.notify();
        toast.success("تم رفع طلب العمل الإضافي بنجاح");
        return true;
      }
      try {
        await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.overtime() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم إرسال طلب العمل الإضافي للموافقة");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر رفع طلب العمل الإضافي");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const approveOvertimeRequest = useCallback(
    async (id: string): Promise<boolean> => {
      if (!isLive) {
        demoStore.overtimeRecords = demoStore.overtimeRecords.map((o) =>
          o.id === id ? { ...o, status: "approved" as const } : o,
        );
        demoStore.notify();
        toast.success("تمت الموافقة على طلب العمل الإضافي");
        return true;
      }
      try {
        await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.overtime() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تمت الموافقة على العمل الإضافي");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر اعتماد العمل الإضافي");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const rejectOvertimeRequest = useCallback(
    async (id: string): Promise<boolean> => {
      if (!isLive) {
        demoStore.overtimeRecords = demoStore.overtimeRecords.map((o) =>
          o.id === id ? { ...o, status: "rejected" as const } : o,
        );
        demoStore.notify();
        toast.success("تم رفض طلب العمل الإضافي");
        return true;
      }
      try {
        await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.overtime() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success("تم رفض طلب العمل الإضافي");
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر رفض العمل الإضافي");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  const processAttendance = useCallback(
    async (fromDate: string, toDate: string): Promise<boolean> => {
      if (!isLive) {
        toast.success(`تمت معالجة سجلات الحضور للفترة من ${fromDate} إلى ${toDate} بنجاح`);
        return true;
      }
      try {
        await processAttendanceServer({ data: { fromDate, toDate } });
        await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
        await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
        toast.success(`تمت معالجة سجلات الحضور بنجاح`);
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "تعذر معالجة سجلات الحضور");
        throw err;
      }
    },
    [isLive, queryClient],
  );

  return {
    punchInOut,
    submitAttendanceCorrection,
    approveAttendanceCorrection,
    rejectAttendanceCorrection,
    submitOvertimeRequest,
    approveOvertimeRequest,
    rejectOvertimeRequest,
    processAttendance,
  };
}
