# AIRSPACE Live Demonstration Script

This script outlines a 3–5 minute end-to-end demonstration flow highlighting the capabilities of the AIRSPACE platform.

---

## ⏱️ Timeline & Step-by-Step Sequence

### 1. Landing Page & Introduction (0:00 - 0:45)
* **Action**: Open `http://localhost:3000`. Show the futuristic dark landing page, vector tracer SVG loop simulation, and system architecture summary.
* **Talking Point**: *"AIRSPACE is a spatial interaction platform converting simple camera feeds into a precise digital canvas. No glove or special depth camera needed—just standard browser camera APIs."*

### 2. Cockpit Dashboard & Health Check (0:45 - 1:15)
* **Action**: Click **Launch AIRSPACE**. Show the workspace launch shortcuts and connection health badges (Camera, WebSocket, and Database liveness indicators).
* **Talking Point**: *"The App Dashboard serves as our control cockpit. Liveness trackers check backend and database health checks automatically."*

### 3. Air Write (1:15 - 2:00)
* **Action**: Navigate to **Air Write**. Click **Start Writing** (or toggle Demo Mode).
* **Gesture**: Raise your hand. PINCH to draw a character (e.g., `'A'`), then release your hand.
* **Action**: Click **Recognize**. Show the predicted character and probability scores. Click **Accept** to append to the text box.
* **Talking Point**: *"Air Write captures trajectories and maps them to characters using a Dynamic Time Warping (DTW) recognition algorithm, saving verified logs directly to database session rows."*

### 4. Air Canvas (2:00 - 2:45)
* **Action**: Navigate to **Air Canvas**. Choose the **PEN** tool.
* **Gesture**: Draw a rough circle. Click **Convert Shape**. Show the converted perfect vector circle.
* **Action**: Toggle **SELECT** tool, grab the circle, and drag it. Click **Save Canvas** to persist state to the database.
* **Talking Point**: *"Air Canvas translates rough gestures into clean vector objects, supporting dragging, scaling, and database serialization."*

### 5. Math Mode & Grapher (2:45 - 3:30)
* **Action**: Navigate to **Math Mode**.
* **Gesture**: Write a math formula (e.g. `y = x**2`).
* **Action**: Click **Solve & Plot**. View the solution, step explanations, and interactive graph plots.
* **Talking Point**: *"Math Mode parses wrote formulas, evaluates variables, and plots neon math functions in real-time."*

### 6. AI Lab & Context Queries (3:30 - 4:00)
* **Action**: Navigate to **AI Lab**. In the chat input, type: *"Solve this equation"* or *"Erase selected shapes"*.
* **Talking Point**: *"AI Lab links user messages with workspace context, matching intents to drive canvas tools dynamically."*

### 7. Analytics & Privacy Reset (4:00 - 4:30)
* **Action**: Navigate to **Analytics** to see the newly generated telemetry charts.
* **Action**: Open **Settings**, click **Purge History**, and confirm. Refresh Analytics to show the reset state.
* **Talking Point**: *"Telemetry is compiled automatically. Privacy controls allow wiping all session history logs instantly."*
