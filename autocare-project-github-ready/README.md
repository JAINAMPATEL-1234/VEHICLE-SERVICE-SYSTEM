# AutoCare Service Hub — Production-Ready Vehicle Service Management

A complete, modern, professional vehicle service management platform built for speed, transparency, and operational reliability. Features customer appointments & live GPS milestone tracking, technician diagnostics & status publishing, and an executive administration hub.

Designed with a rich, dark-mode automotive aesthetic, glassmorphism surfaces, glowing crimson accents, certified OEM service catalogue, and keyboard-friendly responsive forms.

---

## ⚡ Quick Start

### 1. Run with Node.js (Zero external database required)
The platform features an embedded persistent JSON storage layer with atomic file writes, pre-seeded demo accounts, 30 service-ready car models, and 15 certified service packages.

```bash
node server.js
# Access the live website at http://localhost:3000
```

### 2. Optional: Connect PostgreSQL with Prisma
To migrate to PostgreSQL for enterprise production deployment:

```bash
# 1. Configure your database credentials in .env
cp .env.example .env

# 2. Run Prisma migration and seed
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

---

## 🔑 Demo Accounts & Credentials

All test accounts use `DemoPass123!`:

| Portal Role | Demo Account Email | Access Privileges |
| :--- | :--- | :--- |
| **Customer** | `rhea@example.com` | Garage management, book appointments, live vehicle tracking, invoices |
| **Technician / Employee** | `arjun@autocare.example` | Assigned bay jobs, 42-point checklists, live milestone status publishing |
| **Administrator** | `admin@autocare.example` | Operations command center, revenue metrics, staff reassignment, audit logs |

> **Tip:** In the **Sign In** modal, click any role tab (*Customer*, *Technician*, or *Admin*) to autofill the credentials with one click.

---

## 🚀 Key Functional Modules

### 1. Interactive Homepage
- Atmospheric hero with dynamic lighting, live customer ratings, and workshop capacity indicators.
- Animated trust standards marquee and value proposition highlights.
- Curated service showcase with direct booking integration.
- 12-Month warranty promise with 42-point digital diagnostic overview.
- How-It-Works 4-step transparent service journey.
- Real customer reviews and Koramangala, Bengaluru workshop contact band.

### 2. Searchable 30-Car Model Catalogue
- Full coverage across 6 leading manufacturers: **Toyota, Hyundai, Maruti Suzuki, Tata Motors, Honda, and Kia**.
- Real-time search by model, engine, fuel type, or body style.
- Filter dropdowns by Manufacturer and Body Style (SUV, Sedan, Hatchback, MPV, EV).
- Dedicated technical specification detail pages with direct "Book Service" actions.

### 3. Certified 15-Service Menu
- Transparent pricing, turnaround duration, recommended frequency, and itemized component checks for all 15 services:
  1. *General / Periodic Service*
  2. *Engine Oil & Filter Change*
  3. *AC Service & Repair*
  4. *Brake Inspection & Repair*
  5. *Battery Check & Replacement*
  6. *Wheel Alignment & Balancing*
  7. *Tyre Rotation & Replacement*
  8. *Car Wash & Detailing*
  9. *Dent & Paint Repair*
  10. *Clutch & Transmission Service*
  11. *Suspension Service*
  12. *Electrical Diagnostics*
  13. *Insurance Inspection*
  14. *Emergency Roadside Assistance*
  15. *EV Inspection & Maintenance*

### 4. Real-Time Vehicle Tracking
- Requires Booking ID (e.g., `AC-2026-0816`) + Customer Email or Vehicle Registration Number.
- **5-Step Graphical Roadmap:** `Received` ➔ `Inspection` ➔ `In Progress` ➔ `Quality Check` ➔ `Ready for Delivery`.
- Active glowing milestone pulse indicator, advisor notes, and timestamps.
- One-click print/save service certificate.

### 5. Role-Based Dashboards
- **Customer Workspace:**
  - Registered garage vehicles with "+ Add Vehicle" modal.
  - Active appointment cards with live track shortcuts.
  - Complete historical records and printable tax invoices.
- **Technician Workspace:**
  - Assigned repair bays with priority badges (High, Medium, Normal).
  - Search and filter jobs by status.
  - "UPDATE STATUS" modal to publish milestones, update customer notes, and change completion ETA.
  - Daily 42-point inspection checklists.
- **Administrator Command Center:**
  - Real-time computed KPIs (Total Customers, Active Jobs, Completed Services, Service Revenue).
  - Monthly revenue trend bar charts.
  - Status overview breakdown.
  - Staff assignment queue: dynamically reassign technicians with real server updates.
  - Immutable system audit log.

---

## 🛡️ Security & Backend Architecture

- **Server-Side Validation:** All inputs validated using **Zod** (`RegisterSchema`, `LoginSchema`, `BookingSchema`, `StatusUpdateSchema`, `ContactSchema`).
- **Cryptographic Security:** Passwords hashed with `bcryptjs` (salt cost 10).
- **Authentication & RBAC:** Short-lived JWT bearer tokens with role-based route guards (`CUSTOMER`, `EMPLOYEE`, `ADMIN`).
- **Data Protection:** Customer bookings isolated from unauthorized accounts.
- **HTTP Security Headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **Atomic Persistence:** Thread-safe temporary file swap mechanism prevents JSON database corruption.

---

## 📡 REST API Reference

| Endpoint | Method | Role Required | Purpose |
| :--- | :---: | :---: | :--- |
| `/api/health` | `GET` | Public | System status and database health check |
| `/api/cars` | `GET` | Public | Returns car catalogue (supports `?brand=`, `?type=`, `?q=`) |
| `/api/cars/:id` | `GET` | Public | Returns detailed vehicle specifications |
| `/api/services` | `GET` | Public | Returns all 15 services with pricing and inclusions |
| `/api/track/:id` | `GET` | Identifier / Auth | Privacy-protected tracking (requires `identifier=emailOrReg`) |
| `/api/auth/register` | `POST` | Public | Registers customer with hashed password |
| `/api/auth/login` | `POST` | Public | Authenticates credentials and returns JWT token |
| `/api/auth/me` | `GET` | Authenticated | Retrieves current user profile and garage |
| `/api/bookings` | `GET` | Authenticated | Lists bookings scoped by role |
| `/api/bookings` | `POST` | Public / Auth | Creates new booking and generates `AC-2026-XXXX` |
| `/api/bookings/:id/status` | `PATCH` | Employee / Admin | Publishes status milestone and advisor notes |
| `/api/bookings/:id/assign` | `PATCH` | Admin | Reassigns technician to a booking |
| `/api/vehicles` | `GET` / `POST` | Customer | Views or adds customer vehicles |
| `/api/contact` | `POST` | Public | Submits customer message to workshop inquiries |
| `/api/admin/metrics` | `GET` | Admin | Live computed KPI cards and revenue metrics |
| `/api/admin/logs` | `GET` | Admin | System operational audit feed |

---

## 🧪 Verification & Syntax Check

Run syntax verification on all client and server files:
```bash
node --check app.js
node --check server.js
```
All files pass validation with 0 errors.
