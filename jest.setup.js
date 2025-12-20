// jest.setup.js
// Setup file for Jest tests

// Extend Jest matchers from @testing-library/jest-native
import '@testing-library/jest-native/extend-expect';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock react-native-calendars Calendar component
jest.mock('react-native-calendars', () => ({
  Calendar: jest.fn(() => null),
  CalendarList: jest.fn(() => null),
  Agenda: jest.fn(() => null),
}));

// Mock useFocusEffect to run callback immediately in tests
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useFocusEffect: (callback) => {
      // Execute the callback immediately for testing
      const React = require('react');
      React.useEffect(() => {
        const cleanup = callback();
        return cleanup;
      }, []);
    },
  };
});

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  return {
    default: {
      createAnimatedComponent: (Component) => Component,
      call: () => {},
    },
    useSharedValue: jest.fn((init) => ({ value: init })),
    useAnimatedStyle: jest.fn(() => ({})),
    withTiming: jest.fn((toValue) => toValue),
    withSpring: jest.fn((toValue) => toValue),
    withRepeat: jest.fn((animation) => animation),
    Easing: {
      linear: jest.fn(),
      ease: jest.fn(),
      quad: jest.fn(),
      cubic: jest.fn(),
    },
  };
});

// Mock useColorScheme for components that use it
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: jest.fn(() => 'light'),
}));

// Silence console.log in tests (optional - comment out for debugging)
// global.console.log = jest.fn();

// Add a global beforeEach to clear mocks
beforeEach(() => {
  jest.clearAllMocks();
});
