import React from 'react';
import { SegmentedControl } from '@/components/ui/segmented-control';

export type ProgressionStyle = 'aggressive' | 'gradual' | 'maintenance' | 'deload';

type ProgressionStylePickerProps = {
  value: ProgressionStyle;
  onChange: (value: ProgressionStyle) => void;
};

export function ProgressionStylePicker({ value, onChange }: ProgressionStylePickerProps) {
  return (
    <SegmentedControl
      options={[
        { label: 'Aggressive', value: 'aggressive' },
        { label: 'Gradual', value: 'gradual' },
        { label: 'Maintenance', value: 'maintenance' },
        { label: 'Deload', value: 'deload' },
      ]}
      value={value}
      onChange={(newValue) => onChange(newValue as ProgressionStyle)}
    />
  );
}
