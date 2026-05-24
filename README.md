# MorphIQ: Intelligent Body Composition & Health Companion

MorphIQ is a premium, privacy-first body composition dashboard and AI-driven coaching application. It connects to the **Xiaomi Mi Body Composition Scale 2 (Model: XMTZC05HM)** via Web Bluetooth to track body composition metrics and uses this data to power a **Professional Nutritionist & Gym Coach AI Agent** that dynamically adjusts workouts and diet plans.

---

## Key Features

1.  **Direct Scale Integration (Web BLE):** Connects to the Xiaomi Mi Body Composition Scale 2 directly from the browser using the Web Bluetooth API.
2.  **Mock Simulator Mode:** Full simulator that generates realistic scale weight and impedance data, allowing you to try the app immediately without physical hardware.
3.  **Local & Private Data:** Built local-first. All profile, tracking history, food logs, and chat records are stored locally in your browser's IndexedDB (using Dexie.js).
4.  **AI Nutritionist & Coach Chat:** Contextual coaching agent that references your weight changes, muscle mass, visceral fat rating, and daily macronutrient logs to generate personalized training and diet feedback.
5.  **Interactive Progress Tracking:** Beautiful glassmorphic dashboards and animated charts showing weight and body fat trends over time.

---

## 🛠️ Technology Stack

*   **Core:** React, Vite, TypeScript, HTML5, CSS Modules
*   **Database:** Dexie.js (IndexedDB)
*   **Scale Integration:** Web Bluetooth API (SIG Body Composition service `0x181B`)
*   **AI Agent:** Google Gemini Developer API (client-side connection)
*   **Data Visualizations:** Recharts (responsive SVGs)
*   **Icons:** Lucide React
*   **Testing:** Vitest, Testing Library React, Fake-IndexedDB (24 unit tests, 100% core coverage)

---

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18+)
*   NPM (v9+)
*   A Chromium-based browser supporting the Web Bluetooth API (Chrome, Edge, Opera, Samsung Internet).
    *   *Note: For iOS, you will need to open the deployed URL inside a Web BLE browser like **Bluefy** or **WebBLE**.*

### Installation

1.  Clone the repository:
    ```bash
    git clone <your-repository-url>
    cd morphiq
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server with HTTPS:
    ```bash
    npm run dev
    ```
    *   *Why HTTPS? Web Bluetooth API is only exposed in secure contexts. Vite uses a local self-signed certificate. You may need to click "Advanced" and "Proceed to localhost (unsafe)" in your browser when loading the local server for the first time.*

---

## 🔬 How Scale Connecting & BIA Works

### 1. BLE Byte Parsing
The Xiaomi Mi Body Composition Scale 2 broadcasts its weight and impedance measurements in a 13-byte Little-Endian packet.
MorphIQ parses this byte buffer using a JavaScript `DataView`:
*   **Control Flags (Bytes 0-1):** Decodes unit type (kg vs lb/jin), lock status (is stabilized), and whether impedance is present.
*   **Weight (Bytes 11-12):** Divided by 200 (for kg) or 100 (for lb).
*   **Impedance (Bytes 9-10):** Read as raw electrical resistance in Ohms ($\Omega$).

### 2. BIA Equations
Once weight and impedance are extracted, MorphIQ runs the reverse-engineered Huami physiological regression models to compute the following:
*   **Lean Body Mass (LBM) Coefficient:** Combined height, age, and weight adjusted by impedance resistance.
*   **Body Fat %:** Deducts age-based constant offsets from LBM and adjusts weight-height coefficients.
*   **Total Body Water %, Bone Mass, Muscle Mass, Visceral Fat Index, Basal Metabolic Rate (BMR), Protein %, and Metabolic Age.**

---

## 🧪 Testing

We implement rigorous unit testing to verify the mathematical models and IndexedDB repositories. 
To run the Vitest test suite:
```bash
npm run test
```
The test suite polyfills IndexedDB using `fake-indexeddb` to run database CRUD and cascading deletion tests fully offline.

---

## 📦 How to Publish on GitHub

To publish this project to your GitHub account:

1.  Create a new, empty repository on GitHub named `morphiq` (do not add a README, license, or `.gitignore` on creation).
2.  In your terminal, add your remote origin (replace `<username>` with your GitHub username):
    ```bash
    git remote add origin https://github.com/<username>/morphiq.git
    ```
3.  Rename your primary branch to `main`:
    ```bash
    git branch -M main
    ```
4.  Push your initial commit to GitHub:
    ```bash
    git push -u origin main
    ```
