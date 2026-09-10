import express from "express";
import cors from "cors";
import { pathToFileURL } from "node:url";
import menuRoutes from "./src/modules/menu/menu.routes.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use("/api", menuRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

export default app;
