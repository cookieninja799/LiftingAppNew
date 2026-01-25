export const EXERCISE_STRENGTH_RATIOS: Record<string, Record<string, number>> = {
  'Incline Bench Press': {
    'Bench Press': 0.85,
    'Overhead Press': 1.15,
  },
  'Decline Bench Press': {
    'Bench Press': 1.05,
  },
  'Front Squat': {
    'Back Squat': 0.85,
  },
  'Goblet Squat': {
    'Back Squat': 0.45,
  },
  'Leg Press': {
    'Back Squat': 1.6,
  },
  'Romanian Deadlift': {
    'Deadlift': 0.65,
  },
  'Stiff Leg Deadlift': {
    'Deadlift': 0.6,
  },
  'Hip Thrust': {
    'Deadlift': 0.7,
  },
  'Dumbbell Bench Press': {
    'Bench Press': 0.7,
  },
  'Dumbbell Incline Press': {
    'Incline Bench Press': 0.7,
  },
  'Dumbbell Row': {
    'Barbell Row': 0.75,
  },
  'Cable Row': {
    'Barbell Row': 0.7,
  },
  'Lat Pulldown': {
    'Pull Up': 0.8,
  },
  'Chin Up': {
    'Pull Up': 0.95,
  },
  'Arnold Press': {
    'Overhead Press': 0.8,
  },
  'Dumbbell Shoulder Press': {
    'Overhead Press': 0.7,
  },
  'Close Grip Bench Press': {
    'Bench Press': 0.9,
  },
  'Floor Press': {
    'Bench Press': 0.9,
  },
  'Preacher Curl': {
    'Bicep Curl': 0.85,
  },
  'Hammer Curl': {
    'Bicep Curl': 0.9,
  },
  'Cable Curl': {
    'Bicep Curl': 0.8,
  },
  'Tricep Pushdown': {
    'Close Grip Bench Press': 0.55,
  },
  'Skull Crushers': {
    'Close Grip Bench Press': 0.6,
  },
  'Leg Extension': {
    'Back Squat': 0.35,
  },
  'Leg Curl': {
    'Romanian Deadlift': 0.5,
  },
};

export const MOVEMENT_PATTERN_GROUPS: Record<string, string[]> = {
  horizontal_press: ['Bench Press', 'Dumbbell Bench Press', 'Push Up', 'Cable Press'],
  vertical_press: [
    'Overhead Press',
    'Dumbbell Shoulder Press',
    'Arnold Press',
    'Landmine Press',
  ],
  horizontal_pull: [
    'Barbell Row',
    'Dumbbell Row',
    'Cable Row',
    'Seal Row',
    'Chest Supported Row',
  ],
  vertical_pull: ['Pull Up', 'Lat Pulldown', 'Chin Up', 'Assisted Pull Up'],
  squat_pattern: ['Back Squat', 'Front Squat', 'Goblet Squat', 'Leg Press', 'Hack Squat'],
  hinge_pattern: ['Deadlift', 'Romanian Deadlift', 'Good Morning', 'Hip Thrust', 'Back Extension'],
  single_leg: ['Bulgarian Split Squat', 'Lunge', 'Step Up'],
  arm_flexion: ['Bicep Curl', 'Hammer Curl', 'Preacher Curl', 'Cable Curl'],
  arm_extension: ['Tricep Pushdown', 'Skull Crushers', 'Overhead Tricep Extension'],
};

export const EQUIPMENT_ALTERNATIVES: Record<string, string[]> = {
  'Barbell Bench Press': ['Dumbbell Bench Press', 'Push Up', 'Cable Press', 'Floor Press'],
  'Barbell Squat': ['Goblet Squat', 'Leg Press', 'Bulgarian Split Squat', 'Hack Squat'],
  'Pull Up': ['Lat Pulldown', 'Assisted Pull Up', 'Inverted Row'],
  'Deadlift': ['Romanian Deadlift', 'Trap Bar Deadlift', 'Hip Thrust', 'Rack Pull'],
  'Overhead Press': ['Dumbbell Shoulder Press', 'Arnold Press', 'Landmine Press'],
  'Barbell Row': ['Dumbbell Row', 'Cable Row', 'Chest Supported Row'],
  'Leg Press': ['Goblet Squat', 'Hack Squat', 'Front Squat'],
  'Lateral Raise': ['Cable Lateral Raise', 'Machine Lateral Raise', 'Face Pull'],
};
