/**
 * AutoCare Service Hub - Production-grade HTTP & API Server
 * Built with native Node.js HTTP + Zod validation + JWT auth + bcrypt.
 * Works seamlessly out-of-the-box with persistent file-backed JSON store,
 * and maintains compatibility with PostgreSQL / Prisma when configured.
 */
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { z } = require('zod');

const store = require('./data/storage');

const root = __dirname;
const port = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'autocare-service-hub-production-secure-key-2026';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

// Response helper
function sendJson(res, statusCode, data, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...headers
  });
  res.end(JSON.stringify(data));
}

// Request body parser
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) { // 1MB limit
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// Auth token extractor & verifier
function authenticate(req) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.headers.cookie) {
    const cookies = Object.fromEntries(
      req.headers.cookie.split(';').map(c => {
        const [k, ...v] = c.trim().split('=');
        return [k, decodeURIComponent(v.join('='))];
      })
    );
    token = cookies.autocare_token;
  }

  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = store.findUserById(decoded.id);
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mobile: user.mobile,
      employeeCode: user.employeeCode
    };
  } catch (err) {
    return null;
  }
}

// Zod Schemas for input validation
const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  mobile: z.string().optional()
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

const BookingSchema = z.object({
  vehicle: z.string().min(2, 'Vehicle name is required'),
  registration: z.string().min(4, 'Registration number is required'),
  serviceId: z.coerce.number().int().min(1),
  appointmentAt: z.string().min(1, 'Appointment date is required'),
  slot: z.string().optional().default('09:00–11:00 AM'),
  pickupDrop: z.boolean().optional().default(false),
  paymentPreference: z.string().optional().default('Pay at service center'),
  notes: z.string().optional().default('')
});

const StatusUpdateSchema = z.object({
  status: z.string().min(1, 'Status is required'),
  statusLabel: z.string().optional(),
  notes: z.string().optional(),
  eta: z.string().optional()
});

const ContactSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  topic: z.string().min(1, 'Topic is required'),
  message: z.string().min(10, 'Message must be at least 10 characters')
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const pathname = url.pathname;
  const method = req.method.toUpperCase();

  // CORS headers for flexibility
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // ----------------------------------------------------
  // API ROUTING
  // ----------------------------------------------------
  if (pathname.startsWith('/api/')) {
    try {
      // 1. Health check
      if (pathname === '/api/health' && method === 'GET') {
        return sendJson(res, 200, {
          ok: true,
          service: 'AutoCare Service Hub',
          status: 'online',
          version: '1.0.0',
          database: store.isSupabaseConnected ? 'Supabase PostgreSQL (Live)' : 'Persistent JSON Store (Prisma-compatible)',
          time: new Date().toISOString()
        });
      }

      // 2. Auth: Register
      if (pathname === '/api/auth/register' && method === 'POST') {
        const body = await parseBody(req);
        const parse = RegisterSchema.safeParse(body);
        if (!parse.success) {
          return sendJson(res, 400, { error: 'Validation failed', details: parse.error.flatten().fieldErrors });
        }
        const { name, email, password, mobile } = parse.data;
        const existing = store.findUserByEmail(email);
        if (existing) {
          return sendJson(res, 409, { error: 'An account with this email already exists.' });
        }

        const passwordHash = bcrypt.hashSync(password, 10);
        const newUser = {
          id: 'usr_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
          name,
          email: email.toLowerCase(),
          mobile: mobile || '',
          passwordHash,
          role: 'CUSTOMER',
          createdAt: new Date().toISOString()
        };

        store.createUser(newUser);
        store.logAudit('USER_REGISTERED', `New customer registered: ${newUser.name} (${newUser.email})`);

        const token = jwt.sign(
          { id: newUser.id, email: newUser.email, role: newUser.role, name: newUser.name },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        return sendJson(res, 201, {
          ok: true,
          message: 'Account created successfully.',
          token,
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            mobile: newUser.mobile,
            role: newUser.role
          }
        });
      }

      // 3. Auth: Login
      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await parseBody(req);
        const parse = LoginSchema.safeParse(body);
        if (!parse.success) {
          return sendJson(res, 400, { error: 'Validation failed', details: parse.error.flatten().fieldErrors });
        }
        const { email, password } = parse.data;
        const user = store.findUserByEmail(email);
        if (!user) {
          return sendJson(res, 401, { error: 'Invalid email or password.' });
        }

        const match = bcrypt.compareSync(password, user.passwordHash);
        if (!match) {
          return sendJson(res, 401, { error: 'Invalid email or password.' });
        }

        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role, name: user.name },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        store.logAudit('USER_LOGIN', `User signed in: ${user.name} [${user.role}]`);

        return sendJson(res, 200, {
          ok: true,
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            role: user.role,
            employeeCode: user.employeeCode
          }
        });
      }

      // 4. Auth: Current User Profile (me)
      if (pathname === '/api/auth/me' && method === 'GET') {
        const user = authenticate(req);
        if (!user) {
          return sendJson(res, 401, { error: 'Unauthorized. Please sign in.' });
        }
        const vehicles = store.getVehiclesByCustomer(user.id);
        return sendJson(res, 200, {
          ok: true,
          user,
          vehicles
        });
      }

      // 5. Auth: Logout
      if (pathname === '/api/auth/logout' && method === 'POST') {
        return sendJson(res, 200, { ok: true, message: 'Signed out successfully.' });
      }

      // 6. Cars Catalogue
      if (pathname === '/api/cars' && method === 'GET') {
        const brand = url.searchParams.get('brand') || '';
        const type = url.searchParams.get('type') || '';
        const q = url.searchParams.get('q') || '';
        const cars = store.getCars({ brand, type, q });
        return sendJson(res, 200, { data: cars, total: cars.length });
      }

      if (pathname.startsWith('/api/cars/') && method === 'GET') {
        const id = pathname.replace('/api/cars/', '');
        const car = store.getCarById(id);
        if (!car) return sendJson(res, 404, { error: 'Car model not found' });
        return sendJson(res, 200, { data: car });
      }

      // 7. Services Catalogue
      if (pathname === '/api/services' && method === 'GET') {
        const services = store.getServices();
        return sendJson(res, 200, { data: services, total: services.length });
      }

      if (pathname.startsWith('/api/services/') && method === 'GET') {
        const id = pathname.replace('/api/services/', '');
        const service = store.getServiceById(id);
        if (!service) return sendJson(res, 404, { error: 'Service not found' });
        return sendJson(res, 200, { data: service });
      }

      // 8. Vehicle Tracking (Public with identifier verification)
      if (pathname.startsWith('/api/track/') && method === 'GET') {
        const bookingId = pathname.replace('/api/track/', '').trim().toUpperCase();
        const identifier = (url.searchParams.get('identifier') || url.searchParams.get('email') || url.searchParams.get('reg') || '').trim().toLowerCase();

        const booking = store.findBookingById(bookingId);
        if (!booking) {
          return sendJson(res, 404, { error: 'No booking record found for ID: ' + bookingId });
        }

        // Privacy check: If user is authenticated as staff or owner, allow.
        // Otherwise require matching email OR registration number!
        const user = authenticate(req);
        const isStaff = user && (user.role === 'ADMIN' || user.role === 'EMPLOYEE');
        const isOwner = user && (user.id === booking.customerId || user.email.toLowerCase() === booking.customerEmail.toLowerCase());

        if (!isStaff && !isOwner) {
          if (!identifier) {
            return sendJson(res, 400, {
              error: 'Please provide your registered email or vehicle registration number to verify tracking access.'
            });
          }
          const emailMatch = booking.customerEmail.toLowerCase() === identifier;
          const regMatch = booking.registration.toLowerCase().replace(/\s+/g, '') === identifier.replace(/\s+/g, '');

          if (!emailMatch && !regMatch) {
            return sendJson(res, 403, {
              error: 'Verification mismatch. The email or registration provided does not match this booking record.'
            });
          }
        }

        // Return sanitized tracking payload
        return sendJson(res, 200, {
          ok: true,
          data: {
            id: booking.id,
            vehicle: booking.vehicle,
            registration: booking.registration,
            service: booking.serviceName,
            status: booking.status,
            statusLabel: booking.statusLabel,
            appointmentAt: booking.appointmentAt,
            slot: booking.slot,
            estimatedCompletion: booking.estimatedCompletion,
            employee: booking.employeeName,
            notes: booking.notes,
            cost: booking.cost,
            history: booking.history || []
          }
        });
      }

      // 9. Bookings: List (Role Protected)
      if (pathname === '/api/bookings' && method === 'GET') {
        const user = authenticate(req);
        if (!user) {
          return sendJson(res, 401, { error: 'Unauthorized. Please sign in to view bookings.' });
        }
        const bookings = store.getBookings(user);
        return sendJson(res, 200, { ok: true, data: bookings, count: bookings.length });
      }

      // 10. Bookings: Create (Customer or Authenticated)
      if (pathname === '/api/bookings' && method === 'POST') {
        const user = authenticate(req);
        const body = await parseBody(req);
        const parse = BookingSchema.safeParse(body);
        if (!parse.success) {
          return sendJson(res, 400, { error: 'Validation failed', details: parse.error.flatten().fieldErrors });
        }

        const data = parse.data;
        const service = store.getServiceById(data.serviceId) || store.getServices()[0];

        // Generate unique booking ID e.g. AC-2026-9182
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        const publicId = `AC-2026-${randomDigits}`;

        const customerId = user ? user.id : 'guest_' + Date.now();
        const customerName = user ? user.name : (body.customerName || 'Valued Customer');
        const customerEmail = user ? user.email : (body.customerEmail || 'customer@example.com');
        const customerMobile = user ? user.mobile : (body.customerMobile || '');

        const newBooking = {
          id: publicId,
          customerId,
          customerName,
          customerEmail,
          customerMobile,
          vehicle: data.vehicle,
          registration: data.registration.toUpperCase(),
          serviceId: service.id,
          serviceName: service.name,
          appointmentAt: data.appointmentAt,
          slot: data.slot || '09:00–11:00 AM',
          pickupDrop: Boolean(data.pickupDrop),
          paymentPreference: data.paymentPreference,
          status: 'BOOKING_RECEIVED',
          statusLabel: 'Booking Received',
          priority: 'Normal',
          estimatedCompletion: data.appointmentAt,
          employeeId: 'usr_emp_1',
          employeeName: 'Arjun Mehta',
          notes: data.notes || 'Service appointment booked via web portal.',
          cost: service.price,
          history: [
            {
              status: 'BOOKING_RECEIVED',
              label: 'Booking Received',
              time: new Date().toISOString(),
              note: 'Appointment request received and queued for service bay allocation.'
            }
          ],
          createdAt: new Date().toISOString()
        };

        store.createBooking(newBooking);

        return sendJson(res, 201, {
          ok: true,
          message: 'Appointment successfully created!',
          booking: newBooking
        });
      }

      // 11. Bookings: Update Status (EMPLOYEE or ADMIN)
      if (pathname.startsWith('/api/bookings/') && pathname.endsWith('/status') && method === 'PATCH') {
        const user = authenticate(req);
        if (!user || (user.role !== 'EMPLOYEE' && user.role !== 'ADMIN')) {
          return sendJson(res, 403, { error: 'Forbidden. Only service technicians and administrators can update booking status.' });
        }

        const bookingId = pathname.split('/')[3];
        const body = await parseBody(req);
        const parse = StatusUpdateSchema.safeParse(body);
        if (!parse.success) {
          return sendJson(res, 400, { error: 'Validation failed', details: parse.error.flatten().fieldErrors });
        }

        const { status, statusLabel, notes, eta } = parse.data;
        const updated = store.updateBookingStatus(bookingId, status, statusLabel, notes, eta);
        if (!updated) {
          return sendJson(res, 404, { error: 'Booking not found: ' + bookingId });
        }

        return sendJson(res, 200, {
          ok: true,
          message: `Booking ${bookingId} status updated to ${statusLabel || status}.`,
          data: updated
        });
      }

      // 12. Bookings: Assign Employee (ADMIN only)
      if (pathname.startsWith('/api/bookings/') && pathname.endsWith('/assign') && method === 'PATCH') {
        const user = authenticate(req);
        if (!user || user.role !== 'ADMIN') {
          return sendJson(res, 403, { error: 'Forbidden. Only administrators can assign personnel.' });
        }

        const bookingId = pathname.split('/')[3];
        const body = await parseBody(req);
        if (!body.employeeId) {
          return sendJson(res, 400, { error: 'employeeId is required' });
        }

        const updated = store.assignEmployee(bookingId, body.employeeId);
        if (!updated) {
          return sendJson(res, 404, { error: 'Booking or employee not found' });
        }

        return sendJson(res, 200, {
          ok: true,
          message: `Technician assigned to booking ${bookingId}.`,
          data: updated
        });
      }

      // 13. Customer Vehicles
      if (pathname === '/api/vehicles' && method === 'GET') {
        const user = authenticate(req);
        if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });
        const vehicles = store.getVehiclesByCustomer(user.id);
        return sendJson(res, 200, { ok: true, data: vehicles });
      }

      if (pathname === '/api/vehicles' && method === 'POST') {
        const user = authenticate(req);
        if (!user) return sendJson(res, 401, { error: 'Unauthorized.' });
        const body = await parseBody(req);
        if (!body.brand || !body.model || !body.registration) {
          return sendJson(res, 400, { error: 'Brand, model, and registration are required.' });
        }
        const newVehicle = {
          id: 'veh_' + Date.now(),
          customerId: user.id,
          brand: body.brand,
          model: body.model,
          year: Number(body.year) || new Date().getFullYear(),
          registration: body.registration.toUpperCase(),
          color: body.color || 'Standard',
          fuel: body.fuel || 'Petrol'
        };
        store.addVehicle(newVehicle);
        store.logAudit('VEHICLE_ADDED', `${user.name} registered vehicle ${newVehicle.brand} ${newVehicle.model} [${newVehicle.registration}]`);
        return sendJson(res, 201, { ok: true, data: newVehicle });
      }

      // 14. Contact Form Inquiries
      if (pathname === '/api/contact' && method === 'POST') {
        const body = await parseBody(req);
        const parse = ContactSchema.safeParse(body);
        if (!parse.success) {
          return sendJson(res, 400, { error: 'Validation failed', details: parse.error.flatten().fieldErrors });
        }

        const msg = {
          id: 'msg_' + Date.now(),
          ...parse.data,
          status: 'NEW',
          createdAt: new Date().toISOString()
        };

        store.createContactMessage(msg);

        return sendJson(res, 201, {
          ok: true,
          message: 'Thank you! Your message has been received by the AutoCare service team. We will contact you within 1 business day.'
        });
      }

      // 15. Admin: Metrics, Logs & Staff
      if (pathname === '/api/admin/metrics' && method === 'GET') {
        const user = authenticate(req);
        if (!user || user.role !== 'ADMIN') {
          return sendJson(res, 403, { error: 'Forbidden. Admin access required.' });
        }
        return sendJson(res, 200, { ok: true, data: store.getAdminMetrics() });
      }

      if (pathname === '/api/admin/logs' && method === 'GET') {
        const user = authenticate(req);
        if (!user || user.role !== 'ADMIN') {
          return sendJson(res, 403, { error: 'Forbidden. Admin access required.' });
        }
        return sendJson(res, 200, { ok: true, data: store.getAuditLogs() });
      }

      if (pathname === '/api/admin/employees' && method === 'GET') {
        const user = authenticate(req);
        if (!user || user.role !== 'ADMIN') {
          return sendJson(res, 403, { error: 'Forbidden. Admin access required.' });
        }
        return sendJson(res, 200, { ok: true, data: store.getEmployees() });
      }

      // Unmatched API endpoint
      return sendJson(res, 404, { error: `Endpoint ${method} ${pathname} not found.` });

    } catch (err) {
      console.error('API Error:', err);
      return sendJson(res, 500, { error: 'Internal server error', message: err.message });
    }
  }

  // ----------------------------------------------------
  // STATIC FILE SERVING
  // ----------------------------------------------------
  const requested = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(path.join(root, requested));

  if (!safePath.startsWith(root)) {
    return sendJson(res, 403, { error: 'Forbidden' });
  }

  fs.readFile(safePath, (err, data) => {
    if (err) {
      // Single Page Application fallback: if HTML requested, return index.html
      if (req.headers.accept && req.headers.accept.includes('text/html')) {
        const indexPath = path.join(root, 'index.html');
        return fs.readFile(indexPath, (indexErr, indexData) => {
          if (indexErr) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('Not found');
          }
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'no-cache'
          });
          res.end(indexData);
        });
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }

    const ext = path.extname(safePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
      'X-Request-Id': crypto.randomUUID()
    });
    res.end(data);
  });
});

server.listen(port, async () => {
  console.log(`AutoCare Service Hub running at http://localhost:${port}`);
  if (store.syncFromDatabase) {
    await store.syncFromDatabase();
  }
});

module.exports = server;
