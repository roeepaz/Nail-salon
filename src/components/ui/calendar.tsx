"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "bg-background group/calendar w-full max-w-full select-none [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      formatters={{
        formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-full max-w-full", defaultClassNames.root),
        months: cn("relative flex flex-col gap-3 w-full", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-3 sm:gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between pointer-events-none z-10",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-8 sm:size-8.5 rounded-full border border-border/80 bg-background/80 hover:bg-primary/10 hover:border-primary/50 text-foreground transition-all duration-200 select-none p-0 aria-disabled:opacity-30 pointer-events-auto shadow-xs",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "size-8 sm:size-8.5 rounded-full border border-border/80 bg-background/80 hover:bg-primary/10 hover:border-primary/50 text-foreground transition-all duration-200 select-none p-0 aria-disabled:opacity-30 pointer-events-auto shadow-xs",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex h-8 sm:h-8.5 w-full items-center justify-center font-display text-sm sm:text-base font-semibold tracking-wide text-foreground px-10",
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          "flex h-9 w-full items-center justify-center gap-1.5 text-xs sm:text-sm font-medium",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn("bg-popover absolute inset-0 opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          "select-none font-semibold text-sm sm:text-base text-foreground font-display",
          captionLayout === "label"
            ? ""
            : "[&>svg]:text-muted-foreground flex h-7 items-center gap-1 rounded-md pl-2 pr-1 text-xs sm:text-sm [&>svg]:size-3",
          defaultClassNames.caption_label,
        ),
        month_grid: cn("w-full border-collapse border-spacing-0 table-fixed", defaultClassNames.month_grid),
        weekdays: cn("flex w-full items-center justify-between border-b border-border/60 pb-2 mb-1", defaultClassNames.weekdays),
        weekday: cn(
          "flex-1 text-center font-semibold text-[11px] sm:text-xs text-muted-foreground/80 tracking-wide select-none py-0.5",
          defaultClassNames.weekday,
        ),
        week: cn("my-0.5 sm:my-1 flex w-full items-center justify-between gap-0.5 sm:gap-1.5", defaultClassNames.week),
        week_number_header: cn("w-7 select-none", defaultClassNames.week_number_header),
        week_number: cn(
          "text-muted-foreground select-none text-[0.75rem]",
          defaultClassNames.week_number,
        ),
        day: cn(
          "group/day flex-1 relative aspect-square p-0 flex items-center justify-center text-center select-none",
          defaultClassNames.day,
        ),
        range_start: cn("bg-accent rounded-l-md", defaultClassNames.range_start),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("bg-accent rounded-r-md", defaultClassNames.range_end),
        today: cn(
          "font-semibold text-primary",
          defaultClassNames.today,
        ),
        outside: cn(
          "text-muted-foreground/30 aria-selected:text-muted-foreground",
          defaultClassNames.outside,
        ),
        disabled: cn("text-muted-foreground/30 opacity-40 pointer-events-none", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return <div data-slot="calendar" ref={rootRef} className={cn("w-full max-w-full", className)} {...props} />;
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return <ChevronLeftIcon className={cn("size-3.5 sm:size-4", className)} {...props} />;
          }

          if (orientation === "right") {
            return <ChevronRightIcon className={cn("size-3.5 sm:size-4", className)} {...props} />;
          }

          return <ChevronDownIcon className={cn("size-3.5 sm:size-4", className)} {...props} />;
        },
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-7 items-center justify-center text-center">
                {children}
              </div>
            </td>
          );
        },
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers["focused"]) ref.current?.focus();
  }, [modifiers["focused"]]);

  const isSelected = Boolean(modifiers["selected"]);
  const isToday = Boolean(modifiers["today"]);
  const isDisabled = Boolean(modifiers["disabled"]);
  const isOutside = Boolean(modifiers["outside"]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={isSelected}
      className={cn(
        "flex aspect-square h-full w-full max-w-[2.25rem] max-h-[2.25rem] sm:max-w-[2.65rem] sm:max-h-[2.65rem] items-center justify-center rounded-xl sm:rounded-2xl text-xs sm:text-sm font-medium transition-all duration-200 select-none p-0",
        !isDisabled && !isSelected && "hover:bg-primary/12 hover:text-primary hover:scale-105 active:scale-95 cursor-pointer",
        isToday && !isSelected && "border-2 border-primary/50 text-primary font-bold bg-primary/5",
        isSelected && "bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/30 scale-105 hover:bg-primary hover:text-primary-foreground",
        isOutside && !isSelected && "text-muted-foreground/30 opacity-30",
        isDisabled && "text-muted-foreground/25 opacity-30 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground/25 pointer-events-none line-through decoration-muted-foreground/35",
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
