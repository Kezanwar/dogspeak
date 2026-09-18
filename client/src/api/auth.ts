import { type TLoginForm } from "@app/validation/auth";
import axiosInstance from "@app/lib/axios";

// All three hit the /session resource and reply 204 No Content — auth state
// lives entirely in the httpOnly cookie, so there's no response body to type.
// A rejected promise (401) is how "not authenticated" / "wrong password" surface.

// POST /session — log in with the shared password. Sets the cookie on success.
export const postSession = (data: TLoginForm) =>
  axiosInstance.post("/session", data);

// GET /session — auto-login: is the existing cookie still valid? Also slides it.
export const getSession = () => axiosInstance.get<{ ok: boolean }>("/session");

// DELETE /session — log out: clears the cookie.
export const deleteSession = () => axiosInstance.delete("/session");
