import express, { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      // The JSON body exactly as it arrived. Webhook signatures are computed over these bytes, not the parsed object.
      rawBody?: Buffer;
    }
  }
}

// Parses JSON for every route and keeps the original bytes. The buffer is the one the parser
// already read, so keeping a reference costs no extra copy.
export const parseJsonBody = express.json({
  limit: '50mb',
  verify: (req, _res, buf) => {
    (req as Request).rawBody = buf;
  },
});
