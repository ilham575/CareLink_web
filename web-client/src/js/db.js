// src/db.js
import Dexie from "dexie";

export const db = new Dexie("PharmacyDB");

db.version(1).stores({
  pharmacies: "++id, name_th, address, phone_store, time_open, time_close",
  pharmacists: "++id, storeId, firstname, lastname, license_number, phone, is_primary"
});
