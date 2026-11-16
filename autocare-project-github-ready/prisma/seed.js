require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const companies = {
  Toyota: ['Glanza','Urban Cruiser Hyryder','Innova Crysta','Fortuner','Camry'],
  Hyundai: ['Grand i10 Nios','i20','Verna','Creta','Alcazar'],
  'Maruti Suzuki': ['Swift','Dzire','Baleno','Grand Vitara','Jimny'],
  'Tata Motors': ['Tiago','Punch','Nexon','Harrier','Safari'],
  Honda: ['Amaze','City','Elevate','Civic','WR-V'],
  Kia: ['Sonet','Seltos','Carens','Carnival','EV6']
};
const serviceNames = ['General / Periodic Service','Engine Oil & Filter Change','AC Service & Repair','Brake Inspection & Repair','Battery Check & Replacement','Wheel Alignment & Balancing','Tyre Rotation & Replacement','Car Wash & Detailing','Dent & Paint Repair','Clutch & Transmission Service','Suspension Service','Electrical Diagnostics','Insurance Inspection','Emergency Roadside Assistance','EV Inspection & Maintenance'];
async function main() {
  for (const name of ['CUSTOMER','EMPLOYEE','ADMIN']) await prisma.role.upsert({where:{name},update:{},create:{name}});
  const adminRole=await prisma.role.findUnique({where:{name:'ADMIN'}}), employeeRole=await prisma.role.findUnique({where:{name:'EMPLOYEE'}}), customerRole=await prisma.role.findUnique({where:{name:'CUSTOMER'}});
  const hash=await bcrypt.hash('DemoPass123!',12);
  await prisma.user.upsert({where:{email:'admin@autocare.example'},update:{},create:{name:'Anika Kapoor',email:'admin@autocare.example',passwordHash:hash,emailVerifiedAt:new Date(),roleId:adminRole.id}});
  for (const [name,email,code] of [['Arjun Mehta','arjun@autocare.example','AC-EMP-01'],['Riya Shah','riya@autocare.example','AC-EMP-02'],['Manav Kapoor','manav@autocare.example','AC-EMP-03']]) await prisma.user.upsert({where:{email},update:{},create:{name,email,employeeCode:code,passwordHash:hash,emailVerifiedAt:new Date(),roleId:employeeRole.id}});
  for (const [name,email,mobile] of [['Rhea Nair','rhea@example.com','+91 98888 10001'],['Kabir Rao','kabir@example.com','+91 98888 10002'],['Kavya Arora','kavya@example.com','+91 98888 10003']]) await prisma.user.upsert({where:{email},update:{},create:{name,email,mobile,passwordHash:hash,emailVerifiedAt:new Date(),roleId:customerRole.id}});
  for (const [companyName,models] of Object.entries(companies)) { const company=await prisma.carCompany.upsert({where:{name:companyName},update:{},create:{name:companyName}}); for (const name of models) await prisma.carModel.upsert({where:{companyId_name:{companyId:company.id,name}},update:{},create:{name,type:name==='Camry'||name==='City'||name==='Verna'?'Sedan':'SUV',fuelType:name==='EV6'?'Electric':'Petrol / Diesel',transmission:'Manual / Automatic',seatingCapacity:5,engine:name==='EV6'?'84 kWh electric motor':'1.5L',mileageOrRange:'Sample/placeholder data',priceRange:'Market price field',description:`Service-ready ${name} catalogue record.`,serviceInterval:'Every 10,000 km or 12 months',imageUrl:'https://images.unsplash.com/photo-1503376780353-7e6692767b70'}}); } }
  for (const name of serviceNames) await prisma.serviceType.upsert({where:{name},update:{},create:{name,description:`${name} performed by an AutoCare certified technician.`,estimatedDurationMin:120,startingPrice:1499,included:'Digital inspection, work record and customer updates',frequency:'As recommended'}});
  console.log('Seeded roles, 6 manufacturers, 30 car models, 15 service types, and demo users.');
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
