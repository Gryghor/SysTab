require('dotenv').config();

const express = require('express');
const cors = require('cors');

const tabletsRoutes = require('./routes/tabletsRoutes.js');
const chamadosRoutes = require('./routes/chamadosRoutes.js');
const empresasRoutes = require("./routes/empresasRoutes");
const usersRoutes = require("./routes/usersRoutes");
const unidadesRoutes = require("./routes/unidadesRoutes");
const regRoutes = require("./routes/regRoutes");
const authRoutes = require('./routes/authRoutes.js');
const logsRoutes = require('./routes/logsRoutes.js');
const accessAccountsRoutes = require('./routes/accessAccountsRoutes.js');
const reportsRoutes = require('./routes/reportsRoutes.js');

const app = express();

const allowedOrigins = ['http://localhost:3002', 'http://10.87.20.9:3002', 'http://10.87.22.140:3002']; // frontend URLs

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            return callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

app.use(express.json());

app.use('/auth', authRoutes); //rota login

//rotas
app.use('/tablets', tabletsRoutes);
app.use('/chamados', chamadosRoutes);
app.use('/empresas', empresasRoutes);
app.use('/usuarios', usersRoutes);
app.use('/unidades', unidadesRoutes);
app.use('/regionais', regRoutes);
app.use('/logs', logsRoutes);
app.use('/admin/contas', accessAccountsRoutes);
app.use('/relatorios', reportsRoutes);

module.exports = app;




