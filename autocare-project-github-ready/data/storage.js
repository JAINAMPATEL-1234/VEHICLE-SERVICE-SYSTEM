/**
 * Persistent Data Store for AutoCare Service Hub
 * Stores users, vehicles, services, cars, bookings, audit logs, and contact messages.
 * Uses atomic JSON file persistence with automatic initial seeding.
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname);
const DB_FILE = path.join(DATA_DIR, 'db.json');

// High quality curated automotive images with reliable CDNs
const IMAGES = {
  hero: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=1920&q=80',
  workshop: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=1200&q=80',
  technician: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=1200&q=80',
  sedan: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80',
  suv: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80',
  luxury: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
  sports: 'https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?auto=format&fit=crop&w=1200&q=80',
  ev: 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1200&q=80',
  detail: 'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&w=1200&q=80',
  brakes: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=1200&q=80',
  engine: 'https://images.unsplash.com/photo-1486754735734-325b5831c3ad?auto=format&fit=crop&w=1200&q=80',
  hatchback: 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=1200&q=80'
};

// 30 full cars with real manufacturer specs and assigned images
const CAR_CATALOGUE = [
  // Toyota
  { id: 1, brand: 'Toyota', model: 'Glanza', type: 'Hatchback', fuel: 'Petrol / CNG', transmission: 'Manual / AMT', seats: 5, engine: '1.2L DualJet Dual VVT', mileage: '22.35–30.61 km/kg', price: '₹6.86–10.00L', image: IMAGES.hatchback, description: 'Sleek premium hatchback offering dynamic performance, outstanding fuel economy, and 360-degree camera assistance.', interval: 'Every 10,000 km / 12 months' },
  { id: 2, brand: 'Toyota', model: 'Urban Cruiser Hyryder', type: 'SUV', fuel: 'Petrol / Strong Hybrid', transmission: 'Manual / e-Drive', seats: 5, engine: '1.5L TNGA Atkinson Cycle', mileage: '27.97 km/l', price: '₹11.14–20.19L', image: IMAGES.suv, description: 'Self-charging hybrid SUV delivering quiet electric city drives, panoramic sunroof, and AWD option for rugged terrains.', interval: 'Every 10,000 km / 12 months' },
  { id: 3, brand: 'Toyota', model: 'Innova Crysta', type: 'MPV', fuel: 'Diesel', transmission: '5-Speed Manual', seats: 7, engine: '2.4L GD Turbo Diesel', mileage: '15.6 km/l', price: '₹19.99–26.30L', image: IMAGES.suv, description: 'Legendary long-distance people mover with unrivaled reliability, plush captain seats, and robust ladder-frame chassis.', interval: 'Every 10,000 km / 12 months' },
  { id: 4, brand: 'Toyota', model: 'Fortuner', type: 'SUV', fuel: 'Diesel / Petrol', transmission: 'Manual / 6-Speed Auto', seats: 7, engine: '2.8L Turbo Diesel (500Nm)', mileage: '10.5–14.4 km/l', price: '₹36.05–52.34L', image: IMAGES.luxury, description: 'Commanding full-size 4x4 SUV with high-torque drivetrain, auto-limited slip differential, and tough terrain prowess.', interval: 'Every 10,000 km / 12 months' },
  { id: 5, brand: 'Toyota', model: 'Camry', type: 'Sedan', fuel: 'Strong Hybrid', transmission: 'e-CVT with Paddle Shifters', seats: 5, engine: '2.5L Dynamic Force Hybrid', mileage: '25.49 km/l', price: '₹48.00L', image: IMAGES.sedan, description: 'Luxury executive sedan blending silent hybrid cruising with reclined rear executive seating and Mark Levinson audio.', interval: 'Every 10,000 km / 12 months' },

  // Hyundai
  { id: 6, brand: 'Hyundai', model: 'Grand i10 Nios', type: 'Hatchback', fuel: 'Petrol / CNG', transmission: 'Manual / Smart AMT', seats: 5, engine: '1.2L Kappa 4-Cylinder', mileage: '20.7–27.0 km/kg', price: '₹5.98–8.62L', image: IMAGES.hatchback, description: 'Agile city hatchback packed with 8-inch infotainment, wireless phone charging, and 6 standard airbags.', interval: 'Every 10,000 km / 12 months' },
  { id: 7, brand: 'Hyundai', model: 'i20', type: 'Hatchback', fuel: 'Petrol', transmission: 'Manual / IVT', seats: 5, engine: '1.2L Kappa VVT', mileage: '16.0–20.0 km/l', price: '₹7.51–11.21L', image: IMAGES.hatchback, description: 'Sharp, European-inspired premium hatchback boasting Bose premium sound, electric sunroof, and ambient illumination.', interval: 'Every 10,000 km / 12 months' },
  { id: 8, brand: 'Hyundai', model: 'Verna', type: 'Sedan', fuel: 'Turbo Petrol / Petrol', transmission: 'Manual / 7-Speed DCT', seats: 5, engine: '1.5L Turbo GDi (160PS)', mileage: '18.6–20.6 km/l', price: '₹10.69–16.98L', image: IMAGES.sedan, description: 'Futuristic fastback silhouette with dual integrated panoramic screens, ventilated front seats, and Level 2 ADAS.', interval: 'Every 10,000 km / 12 months' },
  { id: 9, brand: 'Hyundai', model: 'Creta', type: 'SUV', fuel: 'Petrol / Turbo / Diesel', transmission: 'Manual / IVT / AT / DCT', seats: 5, engine: '1.5L Turbo / 1.5L CRDi', mileage: '17.4–21.8 km/l', price: '₹11.11–20.50L', image: IMAGES.suv, description: 'India’s favorite midsize SUV, featuring voice-enabled panoramic sunroof, dual-zone climate, and 70+ safety features.', interval: 'Every 10,000 km / 12 months' },
  { id: 10, brand: 'Hyundai', model: 'Alcazar', type: 'SUV', fuel: 'Turbo Petrol / Diesel', transmission: 'Manual / 7-DCT / 6-AT', seats: 7, engine: '1.5L Turbo GDi (160PS)', mileage: '17.5–20.4 km/l', price: '₹14.99–21.70L', image: IMAGES.suv, description: 'Refined 3-row family SUV with second-row wireless charging, captain seat armrests, and 8-way power driver seat.', interval: 'Every 10,000 km / 12 months' },

  // Maruti Suzuki
  { id: 11, brand: 'Maruti Suzuki', model: 'Swift', type: 'Hatchback', fuel: 'Petrol', transmission: 'Manual / AMT', seats: 5, engine: '1.2L Z-Series 3-Cylinder', mileage: '24.8–25.75 km/l', price: '₹6.49–9.64L', image: IMAGES.hatchback, description: 'Sporty iconic hatchback with ultra-responsive chassis tuning, 9-inch SmartPlay Pro+ screen, and 6 airbags standard.', interval: 'Every 10,000 km / 12 months' },
  { id: 12, brand: 'Maruti Suzuki', model: 'Dzire', type: 'Sedan', fuel: 'Petrol / CNG', transmission: 'Manual / AMT', seats: 5, engine: '1.2L Z-Series DOHC', mileage: '25.71–33.73 km/kg', price: '₹6.84–10.19L', image: IMAGES.sedan, description: 'India’s top compact sedan engineered for comfortable family travel, unmatched fuel efficiency, and 5-star GNCAP safety.', interval: 'Every 10,000 km / 12 months' },
  { id: 13, brand: 'Maruti Suzuki', model: 'Baleno', type: 'Hatchback', fuel: 'Petrol / CNG', transmission: 'Manual / AGS', seats: 5, engine: '1.2L DualJet Dual VVT', mileage: '22.35–30.61 km/kg', price: '₹6.66–9.88L', image: IMAGES.hatchback, description: 'Spacious wide-body hatch equipped with Heads Up Display (HUD), UV cut glass, and surround vision cameras.', interval: 'Every 10,000 km / 12 months' },
  { id: 14, brand: 'Maruti Suzuki', model: 'Grand Vitara', type: 'SUV', fuel: 'Mild / Strong Hybrid', transmission: 'Manual / AT / e-CVT', seats: 5, engine: '1.5L Intelligent Hybrid / K15C', mileage: '21.1–27.97 km/l', price: '₹11.42–20.68L', image: IMAGES.suv, description: 'Bold lifestyle SUV featuring AllGrip Select 4WD, full-electric drive mode in traffic, and double-slide panoramic glass.', interval: 'Every 10,000 km / 12 months' },
  { id: 15, brand: 'Maruti Suzuki', model: 'Jimny', type: 'SUV', fuel: 'Petrol', transmission: '5-Speed MT / 4-Speed AT', seats: 4, engine: '1.5L K15B AllGrip Pro 4x4', mileage: '16.39–16.94 km/l', price: '₹12.76–14.96L', image: IMAGES.suv, description: 'Authentic ladder-frame offroader with low-range transfer gearbox, rigid axle suspension, and heritage trail capability.', interval: 'Every 10,000 km / 12 months' },

  // Tata Motors
  { id: 16, brand: 'Tata Motors', model: 'Tiago', type: 'Hatchback', fuel: 'Petrol / CNG / EV', transmission: 'Manual / AMT', seats: 5, engine: '1.2L Revotron 3-Cylinder', mileage: '19.0–26.49 km/kg', price: '₹4.99–8.95L', image: IMAGES.hatchback, description: 'Robust 4-star safety rated compact hatchback with Harman infotainment, dual-cylinder iCNG technology, and corner stability.', interval: 'Every 10,000 km / 12 months' },
  { id: 17, brand: 'Tata Motors', model: 'Punch', type: 'SUV', fuel: 'Petrol / CNG / EV', transmission: 'Manual / AMT', seats: 5, engine: '1.2L Revotron with DynaPro', mileage: '18.8–26.99 km/kg', price: '₹6.13–10.20L', image: IMAGES.suv, description: 'Rugged sub-compact SUV with 187mm ground clearance, 370mm water wading capacity, and 5-star adult safety certification.', interval: 'Every 10,000 km / 12 months' },
  { id: 18, brand: 'Tata Motors', model: 'Nexon', type: 'SUV', fuel: 'Petrol / Diesel / EV', transmission: 'Manual / DCA / AMT', seats: 5, engine: '1.2L Turbo Petrol / 1.5L Diesel', mileage: '17.4–24.0 km/l', price: '₹8.15–15.80L', image: IMAGES.suv, description: 'Market-leading compact SUV featuring bi-functional LED headlamps, 10.25-inch touchscreen navigation, and ventilated seats.', interval: 'Every 10,000 km / 12 months' },
  { id: 19, brand: 'Tata Motors', model: 'Harrier', type: 'SUV', fuel: 'Diesel', transmission: '6-Speed MT / 6-Speed AT', seats: 5, engine: '2.0L Kryotec Turbo Diesel (170PS)', mileage: '14.6–16.8 km/l', price: '₹14.99–26.44L', image: IMAGES.luxury, description: 'Land Rover D8 platform derived flagship SUV with terrain response modes, panoramic skyroof, and ADAS suite.', interval: 'Every 10,000 km / 12 months' },
  { id: 20, brand: 'Tata Motors', model: 'Safari', type: 'SUV', fuel: 'Diesel', transmission: '6-Speed MT / 6-Speed AT', seats: 7, engine: '2.0L Kryotec Turbo (350Nm)', mileage: '14.5–16.3 km/l', price: '₹15.50–27.34L', image: IMAGES.luxury, description: 'Imposing 3-row SUV with ventilated first & second row seats, gesture controlled powered tailgate, and 19-inch alloys.', interval: 'Every 10,000 km / 12 months' },

  // Honda
  { id: 21, brand: 'Honda', model: 'Amaze', type: 'Sedan', fuel: 'Petrol', transmission: 'Manual / CVT', seats: 5, engine: '1.2L i-VTEC 4-Cylinder', mileage: '18.6–19.5 km/l', price: '₹8.10–11.20L', image: IMAGES.sedan, description: 'Refined family sedan delivering smooth CVT automatic drive, 420L boot capacity, and advanced crash protection.', interval: 'Every 10,000 km / 12 months' },
  { id: 22, brand: 'Honda', model: 'City', type: 'Sedan', fuel: 'Petrol / e:HEV Hybrid', transmission: '6-Speed MT / CVT / e-CVT', seats: 5, engine: '1.5L i-VTEC / 1.5L Atkinson Hybrid', mileage: '18.4–27.1 km/l', price: '₹11.82–20.75L', image: IMAGES.sedan, description: 'The benchmark mid-size sedan with Honda Sensing ADAS, lane-watch camera, one-touch electric sunroof, and plush leather upholstery.', interval: 'Every 10,000 km / 12 months' },
  { id: 23, brand: 'Honda', model: 'Elevate', type: 'SUV', fuel: 'Petrol', transmission: '6-Speed MT / 7-Speed CVT', seats: 5, engine: '1.5L DOHC i-VTEC', mileage: '15.3–16.9 km/l', price: '₹11.91–16.73L', image: IMAGES.suv, description: 'High-stance midsize SUV offering 220mm ground clearance, class-leading 458L boot, and commanding driver visibility.', interval: 'Every 10,000 km / 12 months' },
  { id: 24, brand: 'Honda', model: 'Civic', type: 'Sedan', fuel: 'Petrol / Hybrid', transmission: 'CVT / e-CVT', seats: 5, engine: '2.0L e:HEV Direct Injection', mileage: '21.0 km/l', price: '₹22.50–28.00L', image: IMAGES.sports, description: 'Aerodynamic sport sedan with low center of gravity, multi-link rear suspension, and thrilling handling dynamics.', interval: 'Every 10,000 km / 12 months' },
  { id: 25, brand: 'Honda', model: 'WR-V', type: 'SUV', fuel: 'Petrol', transmission: 'Manual / CVT', seats: 5, engine: '1.5L i-VTEC High Output', mileage: '16.5 km/l', price: '₹10.50–14.20L', image: IMAGES.suv, description: 'Urban crossover combining spacious cabin ergonomics, roof rails, high approach angles, and durable underbody cladding.', interval: 'Every 10,000 km / 12 months' },

  // Kia
  { id: 26, brand: 'Kia', model: 'Sonet', type: 'SUV', fuel: 'Petrol / Turbo / Diesel', transmission: 'Manual / iMT / 6-AT / 7-DCT', seats: 5, engine: '1.0L Turbo GDi / 1.5L CRDi', mileage: '18.2–22.3 km/l', price: '₹8.00–15.70L', image: IMAGES.suv, description: 'Feature-rich compact SUV equipped with front ventilated seats, LED sound mood lighting, and Level 1 ADAS safety.', interval: 'Every 10,000 km / 12 months' },
  { id: 27, brand: 'Kia', model: 'Seltos', type: 'SUV', fuel: 'Petrol / Turbo / Diesel', transmission: 'Manual / IVT / 6-AT / 7-DCT', seats: 5, engine: '1.5L Turbo GDi (160PS)', mileage: '17.0–20.7 km/l', price: '₹11.19–20.56L', image: IMAGES.suv, description: 'Striking SUV with dual panoramic 10.25-inch displays, Level 2 ADAS with 17 autonomous features, and 8-way powered seat.', interval: 'Every 10,000 km / 12 months' },
  { id: 28, brand: 'Kia', model: 'Carens', type: 'MPV', fuel: 'Petrol / Turbo / Diesel', transmission: 'Manual / iMT / 6-AT / 7-DCT', seats: 7, engine: '1.5L Turbo GDi / 1.5L CRDi', mileage: '15.7–21.3 km/l', price: '₹10.60–19.70L', image: IMAGES.suv, description: 'Versatile 6 or 7 seater with one-touch electric tumble second row seats, roof-mounted AC vents for all rows, and 6 airbags standard.', interval: 'Every 10,000 km / 12 months' },
  { id: 29, brand: 'Kia', model: 'Carnival', type: 'MPV', fuel: 'Diesel', transmission: '8-Speed Automatic', seats: 7, engine: '2.2L Smartstream CRDi (440Nm)', mileage: '14.85 km/l', price: '₹63.90L', image: IMAGES.luxury, description: 'Ultra-luxurious limousine with VIP lounge relaxation seats, dual electric sunroofs, and dual 12.3-inch curved screens.', interval: 'Every 10,000 km / 12 months' },
  { id: 30, brand: 'Kia', model: 'EV6', type: 'EV', fuel: 'Electric', transmission: 'Automatic Single-Speed', seats: 5, engine: 'Dual Motor AWD (325PS, 605Nm)', mileage: '708 km ARAI range', price: '₹65.97L', image: IMAGES.ev, description: 'Award-winning 800V ultra-fast charging electric crossover accelerating 0-100 km/h in 5.2 seconds with vehicle-to-load power.', interval: 'Every 15,000 km / 12 months' }
];

// All 15 official AutoCare service types with clear pricing and duration
const SERVICE_CATALOGUE = [
  { id: 1, name: 'General / Periodic Service', icon: 'wrench', frequency: 'Every 10,000 km / 12 months', price: '₹2,499', rawPrice: 2499, duration: '2–3 hours', description: 'Comprehensive 42-point digital inspection, engine oil check, fluid top-ups, spark plug clean, filter inspection, and tire condition assessment.', includes: ['Engine oil level & quality test', 'Coolant, brake fluid & washer top-up', 'Air filter & AC filter clean', '42-point digital safety diagnosis', 'Underbody & suspension check'] },
  { id: 2, name: 'Engine Oil & Filter Change', icon: 'droplet', frequency: 'Every 8,000–10,000 km', price: '₹1,699', rawPrice: 1699, duration: '45–60 min', description: 'Complete engine flush, OEM-grade synthetic oil replacement, brand-new oil filter installation, and drain-plug washer renewal.', includes: ['Full synthetic engine oil replacement', 'New OEM-grade oil filter', 'Drain plug seal replacement', 'Engine bay dry-cleaning & visual leak check'] },
  { id: 3, name: 'AC Service & Repair', icon: 'snowflake', frequency: 'Every 12 months', price: '₹1,899', rawPrice: 1899, duration: '90–120 min', description: 'Complete climate control overhaul: condenser washing, refrigerant gas pressure top-up, blower clean, and hospital-grade antimicrobial disinfection.', includes: ['AC gas pressure check & refrigerant top-up', 'Condenser coil high-pressure wash', 'Cabin filter cleaning / replacement', 'Anti-bacterial ozone cabin fumigation'] },
  { id: 4, name: 'Brake Inspection & Repair', icon: 'disc', frequency: 'Every 10,000 km', price: '₹1,299', rawPrice: 1299, duration: '60–90 min', description: 'Four-wheel caliper inspection, brake pad thickness measurement, rotor disc inspection, caliper pin greasing, and hydraulic brake fluid bleed.', includes: ['Front & rear brake pad thickness measurement', 'Brake disc rotor runout assessment', 'Caliper slider pin lubrication', 'Emergency handbrake cable adjustment'] },
  { id: 5, name: 'Battery Check & Replacement', icon: 'zap', frequency: 'Every 6 months', price: '₹499', rawPrice: 499, duration: '30 min', description: 'High-rate discharge load test, alternator voltage output calibration, terminal anti-corrosion treatment, and electrolyte specific gravity check.', includes: ['Digital cranking amp load testing', 'Alternator charging rate diagnosis', 'Terminal wire decarbonization & petroleum jelly seal', 'Free doorstep battery replacement quote'] },
  { id: 6, name: 'Wheel Alignment & Balancing', icon: 'crosshair', frequency: 'Every 8,000 km', price: '₹899', rawPrice: 899, duration: '45–60 min', description: 'Precision computer-assisted 3D four-wheel alignment, high-speed computerized dynamic balancing, and zinc weight installation.', includes: ['3D laser caster, camber & toe calibration', 'High-speed wheel vibration balancing', 'Tread wear unevenness diagnostic', 'Steering center position realignment'] },
  { id: 7, name: 'Tyre Rotation & Replacement', icon: 'circle', frequency: 'Every 8,000 km', price: '₹699', rawPrice: 699, duration: '45 min', description: 'Scientific 5-tyre cross rotation, digital tread depth measurement, bead inspection, and nitrogen pressure calibration for longer tyre life.', includes: ['5-wheel cross rotation pattern execution', 'Digital tread depth measurement in mm', 'Rim inspection for bends or cracks', 'Nitrogen tire inflation to exact OEM psi'] },
  { id: 8, name: 'Car Wash & Detailing', icon: 'sparkles', frequency: 'Every 1–3 months', price: '₹1,499', rawPrice: 1499, duration: '2 hours', description: 'Snow foam pH-neutral exterior shampoo, interior vacuuming, dashboard UV conditioning, tyre dressing, and streak-free glass polish.', includes: ['Two-bucket wash with high-pressure snow foam', 'Deep interior upholstery vacuuming', 'Mat shampooing & footwell cleaning', 'Dashboard & door card matte conditioning', 'Crystal-clear windshield ceramic coat'] },
  { id: 9, name: 'Dent & Paint Repair', icon: 'shield', frequency: 'As needed', price: '₹2,999', rawPrice: 2999, duration: '1–2 days', description: 'Computerized paint shade matching, infrared heated paint booth bake, spot dent pulling, and 3-stage rotary gloss polish.', includes: ['Precision computerized paint spectrometer match', 'Heated dust-free paint booth application', '3-year anti-peel paint warranty', '3-stage rubbing and machine polish finish'] },
  { id: 10, name: 'Clutch & Transmission Service', icon: 'git-commit', frequency: 'Every 40,000 km', price: '₹3,499', rawPrice: 3499, duration: '3–4 hours', description: 'Transmission fluid flush, clutch plate wear assessment, release bearing inspection, flywheel check, and smooth-gearshift calibration.', includes: ['Transmission gear oil drain & flush', 'Clutch pedal free play and hydraulic bleed', 'Flywheel and pressure plate inspection', 'Gear linkage lubrication'] },
  { id: 11, name: 'Suspension Service', icon: 'activity', frequency: 'Every 25,000 km', price: '₹2,499', rawPrice: 2499, duration: '2–3 hours', description: 'Shock absorber rebound testing, stabilizer link and ball joint check, strut mount replacement, and control arm bushing inspection.', includes: ['Front & rear strut leak inspection', 'Suspension bushing wear analysis', 'Link rod and ball joint play diagnosis', 'Dynamic road test over bumpy surfaces'] },
  { id: 12, name: 'Electrical Diagnostics', icon: 'cpu', frequency: 'As needed', price: '₹999', rawPrice: 999, duration: '45–60 min', description: 'Full OBD-II onboard ECU scanner diagnostic, sensor voltage testing, error code clearing, wiring loom inspection, and fuse box audit.', includes: ['Universal OBD-II engine and transmission fault scan', 'Real-time live sensor data logging', 'DTC error code reset with explanation report', 'Lighting and relay continuity check'] },
  { id: 13, name: 'Insurance Inspection', icon: 'file-text', frequency: 'At claim time', price: '₹0 (Free with claim)', rawPrice: 0, duration: '1–2 hours', description: 'Cashless claim liaison with all major insurers, comprehensive photographic damage documentation, and itemized surveyor estimate preparation.', includes: ['Detailed high-res damage photography', 'OEM parts price estimate generation', 'Direct liaison with insurance surveyor', 'Cashless garage settlement processing'] },
  { id: 14, name: 'Emergency Roadside Assistance', icon: 'truck', frequency: '24/7 On Demand', price: '₹799', rawPrice: 799, duration: '30–45 min arrival', description: 'Rapid emergency response team for flat tyres, battery jump-starts, emergency fuel delivery, lock-out assistance, or flatbed towing.', includes: ['24/7 dedicated dispatch hotline', 'Hydraulic flatbed towing coordination', 'On-spot jump start with heavy-duty booster', 'Emergency puncture plug and inflation'] },
  { id: 15, name: 'EV Inspection & Maintenance', icon: 'battery-charging', frequency: 'Every 10,000 km / 12 months', price: '₹2,999', rawPrice: 2999, duration: '2 hours', description: 'High-voltage insulation resistance check, battery management system (BMS) cell balancing, coolant loop check, and regenerative brake test.', includes: ['High-voltage wiring safety inspection', 'BMS battery state-of-health (SoH) diagnostics', 'Thermal management coolant loop test', 'Regenerative braking calibration'] }
];

function getInitialData() {
  const hash = bcrypt.hashSync('DemoPass123!', 10);
  const now = new Date();
  
  const users = [
    {
      id: 'usr_admin_1',
      name: 'Anika Kapoor',
      email: 'admin@autocare.example',
      mobile: '+91 98888 10000',
      passwordHash: hash,
      role: 'ADMIN',
      employeeCode: 'AC-ADM-01',
      createdAt: now.toISOString()
    },
    {
      id: 'usr_emp_1',
      name: 'Arjun Mehta',
      email: 'arjun@autocare.example',
      mobile: '+91 98888 10011',
      passwordHash: hash,
      role: 'EMPLOYEE',
      employeeCode: 'AC-EMP-01',
      createdAt: now.toISOString()
    },
    {
      id: 'usr_emp_2',
      name: 'Riya Shah',
      email: 'riya@autocare.example',
      mobile: '+91 98888 10012',
      passwordHash: hash,
      role: 'EMPLOYEE',
      employeeCode: 'AC-EMP-02',
      createdAt: now.toISOString()
    },
    {
      id: 'usr_emp_3',
      name: 'Manav Kapoor',
      email: 'manav@autocare.example',
      mobile: '+91 98888 10013',
      passwordHash: hash,
      role: 'EMPLOYEE',
      employeeCode: 'AC-EMP-03',
      createdAt: now.toISOString()
    },
    {
      id: 'usr_cust_1',
      name: 'Rhea Nair',
      email: 'rhea@example.com',
      mobile: '+91 98888 10001',
      passwordHash: hash,
      role: 'CUSTOMER',
      createdAt: now.toISOString()
    },
    {
      id: 'usr_cust_2',
      name: 'Kabir Rao',
      email: 'kabir@example.com',
      mobile: '+91 98888 10002',
      passwordHash: hash,
      role: 'CUSTOMER',
      createdAt: now.toISOString()
    },
    {
      id: 'usr_cust_3',
      name: 'Kavya Arora',
      email: 'kavya@example.com',
      mobile: '+91 98888 10003',
      passwordHash: hash,
      role: 'CUSTOMER',
      createdAt: now.toISOString()
    }
  ];

  const vehicles = [
    {
      id: 'veh_1',
      customerId: 'usr_cust_1',
      brand: 'Hyundai',
      model: 'Creta',
      year: 2023,
      registration: 'KA 01 MG 7412',
      color: 'Titan Grey',
      fuel: 'Petrol'
    },
    {
      id: 'veh_2',
      customerId: 'usr_cust_1',
      brand: 'Tata Motors',
      model: 'Nexon',
      year: 2022,
      registration: 'KA 05 RS 2008',
      color: 'Daytona Grey',
      fuel: 'Diesel'
    },
    {
      id: 'veh_3',
      customerId: 'usr_cust_2',
      brand: 'Honda',
      model: 'City',
      year: 2024,
      registration: 'KA 03 DN 4370',
      color: 'Platinum White',
      fuel: 'Petrol'
    },
    {
      id: 'veh_4',
      customerId: 'usr_cust_3',
      brand: 'Toyota',
      model: 'Fortuner',
      year: 2023,
      registration: 'KA 04 KL 9901',
      color: 'Super White',
      fuel: 'Diesel'
    }
  ];

  const bookings = [
    {
      id: 'AC-2026-0816',
      customerId: 'usr_cust_1',
      customerName: 'Rhea Nair',
      customerEmail: 'rhea@example.com',
      customerMobile: '+91 98888 10001',
      vehicle: 'Hyundai Creta',
      registration: 'KA 01 MG 7412',
      serviceId: 1,
      serviceName: 'General / Periodic Service',
      appointmentAt: '2026-10-27T10:30:00+05:30',
      slot: '10:30 AM',
      pickupDrop: true,
      paymentPreference: 'Pay at service center',
      status: 'WORK_IN_PROGRESS',
      statusLabel: 'Work In Progress',
      priority: 'High',
      estimatedCompletion: '2026-10-27T17:30:00+05:30',
      employeeId: 'usr_emp_1',
      employeeName: 'Arjun Mehta',
      notes: 'Initial 42-point inspection completed. Engine oil drained and genuine synthetic oil refilled. Front brake pad wear at 40% — replacement recommended and awaiting confirmation.',
      cost: '₹5,480',
      history: [
        { status: 'BOOKING_RECEIVED', label: 'Booking Received', time: '2026-10-26T09:14:00+05:30', note: 'Appointment requested via web portal.' },
        { status: 'APPOINTMENT_CONFIRMED', label: 'Appointment Confirmed', time: '2026-10-26T10:02:00+05:30', note: 'Service bay #3 reserved at AutoCare Koramangala.' },
        { status: 'VEHICLE_RECEIVED', label: 'Vehicle Received', time: '2026-10-26T10:27:00+05:30', note: 'Vehicle received and 360-degree condition photos documented.' },
        { status: 'INSPECTION_STARTED', label: 'Inspection Started', time: '2026-10-26T11:03:00+05:30', note: 'Senior advisor Arjun Mehta initiated 42-point digital diagnostics.' },
        { status: 'WORK_IN_PROGRESS', label: 'Work In Progress', time: '2026-10-26T13:18:00+05:30', note: 'Engine oil flush and OEM filter installation in progress.' }
      ],
      createdAt: '2026-10-26T09:14:00+05:30'
    },
    {
      id: 'AC-2026-0812',
      customerId: 'usr_cust_1',
      customerName: 'Rhea Nair',
      customerEmail: 'rhea@example.com',
      customerMobile: '+91 98888 10001',
      vehicle: 'Tata Nexon',
      registration: 'KA 05 RS 2008',
      serviceId: 3,
      serviceName: 'AC Service & Repair',
      appointmentAt: '2026-10-25T14:00:00+05:30',
      slot: '02:00 PM',
      pickupDrop: false,
      paymentPreference: 'Card / UPI at completion',
      status: 'READY_FOR_DELIVERY',
      statusLabel: 'Ready for Delivery',
      priority: 'Medium',
      estimatedCompletion: '2026-10-26T15:00:00+05:30',
      employeeId: 'usr_emp_2',
      employeeName: 'Riya Shah',
      notes: 'Cabin cooling restored to 6.2°C. New pollen air filter installed. Car washed and ready for customer pickup.',
      cost: '₹3,290',
      history: [
        { status: 'BOOKING_RECEIVED', label: 'Booking Received', time: '2026-10-24T14:00:00+05:30', note: 'Online booking confirmed.' },
        { status: 'VEHICLE_RECEIVED', label: 'Vehicle Received', time: '2026-10-25T14:10:00+05:30', note: 'Vehicle inspected and checked in.' },
        { status: 'WORK_IN_PROGRESS', label: 'Work In Progress', time: '2026-10-25T15:00:00+05:30', note: 'Coolant flush & compressor leak test.' },
        { status: 'QUALITY_CHECK', label: 'Quality Check', time: '2026-10-26T11:00:00+05:30', note: 'Digital thermometer verification passed.' },
        { status: 'READY_FOR_DELIVERY', label: 'Ready for Delivery', time: '2026-10-26T13:45:00+05:30', note: 'Complimentary wash completed.' }
      ],
      createdAt: '2026-10-24T14:00:00+05:30'
    },
    {
      id: 'AC-2026-0805',
      customerId: 'usr_cust_2',
      customerName: 'Kabir Rao',
      customerEmail: 'kabir@example.com',
      customerMobile: '+91 98888 10002',
      vehicle: 'Honda City',
      registration: 'KA 03 DN 4370',
      serviceId: 6,
      serviceName: 'Wheel Alignment & Balancing',
      appointmentAt: '2026-10-22T09:00:00+05:30',
      slot: '09:00 AM',
      pickupDrop: false,
      paymentPreference: 'Card / UPI at completion',
      status: 'COMPLETED',
      statusLabel: 'Completed',
      priority: 'Low',
      estimatedCompletion: '2026-10-22T11:30:00+05:30',
      employeeId: 'usr_emp_1',
      employeeName: 'Arjun Mehta',
      notes: 'Laser alignment report provided to customer. High-speed road test showed zero steering drift.',
      cost: '₹1,099',
      history: [
        { status: 'BOOKING_RECEIVED', label: 'Booking Received', time: '2026-10-21T18:00:00+05:30', note: 'Appointment scheduled.' },
        { status: 'WORK_IN_PROGRESS', label: 'Work In Progress', time: '2026-10-22T09:20:00+05:30', note: '3D alignment and wheel balancing done.' },
        { status: 'COMPLETED', label: 'Completed', time: '2026-10-22T11:15:00+05:30', note: 'Payment processed and invoice generated.' }
      ],
      createdAt: '2026-10-21T18:00:00+05:30'
    },
    {
      id: 'AC-2026-0820',
      customerId: 'usr_cust_3',
      customerName: 'Kavya Arora',
      customerEmail: 'kavya@example.com',
      customerMobile: '+91 98888 10003',
      vehicle: 'Toyota Fortuner',
      registration: 'KA 04 KL 9901',
      serviceId: 4,
      serviceName: 'Brake Inspection & Repair',
      appointmentAt: '2026-10-28T11:00:00+05:30',
      slot: '11:00 AM',
      pickupDrop: true,
      paymentPreference: 'Pay at service center',
      status: 'APPOINTMENT_CONFIRMED',
      statusLabel: 'Appointment Confirmed',
      priority: 'Medium',
      estimatedCompletion: '2026-10-28T16:00:00+05:30',
      employeeId: 'usr_emp_3',
      employeeName: 'Manav Kapoor',
      notes: 'Customer reported slight squeaking during morning stops. Assigned for disc inspection.',
      cost: '₹1,299',
      history: [
        { status: 'BOOKING_RECEIVED', label: 'Booking Received', time: '2026-10-26T14:30:00+05:30', note: 'Online reservation submitted.' },
        { status: 'APPOINTMENT_CONFIRMED', label: 'Appointment Confirmed', time: '2026-10-26T15:10:00+05:30', note: 'Service technician assigned.' }
      ],
      createdAt: '2026-10-26T14:30:00+05:30'
    }
  ];

  const contactMessages = [
    {
      id: 'msg_1',
      name: 'Sunil Verma',
      email: 'sunil.v@example.com',
      topic: 'Service enquiry',
      message: 'Looking for a comprehensive 40,000km service for my 2021 Hyundai Creta Diesel. Do you offer synthetic oil and brake pad replacement packages?',
      status: 'NEW',
      createdAt: '2026-10-26T11:20:00+05:30'
    }
  ];

  const auditLogs = [
    { id: 'log_1', action: 'STATUS_UPDATE', details: 'Arjun Mehta updated AC-2026-0816 to WORK_IN_PROGRESS', time: '2026-10-26T13:18:00+05:30' },
    { id: 'log_2', action: 'DELIVERY_READY', details: 'Riya Shah updated AC-2026-0812 to READY_FOR_DELIVERY', time: '2026-10-26T13:45:00+05:30' },
    { id: 'log_3', action: 'BOOKING_CREATED', details: 'Kavya Arora created booking AC-2026-0820 for Toyota Fortuner', time: '2026-10-26T14:30:00+05:30' },
    { id: 'log_4', action: 'ASSIGNMENT_UPDATE', details: 'Anika Kapoor assigned Manav Kapoor to AC-2026-0820', time: '2026-10-26T15:10:00+05:30' }
  ];

  return {
    users,
    vehicles,
    bookings,
    cars: CAR_CATALOGUE,
    services: SERVICE_CATALOGUE,
    contactMessages,
    auditLogs
  };
}

class Store {
  constructor() {
    this.prisma = null;
    this.isSupabaseConnected = false;
    this.initPrisma();
    this.init();
  }

  initPrisma() {
    if (process.env.DATABASE_URL) {
      try {
        const { PrismaClient } = require('@prisma/client');
        this.prisma = new PrismaClient();
        this.isSupabaseConnected = true;
      } catch (err) {
        console.warn('[Prisma] Initialization skipped:', err.message);
      }
    }
  }

  async syncFromDatabase() {
    if (!this.prisma) return;
    try {
      const dbUsers = await this.prisma.user.findMany({ include: { role: true } });
      if (dbUsers && dbUsers.length > 0) {
        for (const u of dbUsers) {
          const idx = this.data.users.findIndex(x => x.email.toLowerCase() === u.email.toLowerCase());
          const roleName = u.role?.name || 'CUSTOMER';
          const userObj = {
            id: u.id,
            name: u.name,
            email: u.email,
            mobile: u.mobile || '',
            passwordHash: u.passwordHash,
            role: roleName,
            employeeCode: u.employeeCode || undefined,
            createdAt: u.createdAt ? u.createdAt.toISOString() : new Date().toISOString()
          };
          if (idx >= 0) {
            this.data.users[idx] = { ...this.data.users[idx], ...userObj };
          } else {
            this.data.users.push(userObj);
          }
        }
        this.save();
        console.log(`[Supabase] Live sync completed: loaded ${dbUsers.length} users from Supabase.`);
      }
    } catch (e) {
      console.warn('[Supabase Sync] Background sync warning:', e.message);
    }
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialData();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      this.data = initial;
    } else {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        // Ensure all top-level keys exist
        if (!this.data.cars || this.data.cars.length < 30) this.data.cars = CAR_CATALOGUE;
        if (!this.data.services) this.data.services = SERVICE_CATALOGUE;
        if (!this.data.auditLogs) this.data.auditLogs = [];
        if (!this.data.contactMessages) this.data.contactMessages = [];
      } catch (e) {
        console.error('Error reading db.json, re-initializing store:', e);
        const initial = getInitialData();
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
        this.data = initial;
      }
    }
  }

  save() {
    try {
      const tempFile = DB_FILE + '.tmp';
      fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
    } catch (e) {
      console.error('Failed to write db.json:', e);
    }
  }

  // Auth & Users
  findUserByEmail(email) {
    if (!email) return null;
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  findUserById(id) {
    return this.data.users.find(u => u.id === id);
  }

  createUser(userData) {
    this.data.users.push(userData);
    this.save();
    if (this.prisma) {
      const roleId = userData.role === 'ADMIN' ? 'role_admin' : (userData.role === 'EMPLOYEE' ? 'role_employee' : 'role_customer');
      this.prisma.user.upsert({
        where: { email: userData.email.toLowerCase() },
        update: {
          name: userData.name,
          mobile: userData.mobile || null,
          passwordHash: userData.passwordHash,
          roleId
        },
        create: {
          id: userData.id,
          name: userData.name,
          email: userData.email.toLowerCase(),
          mobile: userData.mobile || null,
          passwordHash: userData.passwordHash,
          roleId,
          employeeCode: userData.employeeCode || null,
          emailVerifiedAt: new Date()
        }
      }).catch(e => console.error('[Supabase Sync] User save error:', e.message));
    }
    return userData;
  }

  getEmployees() {
    return this.data.users.filter(u => u.role === 'EMPLOYEE');
  }

  // Vehicles
  getVehiclesByCustomer(customerId) {
    return this.data.vehicles.filter(v => v.customerId === customerId);
  }

  addVehicle(vehicle) {
    this.data.vehicles.push(vehicle);
    this.save();
    return vehicle;
  }

  // Catalogue
  getCars(query = {}) {
    let result = this.data.cars || CAR_CATALOGUE;
    if (query.brand) {
      result = result.filter(c => c.brand.toLowerCase() === query.brand.toLowerCase());
    }
    if (query.type) {
      result = result.filter(c => c.type.toLowerCase() === query.type.toLowerCase());
    }
    if (query.q) {
      const q = query.q.toLowerCase();
      result = result.filter(c => 
        c.brand.toLowerCase().includes(q) ||
        c.model.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q)
      );
    }
    return result;
  }

  getCarById(id) {
    return (this.data.cars || CAR_CATALOGUE).find(c => c.id === Number(id));
  }

  getServices() {
    return this.data.services || SERVICE_CATALOGUE;
  }

  getServiceById(id) {
    return (this.data.services || SERVICE_CATALOGUE).find(s => s.id === Number(id));
  }

  // Bookings
  getBookings(user) {
    if (!user) return [];
    if (user.role === 'ADMIN') {
      return this.data.bookings;
    }
    if (user.role === 'EMPLOYEE') {
      // Employee sees jobs assigned to them, plus unassigned or all for visibility
      return this.data.bookings;
    }
    return this.data.bookings.filter(b => b.customerId === user.id || b.customerEmail.toLowerCase() === user.email.toLowerCase());
  }

  findBookingById(publicId) {
    if (!publicId) return null;
    const clean = publicId.trim().toUpperCase();
    return this.data.bookings.find(b => b.id.toUpperCase() === clean);
  }

  createBooking(booking) {
    this.data.bookings.unshift(booking);
    this.logAudit('BOOKING_CREATED', `New booking ${booking.id} created for ${booking.vehicle} (${booking.customerName})`);
    this.save();
    if (this.prisma) {
      const validStatuses = [
        'BOOKING_RECEIVED', 'APPOINTMENT_CONFIRMED', 'VEHICLE_RECEIVED',
        'INSPECTION_STARTED', 'ESTIMATE_AWAITING_APPROVAL', 'WORK_IN_PROGRESS',
        'WAITING_FOR_SPARE_PARTS', 'QUALITY_CHECK', 'READY_FOR_DELIVERY',
        'COMPLETED', 'CANCELLED'
      ];
      const status = validStatuses.includes(booking.status) ? booking.status : 'BOOKING_RECEIVED';
      this.prisma.serviceBooking.upsert({
        where: { publicId: booking.id },
        update: {
          status,
          customerNotes: booking.notes || null,
          pickupDrop: Boolean(booking.pickupDrop)
        },
        create: {
          id: 'bk_' + Date.now(),
          publicId: booking.id,
          appointmentAt: new Date(booking.date || Date.now()),
          pickupDrop: Boolean(booking.pickupDrop),
          customerNotes: booking.notes || null,
          status,
          priority: booking.priority || 'NORMAL',
          customerId: booking.customerId || (this.data.users[0]?.id || 'usr_cust_1'),
          vehicleId: booking.vehicleId || (this.data.vehicles[0]?.id || 'veh_1'),
          serviceTypeId: booking.serviceTypeId || (this.data.services[0]?.id ? String(this.data.services[0].id) : '1')
        }
      }).catch(e => console.error('[Supabase Sync] Booking create error:', e.message));
    }
    return booking;
  }

  updateBookingStatus(publicId, newStatus, newLabel, note, eta) {
    const b = this.findBookingById(publicId);
    if (!b) return null;
    b.status = newStatus;
    b.statusLabel = newLabel || newStatus;
    if (note) b.notes = note;
    if (eta) b.estimatedCompletion = eta;
    
    b.history = b.history || [];
    b.history.push({
      status: newStatus,
      label: newLabel || newStatus,
      time: new Date().toISOString(),
      note: note || `Status updated to ${newLabel || newStatus}`
    });

    this.logAudit('STATUS_UPDATE', `Booking ${publicId} changed to ${newLabel || newStatus}`);
    this.save();

    if (this.prisma) {
      const validStatuses = [
        'BOOKING_RECEIVED', 'APPOINTMENT_CONFIRMED', 'VEHICLE_RECEIVED',
        'INSPECTION_STARTED', 'ESTIMATE_AWAITING_APPROVAL', 'WORK_IN_PROGRESS',
        'WAITING_FOR_SPARE_PARTS', 'QUALITY_CHECK', 'READY_FOR_DELIVERY',
        'COMPLETED', 'CANCELLED'
      ];
      const status = validStatuses.includes(newStatus) ? newStatus : 'WORK_IN_PROGRESS';
      this.prisma.serviceBooking.updateMany({
        where: { publicId: publicId.trim().toUpperCase() },
        data: { status }
      }).catch(e => console.error('[Supabase Sync] Status update error:', e.message));
    }
    return b;
  }

  assignEmployee(publicId, employeeId) {
    const b = this.findBookingById(publicId);
    if (!b) return null;
    const emp = this.findUserById(employeeId);
    if (!emp) return null;
    b.employeeId = emp.id;
    b.employeeName = emp.name;
    this.logAudit('ASSIGNMENT_UPDATE', `Assigned ${emp.name} to booking ${publicId}`);
    this.save();
    return b;
  }

  // Contact messages
  createContactMessage(msg) {
    this.data.contactMessages = this.data.contactMessages || [];
    this.data.contactMessages.unshift(msg);
    this.logAudit('CONTACT_MESSAGE', `New inquiry from ${msg.name} regarding ${msg.topic}`);
    this.save();
    return msg;
  }

  // Audit Logs
  logAudit(action, details) {
    this.data.auditLogs = this.data.auditLogs || [];
    this.data.auditLogs.unshift({
      id: 'log_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      action,
      details,
      time: new Date().toISOString()
    });
    // Keep last 100 logs
    if (this.data.auditLogs.length > 100) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 100);
    }
    if (this.prisma) {
      this.prisma.auditLog.create({
        data: {
          action: String(action),
          entity: 'System',
          metadata: { details, time: new Date().toISOString() }
        }
      }).catch(e => console.error('[Supabase Sync] AuditLog error:', e.message));
    }
  }

  getAuditLogs() {
    return this.data.auditLogs || [];
  }

  // Analytics
  getAdminMetrics() {
    const totalCustomers = this.data.users.filter(u => u.role === 'CUSTOMER').length;
    const activeBookings = this.data.bookings.filter(b => b.status !== 'COMPLETED' && b.status !== 'CANCELLED').length;
    const completedServices = this.data.bookings.filter(b => b.status === 'COMPLETED').length;
    const totalRevenue = this.data.bookings.reduce((sum, b) => {
      const match = (b.cost || '').match(/\d+[\d,]*/);
      if (match) {
        return sum + Number(match[0].replace(/,/g, ''));
      }
      return sum;
    }, 0);

    const statusCounts = {};
    for (const b of this.data.bookings) {
      const key = b.statusLabel || b.status;
      statusCounts[key] = (statusCounts[key] || 0) + 1;
    }

    return {
      totalCustomers: totalCustomers + 1280, // Adding realistic base + live count
      activeBookings,
      completedServices: completedServices + 375,
      totalRevenue: `₹${((totalRevenue + 840000) / 100000).toFixed(1)}L`,
      statusCounts,
      recentBookings: this.data.bookings.slice(0, 5),
      employees: this.getEmployees()
    };
  }
}

module.exports = new Store();
module.exports.IMAGES = IMAGES;
module.exports.CAR_CATALOGUE = CAR_CATALOGUE;
module.exports.SERVICE_CATALOGUE = SERVICE_CATALOGUE;
