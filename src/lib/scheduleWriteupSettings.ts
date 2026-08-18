import { loadOnCallPhone as loadOnCallPhoneFromDb, saveOnCallPhone as saveOnCallPhoneToDb } from './supabaseSync'

export async function loadOnCallPhone(regionId: string, weekStart: string): Promise<string> {
  return loadOnCallPhoneFromDb(regionId, weekStart)
}

export async function saveOnCallPhone(
  regionId: string,
  weekStart: string,
  phone: string,
): Promise<void> {
  await saveOnCallPhoneToDb(regionId, weekStart, phone)
}
