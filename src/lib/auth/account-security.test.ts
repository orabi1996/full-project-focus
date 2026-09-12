import { expect, it, vi } from "vitest";
import { changeAccountPassword } from "./account-security";

const user = { id: "user-1", email: "test@example.invalid" };
const setup = () => ({
  signInWithPassword: vi.fn().mockResolvedValue({ data: { user }, error: null }),
  updateUser: vi.fn().mockResolvedValue({ error: null }),
});
it("updates only after verifying the current account credentials", async () => {
  const auth = setup();
  await changeAccountPassword(auth, user, "old-value", "new-value");
  expect(auth.signInWithPassword).toHaveBeenCalledWith({
    email: user.email,
    password: "old-value",
  });
  expect(auth.updateUser).toHaveBeenCalledWith({ password: "new-value" });
});
it.each([
  { data: { user: null }, error: { message: "invalid credentials" } },
  { data: { user: { id: "different-account" } }, error: null },
])("does not change a password without confirming the same account", async (result) => {
  const auth = setup();
  auth.signInWithPassword.mockResolvedValue(result);
  await expect(changeAccountPassword(auth, user, "old-value", "new-value")).rejects.toThrow();
  expect(auth.updateUser).not.toHaveBeenCalled();
});
it("reports provider rejection instead of a false success", async () => {
  const auth = setup();
  auth.updateUser.mockResolvedValue({ error: { message: "reauthentication required" } });
  await expect(changeAccountPassword(auth, user, "old-value", "new-value")).rejects.toThrow(
    "تعذر تحديث",
  );
});
it("propagates network failure without claiming completion", async () => {
  const auth = setup();
  auth.signInWithPassword.mockRejectedValue(new Error("offline"));
  await expect(changeAccountPassword(auth, user, "old-value", "new-value")).rejects.toThrow(
    "offline",
  );
  expect(auth.updateUser).not.toHaveBeenCalled();
});
