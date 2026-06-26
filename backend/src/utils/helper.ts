import { User } from "@prisma/client"

export const sanitizeUser = (user: User) => {
  const { bankAccount, bankIfsc, firebaseUid, ...safe } = user
  return safe
}