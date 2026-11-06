import { User } from "@prisma/client"

export const sanitizeUser = <T extends User>(user: T) => {
    const { bankAccount, bankIfsc, firebaseUid, aadhaarUrl, dlUrl, rcUrl, ...safe } = user;
  return safe
}