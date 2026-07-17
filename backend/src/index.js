require('dotenv').config();

const express = require('express');
const cors = require('cors');

const auth = require('./middlewares/authMiddleware.js');

const tabletsRoutes = require('./routes/tabletsRoutes.js');
const chamadosRoutes = require('./routes/chamadosRoutes.js');
const empresasRoutes = require("./routes/empresasRoutes");
const usersRoutes = require("./routes/usersRoutes");
const unidadesRoutes = require("./routes/unidadesRoutes");
const regRoutes = require("./routes/regRoutes");
const authRoutes = require('./routes/authRoutes.js');

const app = express();
    
// Frontend origins allowed in development. Add other origins as needed.
const allowedOrigins = [
    'http://10.87.20.239:3002',
    'http://localhost:3002'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true); // allow non-browser requests like curl/postman
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        console.warn('Blocked CORS request from origin:', origin);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    optionsSuccessStatus: 200,
}));

app.use(express.json());

app.use('/auth', authRoutes); //rota login

//rotas
app.use(auth); //middleware de autenticação para as demais rotas

app.use('/tablets', tabletsRoutes);
app.use('/chamados', chamadosRoutes);
app.use('/empresas', empresasRoutes);
app.use('/usuarios', usersRoutes);
app.use('/unidades', unidadesRoutes);
app.use('/regionais', regRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;




