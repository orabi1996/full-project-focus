type AuthError = { message: string } | null;
interface PasswordAuth {
  signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{ data: { user: { id: string } | null }; error: AuthError }>;
  updateUser(attributes: { password: string }): Promise<{ error: AuthError }>;
}

export async function changeAccountPassword(
  auth: PasswordAuth,
  user: { id: string; email: string },
  currentPassword: string,
  newPassword: string,
) {
  const confirmation = await auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (confirmation.error || confirmation.data.user?.id !== user.id) {
    throw new Error("تعذر التحقق من كلمة المرور الحالية.");
  }
  const result = await auth.updateUser({ password: newPassword });
  if (result.error) throw new Error("تعذر تحديث كلمة المرور. راجع سياسة أمان الحساب وحاول مجددًا.");
}
