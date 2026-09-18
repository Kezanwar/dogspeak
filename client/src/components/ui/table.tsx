import * as React from 'react';
import type { Column } from '@tanstack/react-table';
import { ArrowUp, ArrowDown } from 'lucide-react';

import { cn } from '@app/lib/utils';

function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        // '[&_tr]:bg-muted/80 dark:[&_tr]:bg-muted/30 [&_tr]:border-b',
        className
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        'bg-muted/50 border-t font-medium [&>tr]:last:border-b-0',
        className
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors',
        className
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'text-foreground h-12 text-left align-middle font-semibold whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'h-12 align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]',
        className
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('text-muted-foreground mt-4 text-sm', className)}
      {...props}
    />
  );
}

interface TableHeaderWithIconProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

function TableHeaderWithIcon({
  children,
  icon,
  className
}: TableHeaderWithIconProps) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </div>
  );
}

interface SortableHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

function SortableHeader<TData, TValue>({
  column,
  children,
  className,
  icon
}: SortableHeaderProps<TData, TValue>) {
  const sortState = column.getIsSorted();

  return (
    <button
      className={cn('flex items-center gap-1.5', className)}
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
      {sortState === 'asc' ? (
        <ArrowUp size={14} />
      ) : sortState === 'desc' ? (
        <ArrowDown size={14} />
      ) : (
        <ArrowUp size={14} className="text-gray-400" />
      )}
    </button>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableHeaderWithIcon,
  SortableHeader
};
