const { openDatabase, transaction } = require('./index');
function seedCatalog(db) {
    // Importa apenas o cardápio que já aparecia no frontend, sem alterar catálogo existente.
    if (db.prepare('SELECT count(*) AS count FROM pizzas').get().count > 0) return;
    transaction(db, () => {
        let category = db.prepare("SELECT id FROM categorias WHERE nome = 'Tradicionais'").get();
        if (!category) category = { id: Number(db.prepare('INSERT INTO categorias(nome,descricao) VALUES (?,?)').run('Tradicionais', 'Pizzas artesanais').lastInsertRowid) };
        const insert = db.prepare('INSERT INTO pizzas(categoria_id,nome,descricao,preco) VALUES (?,?,?,?)');
        for (const [name, description, price] of [
            ['Pizza Margherita', 'Molho de tomate artesanal, muçarela de búfala, manjericão fresco e azeite.', 45],
            ['Pizza Calabresa', 'Molho de tomate, muçarela, calabresa selecionada e cebolas roxas.', 48],
            ['Pizza Quatro Queijos', 'Molho de tomate, muçarela, provolone, parmesão e gorgonzola.', 55]
        ]) insert.run(category.id, name, description, price);
    });
}
module.exports = { seedCatalog };
if (require.main === module) {
    const db = openDatabase();
    try { seedCatalog(db); console.log('Cardápio inicial disponível.'); } finally { db.close(); }
}
