import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@app/lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

// "default" = shadcn's filled pill. "underline" = GitHub-style: a flat row on
// a hairline divider; the active tab gets a 2px foreground underline that
// sits over the divider (-mb-px). Same Radix primitive either way, so
// keyboard/ARIA behaviour is identical.
type TabsVariant = "default" | "underline"

const LIST_VARIANTS: Record<TabsVariant, string> = {
  default:
    "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
  underline: "border-border flex w-full items-center justify-start border-b",
}

const TRIGGER_VARIANTS: Record<TabsVariant, string> = {
  default:
    "data-[state=active]:bg-background dark:data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  underline:
    "text-muted-foreground hover:text-foreground hover:border-border data-[state=active]:text-foreground data-[state=active]:border-foreground focus-visible:ring-ring/50 -mb-px inline-flex items-center gap-2 rounded-none border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:rounded-sm focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:font-medium [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
}

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & {
  variant?: TabsVariant
}) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(LIST_VARIANTS[variant], className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & {
  variant?: TabsVariant
}) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      data-variant={variant}
      className={cn(TRIGGER_VARIANTS[variant], className)}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
export type { TabsVariant }
