# MorphIQ BLE Scale & Gym Routine Walkthrough

We have successfully implemented a hands-free BLE scale impedance collection state machine, inline Gym Routine tracking for logged workouts, historical exercise statistics, a professional CSCS coach routine analyzer powered by Gemini, and a fixed top navigation header for the desktop web UI.

---

## 🛠️ Summary of Changes

### 0. ⚖️ BLE Scale Impedance Collection State Machine & Premature Save Bug Fixes
* **Domain Interface Extension ([IBluetooth.ts](file:///C:/Users/march/source/repos/morphiq/src/core/interfaces/IBluetooth.ts))**: Added optional `weightRemoved?: boolean;` property to `IScaleData` to support detection of stepping off.
* **BLE Advertisement Parser ([WebBluetoothScale.ts](file:///C:/Users/march/source/repos/morphiq/src/data/bluetooth/WebBluetoothScale.ts))**: 
  - Updated `parseScaleData` to extract the weight removed flag (Bit 7 of Byte 0, or `0x0080` in combined flags) from the standard Xiaomi Mi Body Composition Scale 2 advertisement payload.
  - **Refusal of 500 Ω Placeholder**: Modified the `validImpedance` check to exclude the default placeholder value of `500 Ω` (which some scales broadcast temporarily during calculation or failure), preventing the app from auto-saving incorrect BIA results.
* **State Machine & Auto-Save Callback ([store.ts](file:///C:/Users/march/source/repos/morphiq/src/presentation/state/store.ts))**: 
  - Added `scaleLastStabilizedWeight` memory tracking to retain the user's locked weight reading even when they step off and the live weight drops to `0`.
  - **Premature Save Bug Fix**: Configured the callback inside `startScaleScan` to check `data.weightRemoved && data.weight < 5.0` before triggering `saveWeightOnly(lastStabilizedWeight)`. By requiring the live weight to drop below `5.0 kg` to trigger the step-off save, we prevent premature saves while the user is still standing on the scale during BIA scans.
  - **Impedance Preservation**: Users standing barefoot can now successfully complete BIA scans. The scanner remains active until `impedancePresent` becomes true or the user physically steps off.
* **Rollback of Hands-Free Background Auto-Scan & Countdown Removal ([ScaleConnector.tsx](file:///C:/Users/march/source/repos/morphiq/src/presentation/components/ScaleConnector.tsx))**:
  - Removed the automatic background scanning on mount. Scanning is now only triggered when the user explicitly clicks the "Connect" button in the scale connector card, preventing background noise from creating duplicate/spam measurements.
  - Reverted the weighing modal trigger to display immediately upon clicking "Connect".
  - **Grace Timer / Countdown Removal**: Removed the 12s countdown timer entirely from the modal UI so that the app will wait indefinitely for the scale to finish its calculation.
* **Database Cleanup**:
  - Created a cleanup utility script to scan the active server database and deleted all temporary/spam measurements with `weight <= 5.0 kg` created during hands-free testing.


### 1. 🗄️ Database & Schema Extensions
* **PostgreSQL Schema ([schema.sql](file:///C:/Users/march/source/repos/morphiq/server/schema.sql))**: Created the `workout_sets` table structure.
* **Express Backend REST Endpoints ([server/index.js](file:///C:/Users/march/source/repos/morphiq/server/index.js))**:
  - Implemented CRUD endpoints for sets.
  - Added robust transactional cascading deletions: deleting a profile cleans up its associated workout sets, and deleting a workout log cleans up its sets.
* **Dexie Local IndexedDB ([LocalDatabase.ts](file:///C:/Users/march/source/repos/morphiq/src/data/database/LocalDatabase.ts))**: Upgraded Dexie to version `2` declaring the `workoutSets` table and implemented full cascading deletes.

### 2. ⚡ Real-Time Tracking & Auto-Merging ([store.ts](file:///C:/Users/march/source/repos/morphiq/src/presentation/state/store.ts) & [WorkoutTab.tsx](file:///C:/Users/march/source/repos/morphiq/src/presentation/components/WorkoutTab.tsx))
* **Active Session Trigger**: Added a "Start Gym Session" option inside the "Log Session" sub-tab. Clicking this starts a real-time manual workout log (default type: "Strength Training", duration: 0) and immediately redirects the user to the active "Track Workout Routine" panel.
* **Samsung Health Auto-Merge**: Refactored `importWorkouts` to automatically scan for manual workouts logged within a 4-hour window of a newly imported Samsung Health workout. If matched, the sets are reassigned to the synced workout, and the manual log is deleted.

### 3. 🏋️ Workout Routine Tracking UI & Mobile Optimizations
* **Collapsible Add-Set Form**: Built a collapsible panel for logging exercises. When closed, it renders as a single compact dashed "+ Add Exercise Set" button.
* **Collapsible Manual Workout Logger**: Overhauled the manual workout session logger form to be collapsible, displaying as a sleek dashed "+ Log Workout Manually" button. This prevents visual clutter on phone screens since users primarily use active sessions or health syncs.
* **Interactive Stats Dashboard with Click-to-Expand Modals ([WorkoutStatsSummary.tsx](file:///C:/Users/march/source/repos/morphiq/src/presentation/components/WorkoutStatsSummary.tsx) & [WorkoutStatDetailModal.tsx](file:///C:/Users/march/source/repos/morphiq/src/presentation/components/WorkoutStatDetailModal.tsx))**:
  - Converted the cards into a 2-column grid layout on mobile viewports (consuming half the width each) and stacked icons and labels vertically to prevent text wrapping.
  - Added a `.gap-3 lg:gap-4` spacing class to correct touch margins on phone screens.
  - Enabled click-to-expand details popup behavior. Clicking on a card opens a modal overlay showcasing detailed insights, average durations, peak workloads, and target metrics.
* **Mobile-Responsive History Table ([WorkoutHistoryTable.tsx](file:///C:/Users/march/source/repos/morphiq/src/presentation/components/WorkoutHistoryTable.tsx))**:
  - Modified dates to display in a ultra-compact `dd/mm/yy` format.
  - Implemented a `.hidden-mobile` utility class to hide Description, Est. Calories Burned, and Source/Heart Rate columns on phone viewports.

### 4. 🖥️ Fixed Desktop Header Layout ([index.css](file:///C:/Users/march/source/repos/morphiq/src/index.css))
* Set `.main-header` to `position: fixed !important` for viewports `>= 768px`.
* Added a `margin-top: 68px` offset to `.main-content` on desktop viewports.

---

## 🧪 Verification & Validation Results

### 1. Unit Tests
* Extended `WebBluetoothScale.test.ts` to verify parsing of the `weightRemoved` status flag in advertisement packets.
* Extended `LocalDatabase.test.ts` to cover `WorkoutSetRepository` operations, personal best queries, and profile/workout cascades.
* Extended `store.test.ts` to verify Zustand store actions, scale data stabilization memory, custom-weight fallback behavior, and Samsung Health auto-merge logic.
* Ran `npx vitest run` successfully. All 30 tests passed.

### 2. Compilation and Bundle Validation
* Verified that the typescript compiler (`tsc -b`) and Vite production bundle build successfully:
  ```bash
  npm run build
  ```
  - **Result:** Web build succeeded with 0 errors.
* **Gradle Native Build Resolution:** 
  - Declared the Kotlin Android plugin (`org.jetbrains.kotlin.android`) and imported the `connect-client:1.2.0-alpha01` dependency directly inside the main app `build.gradle` to provide compilation path classes.
  - Specified explicit Kotlin generic type arguments (e.g. `ReadRecordsRequest<WeightRecord>`) to satisfy type-safety checks and prevent ambiguous stdlib iterator conflicts.
  - Successfully compiled the entire native app and package dependencies via `./gradlew assembleDebug` (`BUILD SUCCESSFUL` inside 6s).

### 3. Capacitor Native Android Synchronization Tabs Style Polish (True Diffuse Acrylic Appearance)
* **Activated Android Hardware Acceleration**: Added `android:hardwareAccelerated="true"` to both the `<application>` and the `<activity>` (MainActivity) tags in [AndroidManifest.xml](file:///C:/Users/march/source/repos/morphiq/android/app/src/main/AndroidManifest.xml#L14-L35). This forces the Android OS to run the WebView with hardware rendering, enabling backdrop filter shaders that some devices disable in software fallback mode.
* **Direct Backdrop Filter Placement**:
  - Removed the complex pseudo-element layer which was causing stacking context and rendering bugs on some versions of mobile Chrome.
  - Placed the backdrop filter directly on `.nav-container nav` in [index.css](file:///C:/Users/march/source/repos/morphiq/src/index.css#L155-L166).
* **Deep Frosted Tint & Blur**:
  - Combined `background: rgba(20, 20, 25, 0.65)` (a perfect translucent dark charcoal tint) with a high-performance, very diffuse `blur(32px)` and `saturate(220%)` backdrop-filter.
  - Retained `transform: translateZ(0)` to ensure GPU compositing of the filtered panel.
* Verified that the frosted glass effect blurs the underlying page content correctly and smoothly on the connected Android device.
