import prisma from './src/config/db';
import { Role } from '@prisma/client';

async function main() {
  const email = "harshindoria911@gmail.com";
  const phone = "+919116015261";

  // Only the verified phone identifies a user. Email is unverified, so anyone could have typed this one.
  const user = await prisma.user.findUnique({ where: { phone } });

  if (user) {
    console.log("User found! Updating roles to include ADMIN...");
    await prisma.userRoleAccess.upsert({
      where: { userId_role: { userId: user.id, role: Role.ADMIN } },
      update: { status: 'ACTIVE' },
      create: { userId: user.id, role: Role.ADMIN },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: {
        activeRole: Role.ADMIN,
        name: "Harsh Indoria"
      }
    });
    console.log("✅ Admin role granted successfully to existing user.");
  } else {
    console.log("User not found. Creating a new Admin user record...");
    // Create a pseudo firebaseUid for now until they login with Firebase
    await prisma.user.create({
      data: {
        firebaseUid: `admin_seed_${Date.now()}`,
        name: "Harsh Indoria",
        email,
        phone,
        activeRole: Role.ADMIN,
        roleAccess: { create: [{ role: Role.BUYER }, { role: Role.ADMIN }] }
      }
    });
    console.log("✅ New Admin user created successfully.");
  }
}

main()
  .catch((e) => {
    console.error("Error seeding admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
