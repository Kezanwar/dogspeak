import { object, string, type InferType } from "yup";

export const LoginSchema = object().shape({
  password: string().required("Password is required"),
});

export type TLoginForm = InferType<typeof LoginSchema>;
