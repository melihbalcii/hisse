// Zamanlanmis nobetci. Elle tetiklemek icin ayri fonksiyon var (nobet-elle).
// Netlify'da bir fonksiyon hem `schedule` hem `path` tasiyamaz.
import { nobet } from '../../src/nobetci.mjs';

export default async () => {
  const s = await nobet();
  return new Response(`izlenen ${s.izlenen}, degisen ${s.degisen}`);
};

export const config = { schedule: '*/30 7-15 * * 1-5' };   // seans icinde 30 dk'da bir
