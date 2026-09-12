import { describe, expect, it } from "vitest";
import { parseBiometricPayload } from "./biometric-payload";

const valid = {
  device_id: "device-1",
  token: "test-device-token",
  employee_no: "E-1",
  punch_type: "in",
  punch_time: "2026-09-10T08:30:00+03:00",
};

describe("biometric public input validation", () => {
  it("accepts documented fields and explicit time zones", () => {
    expect(parseBiometricPayload(valid, null).success).toBe(true);
  });
  it("accepts a header token and employee id", () => {
    expect(
      parseBiometricPayload(
        {
          ...valid,
          token: undefined,
          employee_no: undefined,
          employee_id: "employee-id",
          punch_type: "out",
          punch_time: undefined,
        },
        "header-token",
      ).success,
    ).toBe(true);
  });
  it.each([
    null,
    [],
    "text",
    { ...valid, device_id: 1 },
    { ...valid, token: "" },
    { ...valid, employee_no: undefined },
    { ...valid, punch_type: "unknown" },
    { ...valid, punch_time: "invalid" },
    { ...valid, punch_time: "2026-09-10T08:30:00" },
    { ...valid, latitude: 91, longitude: 0 },
    { ...valid, latitude: 0 },
    { ...valid, latitude: "24", longitude: 46 },
  ])("rejects malformed payload %j", (payload) => {
    expect(parseBiometricPayload(payload, null).success).toBe(false);
  });
  it("accepts a valid location pair", () => {
    expect(parseBiometricPayload({ ...valid, latitude: 24.7, longitude: 46.7 }, null).success).toBe(
      true,
    );
  });
});
