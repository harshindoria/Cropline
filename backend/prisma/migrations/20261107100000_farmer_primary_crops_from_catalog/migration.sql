-- CreateTable
CREATE TABLE "_FarmerPrimaryCrops" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_FarmerPrimaryCrops_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_FarmerPrimaryCrops_B_index" ON "_FarmerPrimaryCrops"("B");

-- AddForeignKey
ALTER TABLE "_FarmerPrimaryCrops" ADD CONSTRAINT "_FarmerPrimaryCrops_A_fkey" FOREIGN KEY ("A") REFERENCES "CropCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FarmerPrimaryCrops" ADD CONSTRAINT "_FarmerPrimaryCrops_B_fkey" FOREIGN KEY ("B") REFERENCES "FarmerProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep the crops farmers already chose, where the name matches a catalog crop. Anything else is dropped.
INSERT INTO "_FarmerPrimaryCrops" ("A", "B")
SELECT DISTINCT c."id", f."userId"
FROM "FarmerProfile" f
CROSS JOIN LATERAL unnest(string_to_array(f."primaryCrops", ',')) AS n(name)
JOIN "CropCatalog" c ON lower(c."englishName") = lower(btrim(n.name))
WHERE f."primaryCrops" IS NOT NULL;

-- AlterTable
ALTER TABLE "FarmerProfile" DROP COLUMN "primaryCrops";
