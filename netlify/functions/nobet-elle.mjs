// GET /api/nobet — nobetciyi elle calistirir (arayuzdeki "Simdi kontrol et").
import { nobet } from '../../src/nobetci.mjs';

export default async () => Response.json(await nobet());

export const config = { path: '/api/nobet' };
