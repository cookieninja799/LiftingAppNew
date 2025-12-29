import { cn } from "@/lib/utils";
import * as React from "react";
import { View, type ViewProps } from "react-native";

const Separator = React.forwardRef<
  View,
  ViewProps & { orientation?: "horizontal" | "vertical" }
>(({ className, orientation = "horizontal", ...props }, ref) => (
  <View
    ref={ref}
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
      className
    )}
    {...props}
  />
));
Separator.displayName = "Separator";

export { Separator };





