const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const defaultPath = path.join(__dirname, '..', 'data', 'guerra_pizzas.sqlite');

function transaction(db, action) {
    db.exec('BEGIN IMMEDIATE');
    try {
        const result = action();
        db.exec('COMMIT');
        return result;
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

function openDatabase(filename = process.env.DATABASE_PATH || defaultPath) {
    if (filename !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
    const db = new DatabaseSync(filename);
    try {
        db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
        transaction(db, () => {
            db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
            // Migração aditiva: mantém pedidos já existentes.
            const addColumn = (table, column, type) => {
                if (!db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column)) {
                    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
                }
            };
            addColumn('pedidos', 'chave_checkout', 'TEXT');
            addColumn('pedidos', 'endereco_json', 'TEXT');
            addColumn('itens_pedido', 'nome_pizza', 'TEXT');
            addColumn('itens_pedido', 'opcoes_json', "TEXT NOT NULL DEFAULT '{}' ");
            db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_checkout ON pedidos(usuario_id, chave_checkout);
                CREATE TABLE IF NOT EXISTS sessoes (
                    token_hash TEXT PRIMARY KEY,
                    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
                    expira_em INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id);
                CREATE INDEX IF NOT EXISTS idx_sessoes_expiracao ON sessoes(expira_em);`);
        });
        return db;
    } catch (error) {
        db.close();
        throw error;
    }
}
module.exports = { openDatabase, defaultPath, transaction };
if (require.main === module) {
    const db = openDatabase();
    console.log(`Banco inicializado: ${process.env.DATABASE_PATH || defaultPath}`);
    db.close();
}
