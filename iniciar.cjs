const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const backend = path.join(__dirname, 'backend');
const candidates = [process.execPath];
// Alternativa local quando o Node padrão do Windows é antigo.
if (process.env.USERPROFILE) candidates.push(path.join(process.env.USERPROFILE, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'bin', 'node.exe'));
const runtime = candidates.find(candidate => fs.existsSync(candidate) && spawnSync(candidate, ['-e', "require('node:sqlite'); if (Number(process.versions.node.split('.')[0]) < 22) process.exit(1)"], { windowsHide: true, stdio: 'ignore' }).status === 0);
if (!runtime) {
    console.error('Instale Node.js 22.13 ou superior e tente novamente.');
    process.exit(1);
}
if (!fs.existsSync(path.join(backend, 'node_modules', 'express'))) {
    console.error('Instale as dependências na pasta backend com npm ci (Node.js 22.13 ou superior).');
    process.exit(1);
}
console.log('Iniciando Guerra de Pizzas. Mantenha esta janela aberta.');
const result = spawnSync(runtime, ['--env-file-if-exists=.env', 'app.js'], { cwd: backend, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
