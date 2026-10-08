import axiosInstance from "@app/lib/axios";

// GET /status — unauthenticated, always 200 { maintenance } while the server
// is up. The client's source of truth for maintenance mode.
export const getStatus = () =>
  axiosInstance.get<{ maintenance: boolean }>("/status");
