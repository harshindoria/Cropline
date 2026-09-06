import { User } from "@prisma/client"

export const sanitizeUser = (user: User) => {
    const { bankAccount, bankIfsc, firebaseUid, aadhaarUrl, dlUrl, rcUrl, ...safe } = user;
  return safe
}