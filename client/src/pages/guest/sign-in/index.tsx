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
import DogHeadset from "@app/components/dog-headset";
import { Button } from "@app/components/ui/button";
import Spinner from "@app/components/spinner";

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
    formState: { isSubmitting, dirtyFields },
  } = methods;

  const onSubmit = async (data: TLoginForm) => {
    try {
      await postSession(data);
      store.auth.authenticate();
      nav(state?.to || "/");
    } catch (error) {
      errorHandler(error, (e) => {
        // Maintenance began after this page loaded: park like everyone else.
        if (e.statusCode === 503) return store.maintenance.enter();
        toast(e.message, {
          position: "bottom-left",
          icon: <TriangleAlert className="text-destructive mr-10" />,
          description: "Check the password and try again.",
        });
      });
    }
  };

  return (
    <div className="flex min-h-svh items-center gap-38 flex-col justify-start p-4">
      <FormProvider {...methods}>
        {/* No bottom margin: the artwork carries its own padding in the viewBox. */}
        <div className="pt-12 text-center">
          <h2 className="text-2xl -mb-2">dogspeak</h2>
          <DogHeadset className="text-foreground/80 mx-auto w-40 sm:w-48" />
        </div>
        <div className="text-center">
          <p className="text-sm">enter the password to join.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4">
            <div className="flex flex-col items-center gap-4">
              <RHFInput
                name="password"
                className="text-center"
                type="password"
                autoFocus
              />
              {dirtyFields.password && (
                <Button
                  variant="outline"
                  type="submit"
                  className="w-max"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Spinner label="signing in" />
                  ) : (
                    <ChevronRight />
                  )}
                </Button>
              )}
            </div>
          </form>
        </div>
      </FormProvider>
    </div>
  );
};

export default SignIn;
