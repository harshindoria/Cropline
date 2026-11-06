import { User } from "@prisma/client"

export const sanitizeUser = <T extends User>(user: T) => {
    const { firebaseUid, ...safe } = user;
  return safe
}