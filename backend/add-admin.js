const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const email = 'harshindoria911@gmail.com';
  const u = await prisma.user.findUnique({ where: { email } });
  if (u) {
    if (!u.roles.includes('ADMIN')) {
      await prisma.user.update({
        where: { email },
        data: { roles: [...u.roles, 'ADMIN'] }
      });
      console.log('Added ADMIN role to', email);
    } else {
      console.log('User already has ADMIN role');
    }
  } else {
    console.log('User not found');
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
