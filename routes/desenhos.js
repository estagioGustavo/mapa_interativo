const express = require('express');
const pool = require('../config');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [desenhos] = await connection.query(
      'SELECT id, nome, descricao, tipo, geojson, cor, categoria, estado_ocupacao, tipo_carga, estado_barco, imo, local, fundeadouro_id, data_criacao FROM desenhos ORDER BY data_atualizacao DESC'
    );
    connection.release();
    
    const desenhosComGeoJSON = desenhos.map(d => ({
      ...d,
      geojson: JSON.parse(d.geojson)
    }));
    
    res.json({ status: 'sucesso', dados: desenhosComGeoJSON });
  } catch (error) {
    console.error('Erro ao listar desenhos:', error);
    res.status(500).json({ status: 'erro', mensagem: error.message });
  }
});

router.get('/filtro', async (req, res) => {
  try {
    const { tipo } = req.query;
    
    if (!tipo) {
      return res.status(400).json({ 
        status: 'erro', 
        mensagem: 'Parâmetro tipo é obrigatório (ex: ?tipo=polygon ou ?tipo=polygon,circle)' 
      });
    }
    
    const tipoArray = typeof tipo === 'string' ? tipo.split(',').map(t => t.trim()) : tipo;
    const placeholders = tipoArray.map(() => '?').join(',');
    
    const connection = await pool.getConnection();
    const [desenhos] = await connection.query(
      `SELECT id, nome, descricao, tipo, geojson, cor, categoria, estado_ocupacao, tipo_carga, estado_barco, imo, local, fundeadouro_id, data_criacao FROM desenhos WHERE tipo IN (${placeholders}) ORDER BY data_atualizacao DESC`,
      tipoArray
    );
    connection.release();
    
    const desenhosComGeoJSON = desenhos.map(d => ({
      ...d,
      geojson: JSON.parse(d.geojson)
    }));
    
    res.json({ status: 'sucesso', dados: desenhosComGeoJSON });
  } catch (error) {
    console.error('Erro ao filtrar desenhos:', error);
    res.status(500).json({ status: 'erro', mensagem: error.message });
  }
});

router.get('/fundeadouros-navios', async (req, res) => {
  let connection;

  try {
    connection = await pool.getConnection();

    const [rows] = await connection.query(`
      SELECT
        f.id              AS fund_id,
        f.nome            AS fund_nome,
        f.descricao       AS fund_descricao,
        f.tipo            AS fund_tipo,
        f.geojson         AS fund_geojson,
        f.cor             AS fund_cor,
        f.categoria       AS fund_categoria,
        f.estado_ocupacao AS fund_estado,
        f.data_criacao    AS fund_data,

        n.id              AS navio_id,
        n.nome            AS navio_nome,
        n.tipo            AS navio_tipo,
        n.geojson         AS navio_geojson,
        n.estado_barco    AS navio_estado,
        n.imo             AS navio_imo,
        n.local           AS navio_local,
        n.estado_navio_fundeado AS navio_estado_fundeado
      FROM desenhos f
      LEFT JOIN desenhos n
        ON n.fundeadouro_id = f.id
       AND n.categoria = 'navio'
       AND n.estado_barco = 'fundeado'
      WHERE f.categoria = 'fundeadouro'
      ORDER BY f.id, n.id
    `);

    const mapa = {};

    rows.forEach(r => {
      if (!mapa[r.fund_id]) {
        mapa[r.fund_id] = {
          id: r.fund_id,
          nome: r.fund_nome,
          descricao: r.fund_descricao,
          tipo: r.fund_tipo,
          categoria: r.fund_categoria,
          estado_ocupacao: r.fund_estado,
          cor: r.fund_cor,
          data_criacao: r.fund_data,
          geojson: JSON.parse(r.fund_geojson),
          navios: []
        };
      }

      if (r.navio_id) {
        mapa[r.fund_id].navios.push({
          id: r.navio_id,
          nome: r.navio_nome,
          tipo: r.navio_tipo,
          categoria: 'navio',
          estado_barco: r.navio_estado,
          imo: r.navio_imo,
          local: r.navio_local,
          estado_navio_fundeado: r.navio_estado_fundeado,
          geojson: JSON.parse(r.navio_geojson)
        });
      }
    });

    res.json({
      status: 'sucesso',
      dados: Object.values(mapa)
    });

  } catch (error) {
    console.error('Erro ao obter fundeadouros com navios:', error);
    res.status(500).json({
      status: 'erro',
      mensagem: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    
    const [desenhos] = await connection.query(
      'SELECT id, nome, descricao, tipo, geojson, cor, categoria, estado_ocupacao, tipo_carga, estado_barco, imo, local, fundeadouro_id, data_criacao FROM desenhos WHERE id = ?',
      [id]
    );
    connection.release();
    
    if (desenhos.length === 0) {
      return res.status(404).json({ status: 'erro', mensagem: 'Desenho não encontrado' });
    }
    
    const desenho = {
      ...desenhos[0],
      geojson: JSON.parse(desenhos[0].geojson)
    };
    
    res.json({ status: 'sucesso', dados: desenho });
  } catch (error) {
    console.error('Erro ao obter desenho:', error);
    res.status(500).json({ status: 'erro', mensagem: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    let { nome, descricao, tipo, geojson, cor, categoria, estado_ocupacao, tipo_carga, estado_barco } = req.body;

    if (!geojson || !tipo) {
      return res.status(400).json({ status: 'erro', mensagem: 'geojson e tipo são obrigatórios' });
    }

    if (!categoria || !['terminal', 'fundeadouro', 'navio'].includes(categoria)) {
      return res.status(400).json({
        status: 'erro',
        mensagem: 'categoria inválida. Valores válidos: terminal, fundeadouro, navio'
      });
    }

    const tiposCargaValidos = [
      'Multiproposito',
      'GraneisLiquido_QuimicosCombustiveis',
      'CargaGeral_Conteineres',
      'GraneisLiquido_SucosCitricos',
      'GraneisSolidos_Vegetais',
      'CargaGeral_Celulose',
      'Passageiros',
      'GraneisSolidos_Minerais',
      'CargaGeral_Veiculos'
    ];
    const estadoOcupacaoValidos = ['normal', 'atencao', 'critico', 'indisponivel'];

    const estadoBarcoValidos = ['atracado', 'manobra', 'fundeado', 'saida'];

    if (categoria === 'terminal') {
      if ((!estado_ocupacao || !tipo_carga) && estado_barco !== null) {
        return res.status(400).json({
          status: 'erro',
          mensagem: 'Para terminais, estado_ocupacao e tipo_carga são obrigatórios e estado_barco deve ser nulo'
        });
      }

      estado_ocupacao = String(estado_ocupacao);
      tipo_carga = String(tipo_carga);
      estado_barco = String(estado_barco);

      if (!estadoOcupacaoValidos.includes(estado_ocupacao)) {
        return res.status(400).json({
          status: 'erro',
          mensagem: `estado_ocupacao inválido. Valores válidos: ${estadoOcupacaoValidos.join(', ')}`
        });
      }
      if (!tiposCargaValidos.includes(tipo_carga)) {
        return res.status(400).json({
          status: 'erro',
          mensagem: `tipo_carga inválido. Valores válidos: ${tiposCargaValidos.join(', ')}`
        });
      }
      
      estado_barco = null;

    } else if (categoria === 'fundeadouro') {
      if (!estado_ocupacao && (tipo_carga !== null || estado_barco !== null)) {
        return res.status(400).json({
          status: 'erro',
          mensagem: 'Para fundeadouros, estado_ocupacao é obrigatório e tipo_carga e estado_barco devem ser nulos'
        });
      }

      estado_ocupacao = String(estado_ocupacao);

      if (!estadoOcupacaoValidos.includes(estado_ocupacao)) {
        return res.status(400).json({
          status: 'erro',
          mensagem: `estado_ocupacao inválido. Valores válidos: ${estadoOcupacaoValidos.join(', ')}`
        });
      }

      tipo_carga = null;
      estado_barco = null; 

    } else if (categoria === 'navio') {
      if (!estado_barco && (estado_ocupacao !== null || tipo_carga !== null)) {
        return res.status(400).json({
          status: 'erro',
          mensagem: 'Para navios, estado_barco é obrigatório e tipo_carga e estado_ocupacao devem ser nulos'
        });
      }

      estado_barco = String(estado_barco);

      if (!estadoBarcoValidos.includes(estado_barco)) {
        return res.status(400).json({
          status: 'erro',
          mensagem: `estado_barco inválido. Valores válidos: ${estadoBarcoValidos.join(', ')}`
        });
      }
      estado_ocupacao = null;
      tipo_carga = null;
    }

    const connection = await pool.getConnection();
    const geojsonStr = JSON.stringify(geojson);

    const [result] = await connection.query(
      'INSERT INTO desenhos (nome, descricao, tipo, geojson, cor, categoria, estado_ocupacao, tipo_carga, estado_barco) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        nome || 'Sem nome',
        descricao || '',
        tipo,
        geojsonStr,
        cor || '#808080',
        categoria,
        estado_ocupacao,
        tipo_carga,
        estado_barco
      ]
    );

    connection.release();

    res.status(201).json({
      status: 'sucesso',
      mensagem: 'Desenho guardado com sucesso',
      id: result.insertId
    });

  } catch (error) {
    console.error('Erro ao criar desenho:', error);
    res.status(500).json({ status: 'erro', mensagem: error.message });
  }
});




router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let { nome, descricao, geojson, cor, categoria, estado_ocupacao, tipo_carga, estado_barco } = req.body;

    const connection = await pool.getConnection();

    const [rows] = await connection.query('SELECT * FROM desenhos WHERE id = ?', [id]);
    if (rows.length === 0) {
      connection.release();
      return res.status(404).json({ status: 'erro', mensagem: 'Desenho não encontrado' });
    }
    const desenhoAtual = rows[0];

    categoria = categoria ?? desenhoAtual.categoria;
    estado_ocupacao = estado_ocupacao ?? desenhoAtual.estado_ocupacao;
    tipo_carga = tipo_carga ?? desenhoAtual.tipo_carga;
    estado_barco = estado_barco ?? desenhoAtual.estado_barco;

    if (!['terminal', 'fundeadouro', 'navio'].includes(categoria)) {
      connection.release();
      return res.status(400).json({
        status: 'erro',
        mensagem: 'categoria inválida. Valores válidos: terminal, fundeadouro, navio'
      });
    }

    const tiposCargaValidos = [
      'Multiproposito',
      'GraneisLiquido_QuimicosCombustiveis',
      'CargaGeral_Conteineres',
      'GraneisLiquido_SucosCitricos',
      'GraneisSolidos_Vegetais',
      'CargaGeral_Celulose',
      'Passageiros',
      'GraneisSolidos_Minerais',
      'CargaGeral_Veiculos'
    ];
    const estadoOcupacaoValidos = ['normal', 'atencao', 'critico', 'indisponivel'];

    const estadoBarcoValidos = ['atracado', 'manobra', 'fundeado', 'saida'];

    if (categoria === 'terminal') {
      if (!estado_ocupacao || !tipo_carga) {
        connection.release();
        return res.status(400).json({
          status: 'erro',
          mensagem: 'Para terminais, estado_ocupacao e tipo_carga são obrigatórios'
        });
      }
      if (!estadoOcupacaoValidos.includes(estado_ocupacao)) {
        connection.release();
        return res.status(400).json({
          status: 'erro',
          mensagem: `estado_ocupacao inválido. Valores válidos: ${estadoOcupacaoValidos.join(', ')}`
        });
      }
      if (!tiposCargaValidos.includes(tipo_carga)) {
        connection.release();
        return res.status(400).json({
          status: 'erro',
          mensagem: `tipo_carga inválido. Valores válidos: ${tiposCargaValidos.join(', ')}`
        });
      }
    }

    if (categoria === 'fundeadouro') {
      if (!estado_ocupacao) {
        connection.release();
        return res.status(400).json({
          status: 'erro',
          mensagem: 'Para fundeadouros, estado_ocupacao é obrigatório e tipo_carga deve ser nulo'
        });
      }
      if (!estadoOcupacaoValidos.includes(estado_ocupacao)) {
        connection.release();
        return res.status(400).json({
          status: 'erro',
          mensagem: `estado_ocupacao inválido. Valores válidos: ${estadoOcupacaoValidos.join(', ')}`
        });
      }
      tipo_carga = null; 
    }

    if (categoria === 'navio') {
      if (!estado_barco) {
        connection.release();
        return res.status(400).json({
          status: 'erro',
          mensagem: 'Para navios, estado_barco é obrigatório.'
        });
      }

      estado_barco = String(estado_barco).toLowerCase();

      if (!estadoBarcoValidos.includes(estado_barco)) {
        connection.release();
        return res.status(400).json({
          status: 'erro',
          mensagem: `estado_barco inválido: ${estadoBarcoValidos.join(', ')}`
        });
      }

      estado_ocupacao = null;
      tipo_carga = null;
    }


    let updates = [];
    let values = [];

    if (nome !== undefined) updates.push('nome = ?'), values.push(nome);
    if (descricao !== undefined) updates.push('descricao = ?'), values.push(descricao);
    if (geojson !== undefined) updates.push('geojson = ?'), values.push(JSON.stringify(geojson));
    if (cor !== undefined) updates.push('cor = ?'), values.push(cor);
    if (categoria !== undefined) updates.push('categoria = ?'), values.push(categoria);
    if (estado_ocupacao !== undefined) updates.push('estado_ocupacao = ?'), values.push(estado_ocupacao);
    if (tipo_carga !== undefined) updates.push('tipo_carga = ?'), values.push(tipo_carga);
    if (estado_barco !== undefined) updates.push('estado_barco = ?'), values.push(estado_barco);

    if (updates.length === 0) {
      connection.release();
      return res.status(400).json({ status: 'erro', mensagem: 'Nenhum campo para atualizar' });
    }

    values.push(id);
    const sql = `UPDATE desenhos SET ${updates.join(', ')} WHERE id = ?`;
    await connection.query(sql, values);

    connection.release();

    res.json({ status: 'sucesso', mensagem: 'Desenho atualizado com sucesso' });

  } catch (error) {
    console.error('Erro ao atualizar desenho:', error);
    res.status(500).json({ status: 'erro', mensagem: error.message });
  }
});



router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    
    const [result] = await connection.query(
      'DELETE FROM desenhos WHERE id = ?',
      [id]
    );
    connection.release();
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'erro', mensagem: 'Desenho não encontrado' });
    }

    res.json({ status: 'sucesso', mensagem: 'Desenho apagado com sucesso' });
  } catch (error) {
    console.error('Erro ao apagar desenho:', error);
    res.status(500).json({ status: 'erro', mensagem: error.message });
  }
});

router.get('/categoria/:tipo', async (req, res) => {
  try {
    const { tipo } = req.params; 

    if (!['terminal', 'fundeadouro', 'navio'].includes(tipo)) {
      return res.status(400).json({
        status: 'erro',
        mensagem: 'Categoria inválida. Valores válidos: terminal, fundeadouro, navio'
      });
    }

    const connection = await pool.getConnection();
    const [rows] = await connection.query(
      'SELECT * FROM desenhos WHERE categoria = ?',
      [tipo]
    );
    connection.release();

    res.json({ status: 'sucesso', dados: rows });
  } catch (error) {
    console.error('Erro ao buscar desenhos por categoria:', error);
    res.status(500).json({ status: 'erro', mensagem: error.message });
  }
});

// router.get('/get-markers/:type?', async (req, res) => {
//   try {
//     const { type } = req.params;
//     const connection = await pool.getConnection();
    
// });

module.exports = router;

// router.get('/filtro-cor', async (req, res) => {
//   try {
//     const { cor } = req.query;

//     if (!cor) {
//       return res.status(400).json({
//         status: 'erro',
//         mensagem: 'Parâmetro cor é obrigatório (ex: ?cor=#3388ff ou ?cor=#3388ff,#ff0000)'
//       });
//     }

//     const cores = cor.split(',').map(c => c.trim().toLowerCase());
//     const placeholders = cores.map(() => '?').join(',');

//     const [desenhos] = await pool.query(
//       `SELECT * FROM desenhos WHERE LOWER(cor) IN (${placeholders})`,
//       cores
//     );

//     const desenhosComFundeadouros = await Promise.all(
//       desenhos.map(async desenho => {
//         const [fundeadouros] = await pool.query(
//           `SELECT id, estado_ocupacao FROM fundeadouros WHERE desenho_id = ?`,
//           [desenho.id]
//         );

//         return {
//           ...desenho,
//           geojson: JSON.parse(desenho.geojson),
//           fundeadouros
//         };
//       })
//     );

//     res.json({ status: 'sucesso', dados: desenhosComFundeadouros });
//   } catch (err) {
//     console.error('Erro ao filtrar por cor:', err);
//     res.status(500).json({ status: 'erro', mensagem: err.message });
//   }
// });


// router.get('/cores', async (req, res) => {
//   try {
//     const connection = await pool.getConnection();

//     const [rows] = await connection.query(
//       `SELECT DISTINCT cor 
//        FROM desenhos 
//        WHERE cor IS NOT NULL AND cor != ''`
//     );

//     connection.release();

//     const cores = rows.map(r => r.cor);

//     res.json({
//       status: 'sucesso',
//       dados: cores
//     });
//   } catch (error) {
//     console.error('Erro ao listar cores:', error);
//     res.status(500).json({
//       status: 'erro',
//       mensagem: error.message
//     });
//   }
// });

// router.get('/filtro-cor-multiplo', async (req, res) => {
//   try {
//     let cores = req.query.cor;
//     if (!cores) return res.json({ status: 'sucesso', dados: [] });

//     if (typeof cores === 'string') {
//       cores = cores.split(',').map(c => c.trim().toLowerCase());
//     } else if (Array.isArray(cores)) {
//       cores = cores.map(c => c.toLowerCase());
//     }

//     const placeholders = cores.map(() => '?').join(',');

//     // Primeiro pega os desenhos filtrados
//     const [desenhos] = await pool.query(
//       `SELECT * FROM desenhos WHERE LOWER(cor) IN (${placeholders})`,
//       cores
//     );

//     // Agora pega fundeadouros para cada desenho
//     const desenhosComFundeadouros = await Promise.all(
//       desenhos.map(async desenho => {
//         const [fundeadouros] = await pool.query(
//           `SELECT id, estado_ocupacao FROM fundeadouros WHERE desenho_id = ?`,
//           [desenho.id]
//         );

//         return {
//           ...desenho,
//           geojson: JSON.parse(desenho.geojson),
//           fundeadouros
//         };
//       })
//     );

//     res.json({ status: 'sucesso', dados: desenhosComFundeadouros });
//   } catch (err) {
//     console.error('Erro ao filtrar por cor:', err);
//     res.status(500).json({ status: 'erro', mensagem: err.message });
//   }
// });

