#!/usr/bin/env node
// Run SQL migrations against MySQL.
// Reads all .sql files from migrations/ in alphabetical order.
// Tracks applied migrations in a _migrations table.

const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

const DB_CONFIG = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_DATABASE || "tokentracker",
  user: process.env.DB_USERNAME || "root",
  password: process.env.DB_PASSWORD || "",
  multipleStatements: true,
};

async function migrate() {
  const pool = await mysql.createPool(DB_CONFIG);

  try {
    // Create migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get already-applied migrations
    const [applied] = await pool.query(
      "SELECT name FROM _migrations ORDER BY name"
    );
    const appliedSet = new Set(applied.map((r) => r.name));

    // Read migration files
    const migrationsDir = path.join(__dirname, "..", "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  skip: ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      console.log(`  apply: ${file}`);
      await pool.query(sql);
      await pool.query("INSERT INTO _migrations (name) VALUES (?)", [file]);
      count++;
    }

    console.log(
      count > 0
        ? `Applied ${count} migration(s).`
        : "No new migrations to apply."
    );
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
