# Sleek Minimalist Workout Logger

A mobile-first, dark-theme-first digital notebook for strength trainers designed for one-handed operation. It replaces complex, cluttered fitness platform tracking with a simple logger that gets out of your way and minimizes typing.

## Tech Stack
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4, React Router, TanStack Query, React Hook Form, Recharts, Lucide React (Icons).
- **Backend/Database**: Google Sheets (stored as rows) + Google Apps Script Web App (JSON CORS API).

---

## Getting Started

### 1. Run in Mock Mode (Offline Development)
Out-of-the-box, the application detects if no Google Script URL is saved and falls back to **mock mode**. This populates `localStorage` with seed workouts matching your history, allowing you to test:
- Autocomplete suggesting exercises.
- **Use Previous** button instantly parsing and populating weights, units, sets, and reps from your last entry.
- Recharts progress volume and weight analytics.
- Deletion safety triggers.

To start, run:
```bash
npm install
npm run dev
```
Open `http://localhost:5173/` in your browser.

---

## Google Sheet Database Setup & Deployment

To connect the application to your personal Google Sheet:

### 1. Create the Database Spreadsheet
1. Create a new Google Sheet.
2. Add two sheets named **Workouts** and **Exercises** with the following header rows (the Apps Script code will also generate them automatically if missing, but setting them up is recommended):
   - **Workouts**: `ID`, `Date`, `Workout Name`
   - **Exercises**: `Workout ID`, `Exercise`, `Weight`, `Unit`, `Sets`, `Reps`, `Notes`, `Image URL`

### 2. Add Google Apps Script REST Code
1. In your Spreadsheet toolbar, go to **Extensions** &gt; **Apps Script**.
2. Erase the default code and copy the contents of [gas/Code.js](file:///d:/Proyectos/workout-app/gas/Code.js) into the editor.
3. Save the project (e.g., name it `Workout Logger API`).

### 3. Deploy the REST Web App Endpoint
1. Click the blue **Deploy** button at the top-right &gt; **New deployment**.
2. Select **Web app** as the deployment type.
3. Configure the settings:
   - **Description**: `Workout Web App API v1`
   - **Execute as**: `Me (your-email@gmail.com)`
   - **Who has access**: `Anyone` *(This allows the React frontend to fetch/post entries without custom authentication steps)*
4. Click **Deploy**.
5. Copy the generated **Web app URL** (e.g., `https://script.google.com/macros/s/.../exec`).

### 4. Connect Web Client to Sheets
1. Open the Workout URL (or your local `http://localhost:5173/`).
2. Click the **Settings (Cog)** icon in the top header.
3. Paste your copied Google script Web App URL into the address text input field.
4. Click **Save & Connect**.
5. The application will refresh, verify connectivity to your Google Sheet, and begin downloading and uploading data directly to your spreadsheet!

---

## Key Features

- **Autocomplete Suggestions**: Start typing an exercise name; suggestions from your database will list immediately.
- **Single-Tap autofill**: When selecting a suggestion, click **Use Previous** to instantly copy weight, unit, sets, and reps from your last entry.
- **Analytical Line Charts**: Toggle between Weight progression and Volume progression ($Weight \times Sets \times Reps$).
- **Custom Image References**: Paste visual URL links (Imgur, Discord, etc.) on detail components to reference exercise style directly.
- **Safety Prompts**: Deletions warn before removing data from Google Sheets logs.
