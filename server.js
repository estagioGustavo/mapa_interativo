const express = require('express');
const cors = require('cors');
require('dotenv').config();

const desenhosRouter = require('./routes/desenhos');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('./'));

app.use('/api/desenhos', desenhosRouter);


app.listen(PORT, () => {
  console.log(`\n API a funcionar em http://localhost:${PORT}`);
  console.log(`Entrar no mapa em http://localhost:${PORT}/teste.html\n`);
});



