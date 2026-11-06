const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // Only the verified phone identifies a user. Email is unverified, so anyone could have typed it.
  const phone = '+919116015261';
  const u = await prisma.user.findUnique({ where: { phone } });
  if (u) {
    await prisma.userRoleAccess.upsert({
      where: { userId_role: { userId: u.id, role: 'ADMIN' } },
      update: { status: 'ACTIVE' },
      create: { userId: u.id, role: 'ADMIN' }
    });
    console.log('Added ADMIN role to', phone);
  } else {
    console.log('User not found');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
