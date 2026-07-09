import prisma from '../src/config/db';

const CATALOG_ITEMS = [
  // ── VEGETABLES ──
  { englishName: "Potato", hindiName: "Aloo (आलू)", category: "VEGETABLES" },
  { englishName: "Tomato", hindiName: "Tamatar (टमाटर)", category: "VEGETABLES" },
  { englishName: "Onion", hindiName: "Pyaaz (प्याज)", category: "VEGETABLES" },
  { englishName: "Cauliflower", hindiName: "Gobhi (गोभी)", category: "VEGETABLES" },
  { englishName: "Green Peas", hindiName: "Matar (मटर)", category: "VEGETABLES" },
  { englishName: "Brinjal", hindiName: "Baingan (बैंगन)", category: "VEGETABLES" },
  { englishName: "Okra", hindiName: "Bhindi (भिंडी)", category: "VEGETABLES" },
  { englishName: "Spinach", hindiName: "Palak (पालक)", category: "VEGETABLES" },
  { englishName: "Bottle Gourd", hindiName: "Lauki (लौकी)", category: "VEGETABLES" },
  { englishName: "Bitter Gourd", hindiName: "Karela (करेला)", category: "VEGETABLES" },
  { englishName: "Cabbage", hindiName: "Patta Gobhi (पत्ता गोभी)", category: "VEGETABLES" },
  { englishName: "Carrot", hindiName: "Gajar (गाजर)", category: "VEGETABLES" },
  { englishName: "Radish", hindiName: "Mooli (मूली)", category: "VEGETABLES" },
  { englishName: "Garlic", hindiName: "Lahsun (लहसुन)", category: "VEGETABLES" },
  { englishName: "Ginger", hindiName: "Adrak (अदरक)", category: "VEGETABLES" },
  { englishName: "Pumpkin", hindiName: "Kaddu (कद्दू)", category: "VEGETABLES" },
  { englishName: "Capsicum", hindiName: "Shimla Mirch (शिमला मिर्च)", category: "VEGETABLES" },
  { englishName: "Pointed Gourd", hindiName: "Parwal (परवल)", category: "VEGETABLES" },
  { englishName: "Ridge Gourd", hindiName: "Turai (तुरई)", category: "VEGETABLES" },
  { englishName: "Ivy Gourd", hindiName: "Kundru (कुंदरू)", category: "VEGETABLES" },
  { englishName: "Beetroot", hindiName: "Chukandar (चुकंदर)", category: "VEGETABLES" },
  { englishName: "Sweet Potato", hindiName: "Shakarkand (शकरकंद)", category: "VEGETABLES" },
  { englishName: "Broccoli", hindiName: "Hari Gobhi (हरी गोभी)", category: "VEGETABLES" },
  { englishName: "Mushroom", hindiName: "Mushroom (मशरूम)", category: "VEGETABLES" },
  { englishName: "French Beans", hindiName: "Beans (बीन्स)", category: "VEGETABLES" },
  { englishName: "Lemon", hindiName: "Nimbu (नींबू)", category: "VEGETABLES" },
  { englishName: "Green Chilli", hindiName: "Hari Mirch (हरी मिर्च)", category: "VEGETABLES" },
  { englishName: "Red Chilli", hindiName: "Lal Mirch (लाल मिर्च)", category: "VEGETABLES" },
  { englishName: "Cluster Beans", hindiName: "Gwaar Phali (ग्वार फली)", category: "VEGETABLES" },
  { englishName: "Drumstick", hindiName: "Sahjan (सहजन)", category: "VEGETABLES" },
  { englishName: "Colocasia Root", hindiName: "Arbi (अरबी)", category: "VEGETABLES" },
  { englishName: "Ash Gourd", hindiName: "Petha (पेठा)", category: "VEGETABLES" },
  { englishName: "Spring Onion", hindiName: "Hara Pyaaz (हरा प्याज)", category: "VEGETABLES" },
  { englishName: "Turnip", hindiName: "Shalgam (शलगम)", category: "VEGETABLES" },
  { englishName: "Fenugreek Leaves", hindiName: "Hari Methi (हरी मेथी)", category: "VEGETABLES" },

  // ── FRUITS ──
  { englishName: "Mango", hindiName: "Aam (आम)", category: "FRUITS" },
  { englishName: "Banana", hindiName: "Kela (केला)", category: "FRUITS" },
  { englishName: "Guava", hindiName: "Amrood (अमरूद)", category: "FRUITS" },
  { englishName: "Papaya", hindiName: "Papita (पपीता)", category: "FRUITS" },
  { englishName: "Watermelon", hindiName: "Tarbooz (तरबूज)", category: "FRUITS" },
  { englishName: "Pomegranate", hindiName: "Anaar (अनार)", category: "FRUITS" },
  { englishName: "Apple", hindiName: "Seb (सेब)", category: "FRUITS" },
  { englishName: "Orange", hindiName: "Santra (संतरा)", category: "FRUITS" },
  { englishName: "Grapes", hindiName: "Angoor (अंगूर)", category: "FRUITS" },
  { englishName: "Pineapple", hindiName: "Ananas (अनानास)", category: "FRUITS" },
  { englishName: "Sweet Lime", hindiName: "Mausambi (मौसमी)", category: "FRUITS" },
  { englishName: "Coconut", hindiName: "Nariyal (नारियल)", category: "FRUITS" },
  { englishName: "Muskmelon", hindiName: "Kharbooza (खरबूजा)", category: "FRUITS" },
  { englishName: "Custard Apple", hindiName: "Shareefa (शरीफा)", category: "FRUITS" },
  { englishName: "Fig", hindiName: "Anjeer (अंजीर)", category: "FRUITS" },
  { englishName: "Jackfruit", hindiName: "Kathal (कटहल)", category: "FRUITS" },
  { englishName: "Plum", hindiName: "Aloo Bukhara (आलू बुखारा)", category: "FRUITS" },
  { englishName: "Peach", hindiName: "Aadoo (आडू)", category: "FRUITS" },
  { englishName: "Pear", hindiName: "Nashpati (नाशपाती)", category: "FRUITS" },
  { englishName: "Apricot", hindiName: "Khubani (खुबानी)", category: "FRUITS" },
  { englishName: "Litchi", hindiName: "लीची (Litchi)", category: "FRUITS" },
  { englishName: "Strawberry", hindiName: "Strawberry (स्ट्रॉबेरी)", category: "FRUITS" },
  { englishName: "Blackberry", hindiName: "Jamun (जामुन)", category: "FRUITS" },
  { englishName: "Tamarind", hindiName: "Imli (इमली)", category: "FRUITS" },
  { englishName: "Date Palm", hindiName: "Khajoor (खजूर)", category: "FRUITS" },
  { englishName: "Gooseberry", hindiName: "Amla (आंवला)", category: "FRUITS" },
  { englishName: "Wood Apple", hindiName: "Bel (बेल)", category: "FRUITS" },
  { englishName: "Mulberry", hindiName: "Shahtoot (शहतूत)", category: "FRUITS" },

  // ── GRAINS ──
  { englishName: "Wheat", hindiName: "Gehun (गेहूं)", category: "GRAINS" },
  { englishName: "Rice", hindiName: "Chawal (चावल)", category: "GRAINS" },
  { englishName: "Maize", hindiName: "Makka (मक्का)", category: "GRAINS" },
  { englishName: "Pearl Millet", hindiName: "Bajra (बाजरा)", category: "GRAINS" },
  { englishName: "Sorghum", hindiName: "Jowar (ज्वार)", category: "GRAINS" },
  { englishName: "Chickpea", hindiName: "Chana (चना)", category: "GRAINS" },
  { englishName: "Barley", hindiName: "Jau (जौ)", category: "GRAINS" },
  { englishName: "Finger Millet", hindiName: "Ragi (रागी)", category: "GRAINS" },
  { englishName: "Foxtail Millet", hindiName: "Kangni (कांगनी)", category: "GRAINS" },
  { englishName: "Pigeon Pea", hindiName: "Arhar Dal (अरहर दाल)", category: "GRAINS" },
  { englishName: "Mung Bean", hindiName: "Moong Dal (मूंग दाल)", category: "GRAINS" },
  { englishName: "Black Gram", hindiName: "Urad Dal (उड़द दाल)", category: "GRAINS" },
  { englishName: "Red Lentil", hindiName: "Masoor Dal (मसूर दाल)", category: "GRAINS" },
  { englishName: "Kidney Beans", hindiName: "Rajma (राजमा)", category: "GRAINS" },
  { englishName: "Oats", hindiName: "Jaei (जई)", category: "GRAINS" },
  { englishName: "Sesame Seeds", hindiName: "Til (तिल)", category: "GRAINS" },
  { englishName: "Mustard Seeds", hindiName: "Sarso (सरसों)", category: "GRAINS" },
  { englishName: "Soybean", hindiName: "Soybean (सोयाबीन)", category: "GRAINS" },
  { englishName: "Peanut", hindiName: "Mungfali (मूंगफली)", category: "GRAINS" },

  // ── HERBS ──
  { englishName: "Coriander", hindiName: "Dhaniya (धनिया)", category: "HERBS" },
  { englishName: "Mint", hindiName: "Pudina (पुदीना)", category: "HERBS" },
  { englishName: "Curry Leaves", hindiName: "Kadi Patta (कड़ी पत्ता)", category: "HERBS" },
  { englishName: "Fenugreek", hindiName: "Methi (मेथी)", category: "HERBS" },
  { englishName: "Basil (Tulsi)", hindiName: "Tulsi (तुलसी)", category: "HERBS" },
  { englishName: "Aloe Vera", hindiName: "Gwarpatha (घृतकुमारी)", category: "HERBS" },
  { englishName: "Lemongrass", hindiName: "Lemongrass (लेमनग्रास)", category: "HERBS" },
  { englishName: "Oregano", hindiName: "Oregano (अजवायन के पत्ते)", category: "HERBS" },
  { englishName: "Rosemary", hindiName: "Rosemary (रोज़मेरी)", category: "HERBS" },
  { englishName: "Thyme", hindiName: "Banajwain (बनअजवाइन)", category: "HERBS" },
  { englishName: "Stevia", hindiName: "Meethi Tulsi (मीठी तुलसी)", category: "HERBS" },

  // ── DAIRY ──
  { englishName: "Milk", hindiName: "Doodh (दूध)", category: "DAIRY" },
  { englishName: "Curd", hindiName: "Dahi (दही)", category: "DAIRY" },
  { englishName: "Paneer", hindiName: "Paneer (पनीर)", category: "DAIRY" },
  { englishName: "Ghee", hindiName: "Ghee (घी)", category: "DAIRY" },
  { englishName: "Butter", hindiName: "Makkhan (मक्खन)", category: "DAIRY" },
  { englishName: "Buttermilk", hindiName: "Chaas (छाछ)", category: "DAIRY" },
  { englishName: "Khoya", hindiName: "Mawa (मावा)", category: "DAIRY" },

  // ── OTHER ──
  { englishName: "Sugarcane", hindiName: "Ganna (गन्ना)", category: "OTHER" },
  { englishName: "Honey", hindiName: "Shahad (शहद)", category: "OTHER" },
  { englishName: "Cotton", hindiName: "Kapaas (कपास)", category: "OTHER" },
  { englishName: "Tobacco", hindiName: "Tambaku (तंबाकू)", category: "OTHER" },
  { englishName: "Tea Leaves", hindiName: "Chai Patti (चाय पत्ती)", category: "OTHER" },
  { englishName: "Coffee Beans", hindiName: "Coffee Beans (कॉफी बीन्स)", category: "OTHER" },
];

async function seedCatalog() {
  console.log("🌱 Seeding CropCatalog with 100+ Indian crops...\n");

  let created = 0;
  let skipped = 0;

  for (const item of CATALOG_ITEMS) {
    const existing = await prisma.cropCatalog.findFirst({
      where: { englishName: item.englishName },
    });

    if (existing) {
      // Update just in case the name is already there but we want to ensure hindi name matches
      await prisma.cropCatalog.update({
        where: { id: existing.id },
        data: {
          hindiName: item.hindiName,
          category: item.category as any,
        }
      });
      console.log(`  🔄 Updated: ${item.englishName} (${item.hindiName})`);
      skipped++;
      continue;
    }

    await prisma.cropCatalog.create({
      data: {
        englishName: item.englishName,
        hindiName: item.hindiName,
        category: item.category as any,
        isActive: true,
      },
    });
    console.log(`  ✅ Created: ${item.englishName} (${item.hindiName})`);
    created++;
  }

  console.log(`\n🎉 Done! Created ${created} new entries, updated/skipped ${skipped} existing.`);
  await prisma.$disconnect();
}

seedCatalog().catch(err => {
  console.error("❌ Seed failed:", err);
  prisma.$disconnect();
  process.exit(1);
});
