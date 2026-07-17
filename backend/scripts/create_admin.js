#!/usr/bin/env node
require('dotenv').config();
const db = require('../src/config/db');
const bcrypt = require('bcrypt');

async function main() {
  const nome = process.argv[2];
  const senha = process.argv[3];
  const nivel = process.argv[4] || 'admin';

  if (!nome || !senha) {
    console.log('Uso: node scripts/create_admin.js NOME SENHA [nivel]');
    process.exit(1);
  }

  try {
    const hash = await bcrypt.hash(senha, 12);
    const sql = 'INSERT INTO login (nome, senha, nivel) VALUES (?, ?, ?)';
    const [result] = await db.query(sql, [nome, hash, nivel]);
    console.log(`Usuário criado com idLogin=${result.insertId}, nome=${nome}, nivel=${nivel}`);
    process.exit(0);
  } catch (err) {
    console.error('Erro ao criar usuário:', err);
    process.exit(1);
  }
}

main();
