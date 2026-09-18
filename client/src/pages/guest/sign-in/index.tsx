import { Card, CardContent, CardTitle } from "@app/components/ui/card";
import { ChevronRight, TriangleAlert } from "lucide-react";
import { useForm, FormProvider } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { LoginSchema, type TLoginForm } from "@app/validation/auth";
import RHFInput from "@app/components/hook-form/rhf-input";
import { postSession } from "@app/api/auth";
import store from "@app/stores";
import { useLocation, useNavigate } from "react-router";
import { errorHandler } from "@app/lib/axios";
import { toast } from "sonner";
import SHSFUIButton from "@app/components/shsfui/button";

const SignIn = () => {
  const nav = useNavigate();
  const { state } = useLocation();

  const methods = useForm<TLoginForm>({
    resolver: yupResolver(LoginSchema),
    defaultValues: {
      password: "",
    },
    mode: "onSubmit",
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = async (data: TLoginForm) => {
    try {
      await postSession(data);
      store.auth.authenticate();
      nav(state?.to || "/");
    } catch (error) {
      errorHandler(error, (e) =>
        toast(e.message, {
          position: "bottom-left",
          icon: <TriangleAlert className="text-destructive mr-10" />,
          description: "Check the password and try again.",
        }),
      );
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      <FormProvider {...methods}>
        <Card className="w-full max-w-sm">
          <CardContent className="text-center">
            <CardTitle className="mb-2">dogspeak</CardTitle>
            <p className="text-muted-foreground text-sm">
              enter the password to join.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
              <div className="flex flex-col gap-5">
                <RHFInput
                  name="password"
                  // label="password"
                  className="text-center"
                  type="password"
                  placeholder="try me...."
                  autoFocus
                  // autoComplete="current-password"
                />
                <SHSFUIButton
                  icon={<ChevronRight />}
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Joining…" : "Join"}
                </SHSFUIButton>
              </div>
            </form>
          </CardContent>
        </Card>
      </FormProvider>
    </div>
  );
};

export default SignIn;
