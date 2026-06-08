import app from "./app.js";
import { initDatabase } from "./init-db.js";

const port = 3001;

initDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server listening at http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("Cannot initialize database", err);
    process.exit(1);
  });
