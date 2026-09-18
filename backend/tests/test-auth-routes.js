const authRoutes = require("../src/modules/auth/auth.routes");

console.log("\n--- TESTE DE ROTAS AUTH ---");

const routes = authRoutes.stack
  .filter((layer) => layer.route)
  .map((layer) => {
    const method = Object.keys(layer.route.methods)[0].toUpperCase();
    const path = layer.route.path;

    return `${method} /auth${path}`;
  });

routes.forEach((route) => {
  console.log(route);
});

console.log("\nTotal de rotas encontradas:", routes.length);
