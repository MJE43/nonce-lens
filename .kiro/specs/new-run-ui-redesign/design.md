# Design Document

## Overview

This design document outlines the modernization of the New Run page UI to create a visually appealing, highly functional, and accessible interface. The redesign focuses on improving visual hierarchy, color contrast, modern styling patterns, and responsive design while maintaining all existing functionality.

The current implementation uses Tailwind CSS v4 with custom CSS variables for theming. The redesign will leverage modern design principles including improved spacing, typography, color systems, and interactive states.

## Architecture

### Design System Approach
- **Color System**: Implement a cohesive color palette. Dark mode only
- **Typography Scale**: Use consistent font sizes and weights with clear hierarchy
- **Spacing System**: Apply consistent spacing using Tailwind's spacing scale
- **Component States**: Define clear visual states for form elements (default, focus, error, success)
- **Responsive Design**: Ensure optimal experience across all device sizes

### CSS Architecture
- **Tailwind v4 Integration**: Leverage Tailwind's utility classes with custom CSS variables
- **Theme Variables**: Extend the existing CSS custom properties for consistent theming
- **Component-Specific Styles**: Add targeted styles for form components and interactive elements
- **Accessibility**: Ensure WCAG 2.1 AA compliance for color contrast and keyboard navigation

## Components and Interfaces

### 1. Page Layout Component
**Purpose**: Main container and layout structure
**Key Features**:
- Responsive container with proper max-width and centering
- Improved background and surface colors
- Better spacing and padding system

### 2. Form Header Component
**Purpose**: Page title and description area
**Key Features**:
- Enhanced typography hierarchy
- Improved color contrast for text
- Better visual separation from form content
- Icon integration for visual interest

### 3. Form Field Components
**Purpose**: Individual form input elements
**Key Features**:
- **Input Fields**: Enhanced styling with better borders, focus states, and padding
- **Textarea**: Improved styling for server seed input with proper sizing
- **Select Dropdown**: Modern dropdown styling with better visual feedback
- **Labels**: Clear, accessible labels with proper contrast
- **Error States**: Prominent but not overwhelming error styling
- **Help Text**: Subtle but readable helper text

### 4. Range Summary Component
**Purpose**: Display nonce range and estimation information
**Key Features**:
- Modern card-like appearance with subtle shadows
- Improved color scheme for information display
- Better typography for numbers and labels
- Visual icons for enhanced understanding

### 5. Action Button Component
**Purpose**: Form submission and navigation buttons
**Key Features**:
- Modern button styling with proper hover and focus states
- Loading states with improved visual feedback
- Accessible button hierarchy (primary vs secondary)
- Proper disabled states

## Data Models

### Theme Configuration
```typescript
interface ThemeColors {
  primary: {
    50: string;
    100: string;
    500: string;
    600: string;
    700: string;
    900: string;
  };
  gray: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
  };
  success: {
    50: string;
    500: string;
    600: string;
  };
  error: {
    50: string;
    500: string;
    600: string;
  };
}
```

### Form State Interface
```typescript
interface FormFieldState {
  value: string | number;
  error?: string;
  touched: boolean;
  focused: boolean;
}
```

## Error Handling

### Visual Error States
- **Field-Level Errors**: Red border, red text, error icon
- **Form-Level Errors**: Toast notifications with improved styling
- **Validation Feedback**: Real-time validation with smooth transitions

### Accessibility Error Handling
- **Screen Reader Support**: Proper ARIA labels and error announcements
- **Keyboard Navigation**: Ensure error states are navigable via keyboard
- **Color Independence**: Error states don't rely solely on color

## Testing Strategy

### Visual Testing
- **Cross-Browser Compatibility**: Test in Chrome, Firefox, Safari, Edge
- **Responsive Testing**: Verify layout on mobile, tablet, and desktop
- **Theme Testing**: Validate both light and dark mode appearances
- **Contrast Testing**: Ensure all text meets WCAG contrast requirements

### Accessibility Testing
- **Screen Reader Testing**: Test with NVDA, JAWS, and VoiceOver
- **Keyboard Navigation**: Verify all interactive elements are keyboard accessible
- **Focus Management**: Ensure proper focus indicators and tab order

### User Experience Testing
- **Form Completion**: Test the complete form submission flow
- **Error Scenarios**: Validate error state presentations
- **Loading States**: Verify loading indicators and disabled states

## Implementation Details

### CSS Custom Properties Enhancement
```css
:root {
  /* Enhanced color system */
  --color-primary-50: #eff6ff;
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;
  
  /* Improved gray scale */
  --color-gray-50: #f9fafb;
  --color-gray-100: #f3f4f6;
  --color-gray-200: #e5e7eb;
  --color-gray-300: #d1d5db;
  --color-gray-400: #9ca3af;
  --color-gray-500: #6b7280;
  --color-gray-600: #4b5563;
  --color-gray-700: #374151;
  --color-gray-800: #1f2937;
  --color-gray-900: #111827;
  
  /* Status colors */
  --color-success-50: #ecfdf5;
  --color-success-500: #10b981;
  --color-error-50: #fef2f2;
  --color-error-500: #ef4444;
  
  /* Surface colors */
  --color-surface: #ffffff;
  --color-surface-secondary: #f8fafc;
  --color-border: #e2e8f0;
  --color-border-focus: #3b82f6;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-surface: #1e293b;
    --color-surface-secondary: #0f172a;
    --color-border: #334155;
    --color-gray-50: #1e293b;
    --color-gray-900: #f1f5f9;
  }
}
```

### Component Styling Approach
- **Form Container**: Enhanced card styling with subtle shadows and proper spacing
- **Input Styling**: Consistent padding, border radius, and focus states
- **Typography**: Improved font weights and sizes for better hierarchy
- **Interactive States**: Smooth transitions for hover, focus, and active states

### Responsive Design Strategy
- **Mobile First**: Design for mobile and enhance for larger screens
- **Breakpoint Strategy**: Use Tailwind's responsive prefixes for layout adjustments
- **Touch Targets**: Ensure minimum 44px touch targets for mobile devices
- **Content Prioritization**: Stack form elements appropriately on smaller screens

## Design Decisions and Rationales

### Color Palette Choice
- **Primary Blue**: Maintains existing brand color while improving contrast
- **Gray Scale**: Expanded gray palette for better visual hierarchy
- **Status Colors**: Clear success and error colors that work in both themes

### Typography Improvements
- **Font Stack**: Leverage system fonts for better performance and native feel
- **Size Scale**: Use consistent type scale for better hierarchy
- **Weight Distribution**: Strategic use of font weights for emphasis

### Spacing System
- **Consistent Spacing**: Use Tailwind's spacing scale for consistency
- **Vertical Rhythm**: Maintain consistent vertical spacing throughout
- **Content Grouping**: Use spacing to create clear content relationships

### Interactive Design
- **Focus Indicators**: Clear, accessible focus states for keyboard users
- **Hover States**: Subtle hover effects that provide feedback without distraction
- **Loading States**: Clear loading indicators that don't disrupt the layout