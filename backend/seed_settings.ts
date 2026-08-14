import prisma from './src/config/db';
async function main() {
  const existing = await prisma.platformSettings.findFirst();
  if (!existing) {
    await prisma.platformSettings.create({
      data: {
        cropMarkupRate: 0.20,
        deliveryMarkupRate: 0.20
      }
    });
    console.log("Seeded PlatformSettings");
  } else {
    console.log("PlatformSettings already exists");
  }
}
main();
