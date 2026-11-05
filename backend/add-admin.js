const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  // Only the verified phone identifies a user. Email is unverified, so anyone could have typed it.
  const phone = '+919116015261';
  const u = await prisma.user.findUnique({ where: { phone } });
  if (u) {
    if (!u.roles.includes('ADMIN')) {
      await prisma.user.update({
        where: { phone },
        data: { roles: [...u.roles, 'ADMIN'] }
      });
      console.log('Added ADMIN role to', phone);
    } else {
      console.log('User already has ADMIN role');
    }
  } else {
    console.log('User not found');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
