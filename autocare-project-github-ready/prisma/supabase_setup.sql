-- ==============================================================================
-- AutoCare Service Hub — Supabase PostgreSQL Schema & Initial Data
-- Run this in Supabase: SQL Editor -> New query -> Paste & click "Run"
-- ==============================================================================

-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE "BookingStatus" AS ENUM (
    'BOOKING_RECEIVED',
    'APPOINTMENT_CONFIRMED',
    'VEHICLE_RECEIVED',
    'INSPECTION_STARTED',
    'ESTIMATE_AWAITING_APPROVAL',
    'WORK_IN_PROGRESS',
    'WAITING_FOR_SPARE_PARTS',
    'QUALITY_CHECK',
    'READY_FOR_DELIVERY',
    'COMPLETED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentPreference" AS ENUM ('PAY_AT_CENTER', 'CARD_OR_UPI');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. TABLES

CREATE TABLE IF NOT EXISTS "Role" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "mobile" TEXT,
  "passwordHash" TEXT NOT NULL,
  "emailVerifiedAt" TIMESTAMP(3),
  "employeeCode" TEXT UNIQUE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "roleId" TEXT NOT NULL REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CarCompany" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CarModel" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "fuelType" TEXT NOT NULL,
  "transmission" TEXT NOT NULL,
  "seatingCapacity" INTEGER NOT NULL,
  "engine" TEXT NOT NULL,
  "mileageOrRange" TEXT NOT NULL,
  "priceRange" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "serviceInterval" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "companyId" TEXT NOT NULL REFERENCES "CarCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CarModel_companyId_name_key" UNIQUE ("companyId", "name")
);

CREATE TABLE IF NOT EXISTS "Vehicle" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "registrationNumber" TEXT NOT NULL UNIQUE,
  "vin" TEXT,
  "year" INTEGER NOT NULL,
  "color" TEXT,
  "mileage" INTEGER,
  "fuelType" TEXT,
  "customerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "carModelId" TEXT NOT NULL REFERENCES "CarModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ServiceType" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL UNIQUE,
  "description" TEXT NOT NULL,
  "estimatedDurationMin" INTEGER NOT NULL,
  "startingPrice" DECIMAL(10, 2) NOT NULL,
  "included" TEXT NOT NULL,
  "frequency" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "ServicePackage" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" DECIMAL(10, 2) NOT NULL,
  "serviceTypeId" TEXT NOT NULL REFERENCES "ServiceType"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ServicePackage_serviceTypeId_name_key" UNIQUE ("serviceTypeId", "name")
);

CREATE TABLE IF NOT EXISTS "ServiceBooking" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "publicId" TEXT NOT NULL UNIQUE,
  "appointmentAt" TIMESTAMP(3) NOT NULL,
  "pickupDrop" BOOLEAN NOT NULL DEFAULT false,
  "customerNotes" TEXT,
  "paymentPreference" "PaymentPreference" NOT NULL DEFAULT 'PAY_AT_CENTER',
  "status" "BookingStatus" NOT NULL DEFAULT 'BOOKING_RECEIVED',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "estimatedCompletionAt" TIMESTAMP(3),
  "customerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "vehicleId" TEXT NOT NULL REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "serviceTypeId" TEXT NOT NULL REFERENCES "ServiceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "servicePackageId" TEXT REFERENCES "ServicePackage"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "BookingStatusHistory" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "status" "BookingStatus" NOT NULL,
  "customerNote" TEXT,
  "internalNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bookingId" TEXT NOT NULL REFERENCES "ServiceBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "changedById" TEXT
);

CREATE TABLE IF NOT EXISTS "EmployeeAssignment" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "bookingId" TEXT NOT NULL REFERENCES "ServiceBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "employeeId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeAssignment_bookingId_employeeId_key" UNIQUE ("bookingId", "employeeId")
);

CREATE TABLE IF NOT EXISTS "ServiceChecklist" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "label" TEXT NOT NULL,
  "isComplete" BOOLEAN NOT NULL DEFAULT false,
  "bookingId" TEXT NOT NULL REFERENCES "ServiceBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ServiceNote" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "body" TEXT NOT NULL,
  "isCustomerVisible" BOOLEAN NOT NULL DEFAULT false,
  "bookingId" TEXT NOT NULL REFERENCES "ServiceBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "authorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ServiceEstimate" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "laborCost" DECIMAL(10, 2) NOT NULL,
  "partsCost" DECIMAL(10, 2) NOT NULL,
  "tax" DECIMAL(10, 2) NOT NULL,
  "total" DECIMAL(10, 2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "approvedAt" TIMESTAMP(3),
  "bookingId" TEXT NOT NULL UNIQUE REFERENCES "ServiceBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SparePart" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "sku" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitCost" DECIMAL(10, 2) NOT NULL,
  "bookingId" TEXT NOT NULL REFERENCES "ServiceBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Invoice" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invoiceNo" TEXT NOT NULL UNIQUE,
  "subtotal" DECIMAL(10, 2) NOT NULL,
  "tax" DECIMAL(10, 2) NOT NULL,
  "total" DECIMAL(10, 2) NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pdfUrl" TEXT,
  "bookingId" TEXT NOT NULL UNIQUE REFERENCES "ServiceBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "EmailLog" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "toEmail" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
  "providerId" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "bookingId" TEXT REFERENCES "ServiceBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 3. SEED INITIAL DATA

-- Roles
INSERT INTO "Role" ("id", "name") VALUES 
  ('role_admin', 'ADMIN'),
  ('role_employee', 'EMPLOYEE'),
  ('role_customer', 'CUSTOMER')
ON CONFLICT ("name") DO NOTHING;

-- Demo Users (Password: DemoPass123!)
INSERT INTO "User" ("id", "name", "email", "mobile", "passwordHash", "roleId", "employeeCode", "emailVerifiedAt") VALUES
  ('usr_admin_1', 'Anika Kapoor', 'admin@autocare.example', '+91 98888 10000', '$2a$10$V1Xp/rlqxf6nvLEo0Yl8r.BsaGgK1hPMHZKw/NeFt72qzVHTnUzxC', 'role_admin', 'AC-ADM-01', NOW()),
  ('usr_emp_1', 'Arjun Mehta', 'arjun@autocare.example', '+91 98888 10011', '$2a$10$V1Xp/rlqxf6nvLEo0Yl8r.BsaGgK1hPMHZKw/NeFt72qzVHTnUzxC', 'role_employee', 'AC-EMP-01', NOW()),
  ('usr_emp_2', 'Riya Shah', 'riya@autocare.example', '+91 98888 10012', '$2a$10$V1Xp/rlqxf6nvLEo0Yl8r.BsaGgK1hPMHZKw/NeFt72qzVHTnUzxC', 'role_employee', 'AC-EMP-02', NOW()),
  ('usr_emp_3', 'Manav Kapoor', 'manav@autocare.example', '+91 98888 10013', '$2a$10$V1Xp/rlqxf6nvLEo0Yl8r.BsaGgK1hPMHZKw/NeFt72qzVHTnUzxC', 'role_employee', 'AC-EMP-03', NOW()),
  ('usr_cust_1', 'Rhea Nair', 'rhea@example.com', '+91 98888 10001', '$2a$10$V1Xp/rlqxf6nvLEo0Yl8r.BsaGgK1hPMHZKw/NeFt72qzVHTnUzxC', 'role_customer', NULL, NOW()),
  ('usr_cust_2', 'Kabir Rao', 'kabir@example.com', '+91 98888 10002', '$2a$10$V1Xp/rlqxf6nvLEo0Yl8r.BsaGgK1hPMHZKw/NeFt72qzVHTnUzxC', 'role_customer', NULL, NOW()),
  ('usr_cust_3', 'Kavya Arora', 'kavya@example.com', '+91 98888 10003', '$2a$10$V1Xp/rlqxf6nvLEo0Yl8r.BsaGgK1hPMHZKw/NeFt72qzVHTnUzxC', 'role_customer', NULL, NOW())
ON CONFLICT ("email") DO NOTHING;

-- Car Companies
INSERT INTO "CarCompany" ("id", "name") VALUES
  ('comp_toyota', 'Toyota'),
  ('comp_hyundai', 'Hyundai'),
  ('comp_maruti', 'Maruti Suzuki'),
  ('comp_tata', 'Tata Motors'),
  ('comp_honda', 'Honda'),
  ('comp_kia', 'Kia')
ON CONFLICT ("name") DO NOTHING;

-- 30 Car Models
INSERT INTO "CarModel" ("companyId", "name", "type", "fuelType", "transmission", "seatingCapacity", "engine", "mileageOrRange", "priceRange", "description", "serviceInterval", "imageUrl") VALUES
  ('comp_toyota', 'Glanza', 'Hatchback', 'Petrol / CNG', 'Manual / AMT', 5, '1.2L DualJet Dual VVT', '22.35–30.61 km/kg', '₹6.86–10.00L', 'Sleek premium hatchback offering dynamic performance.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1200&q=80'),
  ('comp_toyota', 'Urban Cruiser Hyryder', 'SUV', 'Petrol / Strong Hybrid', 'Manual / e-Drive', 5, '1.5L TNGA Atkinson Cycle', '27.97 km/l', '₹11.14–20.19L', 'Self-charging hybrid SUV delivering quiet electric city drives.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80'),
  ('comp_toyota', 'Innova Crysta', 'SUV', 'Diesel', '5-Speed Manual', 7, '2.4L GD Turbo Diesel', '15.6 km/l', '₹19.99–26.30L', 'Legendary long-distance people mover with unrivaled reliability.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80'),
  ('comp_toyota', 'Fortuner', 'SUV', 'Diesel / Petrol', 'Manual / 6-Speed Auto', 7, '2.8L Turbo Diesel (500Nm)', '10.5–14.4 km/l', '₹36.05–52.34L', 'Commanding full-size 4x4 SUV with high-torque drivetrain.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80'),
  ('comp_toyota', 'Camry', 'Sedan', 'Strong Hybrid', 'e-CVT with Paddle Shifters', 5, '2.5L Dynamic Force Hybrid', '25.49 km/l', '₹48.00L', 'Luxury executive sedan blending silent hybrid cruising with comfort.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80'),

  ('comp_hyundai', 'Grand i10 Nios', 'Hatchback', 'Petrol / CNG', 'Manual / Smart AMT', 5, '1.2L Kappa 4-Cylinder', '20.7–27.0 km/kg', '₹5.98–8.62L', 'Agile city hatchback packed with 8-inch infotainment.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1200&q=80'),
  ('comp_hyundai', 'i20', 'Hatchback', 'Petrol', 'Manual / IVT', 5, '1.2L Kappa VVT', '16.0–20.0 km/l', '₹7.51–11.21L', 'Sharp, European-inspired premium hatchback boasting Bose sound.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1200&q=80'),
  ('comp_hyundai', 'Verna', 'Sedan', 'Turbo Petrol / Petrol', 'Manual / 7-Speed DCT', 5, '1.5L Turbo GDi (160PS)', '18.6–20.6 km/l', '₹10.69–16.98L', 'Futuristic fastback silhouette with dual integrated panoramic screens.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80'),
  ('comp_hyundai', 'Creta', 'SUV', 'Petrol / Turbo / Diesel', 'Manual / IVT / AT / DCT', 5, '1.5L Turbo / 1.5L CRDi', '17.4–21.8 km/l', '₹11.11–20.50L', 'Indias favorite midsize SUV featuring panoramic sunroof.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80'),
  ('comp_hyundai', 'Alcazar', 'SUV', 'Turbo Petrol / Diesel', 'Manual / 7-DCT / 6-AT', 7, '1.5L Turbo GDi (160PS)', '17.5–20.4 km/l', '₹14.99–21.70L', 'Refined 3-row family SUV with second-row wireless charging.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80'),

  ('comp_maruti', 'Swift', 'Hatchback', 'Petrol', 'Manual / AMT', 5, '1.2L Z-Series 3-Cylinder', '24.8–25.75 km/l', '₹6.49–9.64L', 'Sporty iconic hatchback with ultra-responsive chassis tuning.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1200&q=80'),
  ('comp_maruti', 'Dzire', 'Sedan', 'Petrol / CNG', 'Manual / AMT', 5, '1.2L Z-Series DOHC', '25.71–33.73 km/kg', '₹6.84–10.19L', 'Indias top compact sedan engineered for comfortable family travel.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80'),
  ('comp_maruti', 'Baleno', 'Hatchback', 'Petrol / CNG', 'Manual / AGS', 5, '1.2L DualJet Dual VVT', '22.35–30.61 km/kg', '₹6.66–9.88L', 'Spacious wide-body hatch equipped with Heads Up Display.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1200&q=80'),
  ('comp_maruti', 'Grand Vitara', 'SUV', 'Mild / Strong Hybrid', 'Manual / AT / e-CVT', 5, '1.5L Intelligent Hybrid / K15C', '21.1–27.97 km/l', '₹11.42–20.68L', 'Bold lifestyle SUV featuring AllGrip Select 4WD.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80'),
  ('comp_maruti', 'Jimny', 'SUV', 'Petrol', '5-Speed MT / 4-Speed AT', 4, '1.5L K15B AllGrip Pro 4x4', '16.39–16.94 km/l', '₹12.76–14.96L', 'Authentic ladder-frame offroader with low-range transfer gearbox.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80'),

  ('comp_tata', 'Tiago', 'Hatchback', 'Petrol / CNG / EV', 'Manual / AMT', 5, '1.2L Revotron 3-Cylinder', '19.0–26.49 km/kg', '₹4.99–8.95L', 'Robust 4-star safety rated compact hatchback with Harman infotainment.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1200&q=80'),
  ('comp_tata', 'Punch', 'SUV', 'Petrol / CNG / EV', 'Manual / AMT', 5, '1.2L Revotron with DynaPro', '18.8–26.99 km/kg', '₹6.13–10.20L', 'Rugged sub-compact SUV with 187mm ground clearance.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80'),
  ('comp_tata', 'Nexon', 'SUV', 'Petrol / Diesel / EV', 'Manual / DCA / AMT', 5, '1.2L Turbo Petrol / 1.5L Diesel', '17.4–24.0 km/l', '₹8.15–15.80L', 'Market-leading compact SUV featuring bi-functional LED headlamps.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80'),
  ('comp_tata', 'Harrier', 'SUV', 'Diesel', '6-Speed MT / 6-Speed AT', 5, '2.0L Kryotec Turbo Diesel', '14.6–16.8 km/l', '₹14.99–26.44L', 'Land Rover D8 platform derived flagship SUV.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80'),
  ('comp_tata', 'Safari', 'SUV', 'Diesel', '6-Speed MT / 6-Speed AT', 7, '2.0L Kryotec Turbo (350Nm)', '14.5–16.3 km/l', '₹15.50–27.34L', 'Imposing 3-row SUV with ventilated captain seats.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80'),

  ('comp_honda', 'Amaze', 'Sedan', 'Petrol', 'Manual / CVT', 5, '1.2L i-VTEC 4-Cylinder', '18.6–19.5 km/l', '₹8.10–11.20L', 'Refined family sedan delivering smooth CVT automatic drive.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80'),
  ('comp_honda', 'City', 'Sedan', 'Petrol / e:HEV Hybrid', '6-Speed MT / CVT / e-CVT', 5, '1.5L i-VTEC / 1.5L Atkinson', '18.4–27.1 km/l', '₹11.82–20.75L', 'The benchmark mid-size sedan with Honda Sensing ADAS.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80'),
  ('comp_honda', 'Elevate', 'SUV', 'Petrol', '6-Speed MT / 7-Speed CVT', 5, '1.5L DOHC i-VTEC', '15.3–16.9 km/l', '₹11.91–16.73L', 'High-stance midsize SUV offering 220mm ground clearance.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80'),
  ('comp_honda', 'Civic', 'Sedan', 'Petrol / Hybrid', 'CVT / e-CVT', 5, '2.0L e:HEV Direct Injection', '21.0 km/l', '₹22.50–28.00L', 'Aerodynamic sport sedan with multi-link rear suspension.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?auto=format&fit=crop&w=1200&q=80'),
  ('comp_honda', 'WR-V', 'SUV', 'Petrol', 'Manual / CVT', 5, '1.5L i-VTEC High Output', '16.5 km/l', '₹10.50–14.20L', 'Urban crossover combining spacious cabin ergonomics.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80'),

  ('comp_kia', 'Sonet', 'SUV', 'Petrol / Turbo / Diesel', 'Manual / iMT / 6-AT / 7-DCT', 5, '1.0L Turbo GDi / 1.5L CRDi', '18.2–22.3 km/l', '₹8.00–15.70L', 'Feature-rich compact SUV equipped with front ventilated seats.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80'),
  ('comp_kia', 'Seltos', 'SUV', 'Petrol / Turbo / Diesel', 'Manual / IVT / 6-AT / 7-DCT', 5, '1.5L Turbo GDi (160PS)', '17.0–20.7 km/l', '₹11.19–20.56L', 'Striking SUV with dual panoramic 10.25-inch displays.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80'),
  ('comp_kia', 'Carens', 'SUV', 'Petrol / Turbo / Diesel', 'Manual / iMT / 6-AT / 7-DCT', 7, '1.5L Turbo GDi / 1.5L CRDi', '15.7–21.3 km/l', '₹10.60–19.70L', 'Versatile 6 or 7 seater with one-touch electric tumble seats.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80'),
  ('comp_kia', 'Carnival', 'SUV', 'Diesel', '8-Speed Automatic', 7, '2.2L Smartstream CRDi (440Nm)', '14.85 km/l', '₹63.90L', 'Ultra-luxurious limousine with VIP lounge relaxation seats.', 'Every 10,000 km / 12 months', 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80'),
  ('comp_kia', 'EV6', 'SUV', 'Electric', 'Automatic Single-Speed', 5, 'Dual Motor AWD (325PS)', '708 km ARAI range', '₹65.97L', 'Award-winning 800V ultra-fast charging electric crossover.', 'Every 15,000 km / 12 months', 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1200&q=80')
ON CONFLICT ("companyId", "name") DO NOTHING;

-- 15 Service Types
INSERT INTO "ServiceType" ("name", "description", "estimatedDurationMin", "startingPrice", "included", "frequency", "isActive") VALUES
  ('General / Periodic Service', 'Comprehensive 42-point digital inspection, engine oil check, fluid top-ups, spark plug clean.', 180, 2499.00, 'Engine oil level test, coolant top-up, filter clean, 42-point safety diagnosis', 'Every 10,000 km / 12 months', true),
  ('Engine Oil & Filter Change', 'Complete engine flush, OEM-grade synthetic oil replacement, brand-new oil filter installation.', 60, 1699.00, 'Synthetic oil replacement, new OEM filter, drain plug seal replacement', 'Every 8,000–10,000 km', true),
  ('AC Service & Repair', 'Complete climate control overhaul: condenser washing, refrigerant gas pressure top-up, blower clean.', 120, 1899.00, 'AC gas pressure check, condenser wash, cabin filter cleaning, ozone fumigation', 'Every 12 months', true),
  ('Brake Inspection & Repair', 'Four-wheel caliper inspection, brake pad thickness measurement, rotor disc inspection.', 90, 1299.00, 'Front & rear brake pad check, rotor runout assessment, caliper pin lubrication', 'Every 10,000 km', true),
  ('Battery Check & Replacement', 'High-rate discharge load test, alternator voltage output calibration, terminal treatment.', 30, 499.00, 'Digital cranking amp test, alternator check, terminal wire seal', 'Every 6 months', true),
  ('Wheel Alignment & Balancing', 'Precision computer-assisted 3D four-wheel alignment, dynamic balancing.', 60, 899.00, '3D laser caster/camber/toe calibration, high-speed balancing, tire diagnostic', 'Every 8,000 km', true),
  ('Tyre Rotation & Replacement', 'Scientific 5-tyre cross rotation, digital tread depth measurement, bead inspection.', 45, 699.00, '5-wheel cross rotation, tread depth measurement, rim check, nitrogen inflation', 'Every 8,000 km', true),
  ('Car Wash & Detailing', 'Snow foam pH-neutral exterior shampoo, interior vacuuming, dashboard UV conditioning.', 120, 1499.00, 'Two-bucket wash, snow foam, interior vacuuming, footwell cleaning, UV conditioning', 'Every 1–3 months', true),
  ('Dent & Paint Repair', 'Computerized paint shade matching, infrared heated paint booth bake, spot dent pulling.', 1440, 2999.00, 'Paint spectrometer match, heated booth application, 3-year warranty, 3-stage polish', 'As needed', true),
  ('Clutch & Transmission Service', 'Transmission fluid flush, clutch plate wear assessment, release bearing inspection.', 240, 3499.00, 'Gear oil drain & flush, clutch pedal free play check, flywheel inspection', 'Every 40,000 km', true),
  ('Suspension Service', 'Shock absorber rebound testing, stabilizer link and ball joint check, strut mount check.', 180, 2499.00, 'Strut leak inspection, bushing wear analysis, ball joint play check', 'Every 25,000 km', true),
  ('Electrical Diagnostics', 'Full OBD-II onboard ECU scanner diagnostic, sensor voltage testing, error code clearing.', 60, 999.00, 'Universal OBD-II engine scan, real-time live sensor logging, DTC reset', 'As needed', true),
  ('Insurance Inspection', 'Cashless claim liaison with all major insurers, photographic damage documentation.', 120, 0.00, 'Detailed damage photography, OEM parts estimate, direct liaison with surveyor', 'At claim time', true),
  ('Emergency Roadside Assistance', 'Rapid emergency response team for flat tyres, battery jump-starts, towing.', 45, 799.00, '24/7 dedicated dispatch hotline, flatbed towing coordination, on-spot jump start', '24/7 On Demand', true),
  ('EV Inspection & Maintenance', 'High-voltage insulation resistance check, battery management system (BMS) cell balancing.', 120, 2999.00, 'High-voltage wiring safety check, BMS battery health diagnostic, thermal loop test', 'Every 10,000 km / 12 months', true)
ON CONFLICT ("name") DO NOTHING;
