import { cn } from "@/lib/utils";
import * as React from "react";
import { Component, useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";

interface SegmentedControlProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

// Error Boundary to catch navigation context errors
class SegmentedControlErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    // Check if it's a navigation context error
    if (error.message?.includes("navigation context") || error.message?.includes("NavigationContainer")) {
      return { hasError: true };
    }
    // Re-throw other errors
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (error.message?.includes("navigation context") || error.message?.includes("NavigationContainer")) {
      console.log(`[H2] SegmentedControl caught navigation context error, using fallback`);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function SegmentedControlInner({ options, value, onChange, className }: SegmentedControlProps) {
  const viewClassName = cn("flex-row bg-muted p-1 rounded-lg", className);

  // Memoize the Pressable components to prevent re-processing className during theme changes
  // Use inline styles for shadow to avoid NativeWind runtime CSS parsing that interferes with navigation context
  const pressableComponents = useMemo(() => {
    return options.map((option) => {
      const isActive = value === option.value;

      // Remove shadow-sm from className and use inline style instead to avoid navigation context errors
      const pressableClassName = cn(
        "flex-1 items-center justify-center py-1.5 rounded-md",
        isActive ? "bg-background" : ""
      );

      // Use inline style for shadow to avoid NativeWind runtime processing issues
      const pressableStyle = isActive
        ? {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1, // Android shadow
          }
        : undefined;

      const textClassName = cn(
        "text-sm font-medium",
        isActive ? "text-foreground" : "text-muted-foreground"
      );

      return (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          className={pressableClassName}
          style={pressableStyle}
        >
          <Text className={textClassName}>
            {option.label}
          </Text>
        </Pressable>
      );
    });
  }, [options, value, onChange]);

  return (
    <View className={viewClassName}>
      {pressableComponents}
    </View>
  );
}

export const SegmentedControl = React.memo(function SegmentedControl({ options, value, onChange, className }: SegmentedControlProps) {
  const lastValidPropsRef = useRef<SegmentedControlProps>({ options, value, onChange, className });
  const fallbackRef = useRef<React.ReactElement | null>(null);
  
  // Update last valid props
  lastValidPropsRef.current = { options, value, onChange, className };
  
  // Create fallback using last valid props
  const fallback = fallbackRef.current || (
    <SegmentedControlInner
      options={lastValidPropsRef.current.options}
      value={lastValidPropsRef.current.value}
      onChange={lastValidPropsRef.current.onChange}
      className={lastValidPropsRef.current.className}
    />
  );
  
  // Update fallback ref
  if (!fallbackRef.current) {
    fallbackRef.current = fallback;
  }

  return (
    <SegmentedControlErrorBoundary fallback={fallback}>
      <SegmentedControlInner options={options} value={value} onChange={onChange} className={className} />
    </SegmentedControlErrorBoundary>
  );
});
