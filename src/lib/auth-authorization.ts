type AuthUser = {
  id: string;
  email?: string | null;
};

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function getAuthorizedEmails() {
  return new Set(
    (process.env.AUTHORIZED_EMAILS ?? "")
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean),
  );
}

export function isAuthorizedEmail(email: string | null | undefined) {
  const normalized = normalizeEmail(email);
  return Boolean(normalized && getAuthorizedEmails().has(normalized));
}

export function isAuthorizedUser(
  user: AuthUser | null | undefined,
): user is AuthUser {
  return Boolean(user?.id && isAuthorizedEmail(user.email));
}
