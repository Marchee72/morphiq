# Android UI Redesign Plan (MorphIQ)

This plan outlines the visual redesign and mobile-first optimization for the MorphIQ Android app. It incorporates the premium styling tokens and guidelines from the **Modern Dark (Cinema Mobile)** design system of the `ui-ux-pro-max` skill.

---

## User Review Required

> [!IMPORTANT]
> The redesign will migrate the app's visual style to a premium **Cinema Dark** theme. The background will shift from dark-gray to an OLED deep-black (#030303) and charcoal dark palette (#09090b), with crisp borders and glowing highlights. Emojis will be completely eliminated in favor of clean vector-based icons.

> [!WARNING]
> We will enforce a strict minimum touch target of **48×48dp** for all interactive elements to comply with Android design guidelines. This will slightly increase spacing and padding around small buttons, inputs, list rows, and checkboxes, ensuring they are easy to tap on physical devices.

---

## Proposed Changes

We will refine the global stylesheet (`src/index.css`) and individual UI components to match the design system tokens.

### 1. Global CSS & Design Tokens

#### [MODIFY] [index.css](file:///C:/Users/march/source/repos/morphiq/src/index.css)
- **CSS Variables & Color System**: Establish Cinema Dark colors and spacing rules based on the 8dp rhythm.
  - Set `--bg-void: #030303` (OLED black backdrop)
  - Set `--bg-base: #09090b` (Deep dark-gray background)
  - Set `--bg-surface: rgba(20, 20, 23, 0.85)` (Elevated cards with glassmorphism)
  - Set `--border-dim: rgba(255, 255, 255, 0.08)` (Subtle borders)
  - Set `--border-active: rgba(99, 102, 241, 0.45)` (Glow border state)
  - Set `--accent-indigo: #6366f1` (Vibrant purple-indigo)
  - Set `--accent-teal: #14b8a6` (Vibrant health-teal)
  - Set `--color-text-primary: #f4f4f5` (Zinc 100)
  - Set `--color-text-secondary: #a1a1aa` (Zinc 400)
  - Set `--color-text-muted: #71717a` (Zinc 500)
- **Typography Integration**: Import Barlow & Barlow Condensed from Google Fonts and apply them:
  - Font families: `var(--font-family: 'Barlow', sans-serif)` and `var(--font-heading: 'Barlow Condensed', sans-serif)`.
- **Interaction Enhancements**:
  - Add `-webkit-tap-highlight-color: transparent` globally to prevent the webview's default tap highlight color on Android.
  - Implement dynamic touch active states (`:active`) with smooth opacity scaling (`transform: scale(0.97)` / `opacity: 0.8`) and no layout shifts.
  - Standardize button and card transition ease values (`transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1)`).

---

### 2. Header & Main Navigation

#### [MODIFY] [App.tsx](file:///C:/Users/march/source/repos/morphiq/src/App.tsx)
- **Tab Buttons Touch Targets**:
  - Update navigation bar buttons so they meet the 48dp minimum vertical touch target size. 
  - Add soft glow indicators beneath active tabs instead of standard text-background blocks.
  - Standardize alignment, ensuring the header retains its centered layout on desktop views while gracefully stacking or wrapping cleanly on narrow Android screens.

---

### 3. Component Details & Spacing Rhythm

#### [MODIFY] [ScaleConnector.tsx](file:///C:/Users/march/source/repos/morphiq/src/presentation/components/ScaleConnector.tsx)
- Increase padding and margins using the `--space-md` (16px) and `--space-lg` (24px) variables.
- Standardize the BLE Simulator button and Scale scanner triggers to meet the 48px height target.
- Replace any hardcoded custom heights with variable tokens.

#### [MODIFY] [DailyLog.tsx](file:///C:/Users/march/source/repos/morphiq/src/presentation/components/DailyLog.tsx)
- Optimize log forms (Meal details, calories, and exercises) with clear input structures.
- Ensure all meal cards and the deletion icon buttons have hit areas of at least 48px.
- Use clean borders and a vertical visual rhythm rather than dense boxes.

#### [MODIFY] [CoachChat.tsx](file:///C:/Users/march/source/repos/morphiq/src/presentation/components/CoachChat.tsx)
- Polish chatbot message bubbles: use a clean gradient backdrop for the user bubble (`linear-gradient(135deg, var(--accent-indigo), #4f46e5)`) and flat dark elevated styling for the assistant bubble.
- Redesign the coach typing indicator and message input form to have a touch height of 48px.

#### [MODIFY] [ProfileSettings.tsx](file:///C:/Users/march/source/repos/morphiq/src/presentation/components/ProfileSettings.tsx)
- Upgrade profile fields (Weight, Height, Age, Gender selection) with high contrast borders, clear labels, and touch targets.
- Structure save/delete buttons to be full-width and highly clickable.

#### [MODIFY] [AnalyticsDashboard.tsx](file:///C:/Users/march/source/repos/morphiq/src/presentation/components/AnalyticsDashboard.tsx)
- Optimize the layout of body composition metrics cards.
- Redraw status markers and metric indicators using SVG graphics (removing any standard character highlights).

---

## Verification Plan

### Automated Tests
- Run `npm run test` or `npx vitest run` to verify that all components continue to mount and functional tests succeed.
- Run `npm run build` to verify Webpack/Vite production compilation.

### Manual Verification
- **Touch Testing (Simulated Android webview)**: Open devtools and verify that no interactive control is smaller than 48px in height/width.
- **Contrast Check**: Verify body text contrast against `--bg-base` is $\ge 4.5:1$ and titles are clearly readable.
- **Responsive Layout**: Verify that all content layouts stretch cleanly and fit within a 360px width webview without horizontal scroll leakage.
- **Sync check**: Perform `npx cap sync android` to ensure changes are built and synced.
