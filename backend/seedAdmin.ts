import prisma from './src/config/db';
import { Role } from '@prisma/client';

async function main() {
  const email = "harshindoria911@gmail.com";
  const phone = "+919116015261"; // Firebase formatting usually includes +91
  const phoneAlt = "9116015261";
  
  // Try to find if user already exists
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { phone },
        { phone: phoneAlt }
      ]
    }
  });

  if (user) {
    console.log("User found! Updating roles to include ADMIN...");
    const roles = Array.from(new Set([...user.roles, Role.ADMIN]));
    await prisma.user.update({
      where: { id: user.id },
      data: {
        roles,
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
        roles: [Role.BUYER, Role.ADMIN],
        activeRole: Role.ADMIN
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
