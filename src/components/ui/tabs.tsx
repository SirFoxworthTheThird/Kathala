import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-9 max-w-full items-center justify-center overflow-x-auto rounded-lg bg-[hsl(var(--muted))] p-1 text-[hsl(var(--muted-foreground))]',
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[hsl(var(--background))] data-[state=active]:text-[hsl(var(--foreground))] data-[state=active]:shadow',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

/**
 * How many things are behind a tab (**CH-3**).
 *
 * Eight bare labels made a character with no goals, no lore and no factions
 * look identical to one with three of each — while every sibling screen in the
 * group counts things, the rosters and the map sidebar sections included. The
 * zero is drawn rather than omitted, because "none" is the answer the finding
 * is actually asking for; an absent number would only move the ambiguity.
 *
 * Only a tab holding a *list* takes one. Overview and Current State each show a
 * single record, and "Overview 1" would be noise.
 */
const TabCount = ({ n }: { n: number }) => (
  <span className={cn('ml-1.5 text-[10px] tabular-nums', n === 0 ? 'opacity-40' : 'opacity-70')}>
    {n}
  </span>
)

export { Tabs, TabsList, TabsTrigger, TabsContent, TabCount }
