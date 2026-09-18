import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@app/components/ui/select';
import { useFormContext, Controller } from 'react-hook-form';
import { Label } from '@app/components/ui/label';
import { Typography } from '../ui/typography';

type Option = {
  label: string;
  value: string;
};

type RHFSelectProps = {
  name: string;
  label?: string;
  placeholder?: string;
  options: Option[];
  className?: string;
  disabled?: boolean;
};

const RHFSelect = ({
  name,
  label,
  placeholder = 'Select...',
  options,
  className,
  disabled
}: RHFSelectProps) => {
  const { control, formState } = useFormContext();
  const error = formState.errors?.[name]?.message as string | undefined;

  return (
    <div className="grid">
      {label && (
        <Label className="mb-2.5" htmlFor={name}>
          {label}
        </Label>
      )}
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select
            disabled={disabled}
            value={field.value}
            onValueChange={field.onChange}
          >
            <SelectTrigger className={className} aria-invalid={!!error}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />

      {error && (
        <Typography className="mt-1 text-xs text-balance" color="destructive">
          {error}
        </Typography>
      )}
    </div>
  );
};

export default RHFSelect;
