export const BASE_URL = import.meta.env.VITE_API_BASE_URL;
export const WS_URL = BASE_URL.replace(/^http/, "ws");

export const IS_DEV = import.meta.env.VITE_APP_ENV === "development";
