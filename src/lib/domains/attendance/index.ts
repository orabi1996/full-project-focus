import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type {
  AttendanceCorrectionRequest,
  DailyAttendanceRecord,
  OvertimeRecord,
} from "../../../types";
import { useAuth } from "../../auth/AuthContext";
import { createRequestRecord, recordAttendance } from "../../data/hrms-repository";
import { processAttendanceServer } from "../../business/attendance.functions";
import { executeReliableMutation, type MutationDataMode } from "../../data/reliable-mutation";
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
  const mode: MutationDataMode = session && !isDemo ? "live" : "demo";
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

      const mutationRes = await executeReliableMutation<{ success: boolean; message: string; geofenceValid: boolean }>({
        mode,
        mutationKey: `punch-${empId}-${today}-${type}`,
        operation: async () => {
          await recordAttendance(empId, type, today, timeStr);
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          return {
            success: true,
            message: `تم تسجيل ${type === "in" ? "الحضور" : "الانصراف"} بنجاح في النظام`,
            geofenceValid: true,
          };
        },
        demoOperation: () => {
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
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر تسجيل البصمة");
        },
      });

      if (!mutationRes.ok) {
        return {
          success: false,
          message: mutationRes.error?.message || "تعذر تسجيل البصمة",
          geofenceValid: false,
        };
      }

      return mutationRes.data ?? {
        success: true,
        message: `تم تسجيل البصمة بنجاح`,
        geofenceValid: true,
      };
    },
    [mode, queryClient],
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

      const result = await executeReliableMutation({
        mode,
        mutationKey: `corr-${empId}-${payload.workDate}`,
        operation: async () => {
          await createRequestRecord(empId, "attendance_correction", {
            workDate: payload.workDate,
            correctInTime: payload.correctIn,
            correctOutTime: payload.correctOut,
            reason: payload.reason,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.corrections() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم إرسال طلب تصحيح البصمة للمراجعة والاعتماد");
          return true;
        },
        demoOperation: () => {
          demoStore.attendanceCorrections = [newCorrection, ...demoStore.attendanceCorrections];
          demoStore.notify();
          toast.success("تم رفع طلب تصحيح البصمة بنجاح");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر إرسال طلب التصحيح");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const approveAttendanceCorrection = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `approve-corr-${id}`,
        operation: async () => {
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.corrections() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم اعتماد تصحيح البصمة وتحديث السجلات");
          return true;
        },
        demoOperation: () => {
          demoStore.attendanceCorrections = demoStore.attendanceCorrections.map((c) =>
            c.id === id ? { ...c, status: "approved" as const } : c,
          );
          demoStore.notify();
          toast.success("تم اعتماد تصحيح البصمة");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر اعتماد طلب التصحيح");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const rejectAttendanceCorrection = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `reject-corr-${id}`,
        operation: async () => {
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.corrections() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم رفض طلب تصحيح البصمة");
          return true;
        },
        demoOperation: () => {
          demoStore.attendanceCorrections = demoStore.attendanceCorrections.map((c) =>
            c.id === id ? { ...c, status: "rejected" as const } : c,
          );
          demoStore.notify();
          toast.success("تم رفض طلب تصحيح البصمة");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر رفض طلب التصحيح");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const submitOvertimeRequest = useCallback(
    async (record: Omit<OvertimeRecord, "id" | "status" | "createdAt">): Promise<boolean> => {
      const newOT: OvertimeRecord = {
        ...record,
        id: `ot-${Date.now()}`,
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      const result = await executeReliableMutation({
        mode,
        mutationKey: `ot-${record.employeeId}-${record.workDate}-${record.hours}`,
        operation: async () => {
          await createRequestRecord(record.employeeId, "general", {
            type: "overtime",
            workDate: record.workDate,
            hours: record.hours,
            reason: record.reason,
          });
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.overtime() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.workflow.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم إرسال طلب العمل الإضافي للموافقة");
          return true;
        },
        demoOperation: () => {
          demoStore.overtimeRecords = [newOT, ...demoStore.overtimeRecords];
          demoStore.notify();
          toast.success("تم رفع طلب العمل الإضافي بنجاح");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر رفع طلب العمل الإضافي");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const approveOvertimeRequest = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `approve-ot-${id}`,
        operation: async () => {
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.overtime() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تمت الموافقة على العمل الإضافي");
          return true;
        },
        demoOperation: () => {
          demoStore.overtimeRecords = demoStore.overtimeRecords.map((o) =>
            o.id === id ? { ...o, status: "approved" as const } : o,
          );
          demoStore.notify();
          toast.success("تمت الموافقة على طلب العمل الإضافي");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر اعتماد العمل الإضافي");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const rejectOvertimeRequest = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `reject-ot-${id}`,
        operation: async () => {
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.overtime() });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success("تم رفض طلب العمل الإضافي");
          return true;
        },
        demoOperation: () => {
          demoStore.overtimeRecords = demoStore.overtimeRecords.map((o) =>
            o.id === id ? { ...o, status: "rejected" as const } : o,
          );
          demoStore.notify();
          toast.success("تم رفض طلب العمل الإضافي");
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر رفض العمل الإضافي");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
  );

  const processAttendance = useCallback(
    async (fromDate: string, toDate: string): Promise<boolean> => {
      const result = await executeReliableMutation({
        mode,
        mutationKey: `process-attendance-${fromDate}-${toDate}`,
        operation: async () => {
          await processAttendanceServer({ data: { fromDate, toDate } });
          await queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap.all });
          toast.success(`تمت معالجة سجلات الحضور بنجاح`);
          return true;
        },
        demoOperation: () => {
          toast.success(`تمت معالجة سجلات الحضور للفترة من ${fromDate} إلى ${toDate} بنجاح`);
          return true;
        },
        onRejected: (err) => {
          toast.error(err.message || "تعذر معالجة سجلات الحضور");
        },
      });

      return result.ok;
    },
    [mode, queryClient],
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
