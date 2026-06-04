export const getLoginUrl = () => "/login";

export const login = async (email: string, password: string) => {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Login failed");
  }

  return data;
};

export const logout = async () => {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
};