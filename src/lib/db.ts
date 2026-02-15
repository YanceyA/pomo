import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

interface DbInfo {
  path: string;
  is_custom: boolean;
  is_cloud_synced: boolean;
  journal_mode: string;
  default_path: string;
  is_portable: boolean;
}

export async function getDb(): Promise<Database> {
  if (!db) {
    const info: DbInfo = await invoke("get_db_info");
    db = await Database.load(`sqlite:${info.path}`);
  }
  return db;
}
