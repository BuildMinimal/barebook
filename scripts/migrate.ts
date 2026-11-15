import { runMigrations } from "../src/db/migrate";

runMigrations();
console.log("migrations applied");
