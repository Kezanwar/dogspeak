import { BASE_URL } from "@app/config";
import axios, { AxiosError } from "axios";

export type ErrorObject = {
  message: string;
  statusCode: number;
};

const genericErrorMsg = "Something went wrong";

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // send + receive the httpOnly session cookie
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    return Promise.reject({
      message: error.response?.data?.message || genericErrorMsg,
      statusCode: error.response?.status ?? 500,
    } as ErrorObject);
  },
);

export default axiosInstance;

export const errorHandler = (
  error: unknown,
  onError: (errorObj: ErrorObject) => void,
): void => {
  if (error instanceof Error) {
    return onError({
      message: error.message || genericErrorMsg,
      statusCode: 500,
    });
  }

  const apiErr = error as ErrorObject;

  if (apiErr?.message) {
    return onError(apiErr);
  }

  if (typeof error === "string") {
    return onError({ message: error || genericErrorMsg, statusCode: 500 });
  }

  return onError({ message: genericErrorMsg, statusCode: 500 });
};
