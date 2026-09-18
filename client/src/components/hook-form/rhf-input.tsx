import * as React from "react";
import { useFormContext, Controller } from "react-hook-form";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { cn } from "@app/lib/utils";
import { Typography } from "../ui/typography";
import { Label } from "../ui/label";

type RHFInputProps = {
  name: string;
  label?: string;
  placeholder?: string;
  type?: string;
  as?: "input" | "textarea";
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  className?: string;
  autoFocus: boolean;
};

const RHFInput = ({
  name,
  label,
  placeholder,
  type = "text",
  as = "input",
  className,
  endIcon,
  autoFocus = false,
}: RHFInputProps) => {
  const { control, formState } = useFormContext();
  const error = formState.errors?.[name]?.message as string | undefined;

  const Wrapper = as === "textarea" ? Textarea : Input;

  return (
    <div className="grid">
      {label && (
        <Label className="mb-2.5" htmlFor={name}>
          {label}
        </Label>
      )}

      <div className="relative">
        <Controller
          name={name}
          control={control}
          render={({ field }) => (
            <Wrapper
              id={name}
              type={type}
              placeholder={placeholder}
              autoFocus={autoFocus}
              {...field}
              value={field.value ?? ""}
              className={cn(
                className,
                endIcon && "pr-10",
                error && "border-destructive",
              )}
            />
          )}
        />

        {endIcon && (
          <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer">
            {endIcon}
          </span>
        )}
      </div>

      {error && (
        <Typography className="mt-1 text-xs text-balance" color="destructive">
          {error}
        </Typography>
      )}
    </div>
  );
};

export default RHFInput;
