const API_URL = 'http://localhost:3000/api/desenhos';

const coresEstado = {
    normal: '#4CAF50',
    indisponivel: '#808080',
    atencao: '#FF9800',
    critico: '#F44336'
};

const coresTipoCarga = {
    'Multiproposito': '#d84699',
    'GraneisLiquido_QuimicosCombustiveis': '#d80143',
    'CargaGeral_Conteineres': '#8092f8',
    'GraneisLiquido_SucosCitricos': '#d87401',
    'GraneisSolidos_Vegetais': '#d8d400',
    'CargaGeral_Celulose': '#38b20f',
    'Passageiros': '#02c2d9',
    'GraneisSolidos_Minerais': '#8b4513',
    'CargaGeral_Veiculos': '#4aa794'
};

const coresBarcos = {
    'atracado': '#0dd417',
    'saida': '#FFA500',
    'manobra': '#d62728',
    'fundeado': '#096a98',
}

const coresAlerta = {
    mare_baixa_altorisco: '#FF0000',
    mare_baixa_baixorisco: '#FFA500',
    autorizacao_pendente: '#FF0000',
    limpeza_programada: '#FFA500'            

};

const alertaIcons = {
    mare_baixa_altorisco: L.icon({ iconUrl: 'public/arq/icons/danger_red.png', iconSize: [25, 25] }),
    mare_baixa_baixorisco: L.icon({ iconUrl: 'public/arq/icons/danger_orange.png', iconSize: [25, 25] }),
    autorizacao_pendente: L.icon({ iconUrl: 'public/arq/icons/danger_red.png', iconSize: [25, 25] }),
    limpeza_programada: L.icon({ iconUrl: 'public/arq/icons/info.png', iconSize: [25, 25] }),
    // default: L.icon({ iconUrl: 'public/arq/icons/default_alert.png', iconSize: [25, 25] }) // fallback
};

const coresNavioFundeado = {
  pendente: '#FF9800',
  chegada_iminente: '#39af15',
  bloqueio: '#F44336'
};


let filtroAtual = {
    categoria: 'todos',
    modo: ''
};


var layers = {
    "OSM": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        noWrap: true
    }),
    "Esri": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        noWrap: true
    }),
    "OpenTopoMap": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; OpenTopoMap',
        maxZoom: 17,
        noWrap: true
    }),
    "Carto Light": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO contributors',
        subdomains: 'abcd',
        maxZoom: 19,
        noWrap: true
    })
};

var map = L.map('map', {
    center: [0, 0],
    zoom: 2,
    layers: [layers["Carto Light"]]
});

map.setMaxBounds([[-90, -180], [90, 180]]);


var drawnItems = new L.FeatureGroup();

var drawControl = new L.Control.Draw({
    edit: { featureGroup: drawnItems, remove: false },
    draw: {
        polygon: { showArea: true },
        polyline: true,
        rectangle: true,
        circle: true,
        marker: false,
        circlemarker: false
    }
});

var worldBounds = [[-90, -180], [90, 180]];
map.fitBounds(worldBounds);

var tempLayers = [];

function atualizarCorPorEstado(layer) {
    const estado = layer.info.estado_ocupacao || 'normal';
    const cor = coresEstado[estado] || '#808080';

    if (layer.setStyle) {
        layer.setStyle({ color: cor, fillColor: cor, fillOpacity: 0.1 });
    } else if (layer instanceof L.Circle) {
        layer.setStyle({ color: cor, fillColor: cor, fillOpacity: 0.1 });
    }

    layer.info.cor = cor;
}

function atualizarCorPorCarga(layer) {
    const carga = layer.info.tipo_carga;

    const cor = coresTipoCarga[carga] || '#808080';

    layer.setStyle({
        color: cor,
        fillColor: cor,
        fillOpacity: 0.1
    });

    layer.info.cor = cor;
}

function atualizarCorBarco(layer) {
    const estado = layer.info.estado_barco || 'Atracado';
    const cor = coresBarcos[estado] || '#808080';

    if (layer.setStyle) {
        layer.setStyle({ color: cor, fillColor: cor, fillOpacity: 0.1 });
    } else if (layer instanceof L.Circle) {
        layer.setStyle({ color: cor, fillColor: cor, fillOpacity: 0.1 });
    }

    layer.info.cor = cor;
}

function atualizarCorAlerta(layer) {
    const alerta = layer.info.alerta;

    if (!alerta) {
        layer.setStyle({
            color: '#808080',
            fillColor: '#808080',
            fillOpacity: 0.1
        });
        return;
    }

    const cor = coresAlerta[alerta] || '#808080';

    layer.setStyle({
        color: cor,
        fillColor: cor,
        fillOpacity: 0.25,
        weight: 3
    });

    layer.info.cor = cor;
}


function adicionarIconeAlerta(layer) {
    const tipoAlerta = layer.info.alerta;
    if (!tipoAlerta) return;

    const centro =
        layer.getLatLng?.() ||
        layer.getBounds?.().getCenter();

    if (!centro) return;

    const icon = alertaIcons[tipoAlerta];

    const marker = L.marker(centro, {
        icon: icon,
        interactive: false
    });

    drawnItems.addLayer(marker); 
}

function formatarAlerta(alerta) {
    const textos = {
        mare_baixa_altorisco: 'Maré baixa (alto risco)',
        mare_baixa_baixorisco: 'Maré baixa (baixo risco)',
        autorizacao_pendente: 'Autorização pendente',
        limpeza_programada: 'Limpeza programada'
    };

    return textos[alerta] || alerta;
}


function carregarDesenhosTemporario() {
    fetch(API_URL)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'sucesso' && data.dados.length > 0) {
                data.dados.forEach(desenho => {
                    var layer;
                    var cor = '#808080';

                    if (desenho.tipo === 'circle') {
                        var coords = desenho.geojson.geometry.coordinates;
                        var raio = desenho.geojson.properties?.radius || 100;
                        layer = L.circle([coords[1], coords[0]], {
                            radius: raio,
                            color: cor,
                            fillColor: cor,
                            fillOpacity: 0.1
                        });
                    } else if (desenho.tipo === 'marker') {
                        layer = L.geoJSON(desenho.geojson);
                    } else {
                        layer = L.geoJSON(desenho.geojson, {
                            style: { color: cor, fillColor: cor, fillOpacity: 0.1, weight: 2 }
                        });
                    }

                    layer = (layer instanceof L.FeatureGroup) ? layer.getLayers()[0] : layer;

                    layer.info = { nome: desenho.nome, categoria: desenho.categoria, estado_ocupacao: desenho.estado_ocupacao, cor: cor, tipo_carga: desenho.tipo_carga, estado_barco: desenho.estado_barco, alerta: desenho.alerta, imo: desenho.imo, local: desenho.local, fundeadouro_id: desenho.fundeadouro_id };
                    layer.db_id = desenho.id;

                    // if (desenho.categoria === 'barco') {
                    //     atualizarCorBarco(layer);
                    // } else if (filtroAtual.modo === 'carga' && desenho.categoria === 'terminal') {
                    //     atualizarCorPorCarga(layer);
                    // } else {
                    //     atualizarCorPorEstado(layer);
                    // }

                    atualizarPopup(layer);

                    tempLayers.push(layer);
                });
            }
        });
}

setTimeout(() => {
    map.flyTo([-23.9608, -46.3336], 10, { animate: true, duration: 3 });

    map.once('moveend', function() {
        map.addLayer(drawnItems);
        tempLayers.forEach(layer => drawnItems.addLayer(layer));
        map.addControl(drawControl);
    });
}, 2000);

carregarDesenhosTemporario();

var layerControl = L.control({position: 'bottomleft'});
layerControl.onAdd = function(map) {
    var div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
    div.style.background = 'white';
    div.style.padding = '5px';
    div.style.display = 'flex';
    div.style.flexDirection = 'row';
    div.style.gap = '5px';

    Object.keys(layers).forEach(function(name) {
        var btn = L.DomUtil.create('div', '', div);
        btn.style.width = '25px';
        btn.style.height = '25px';
        btn.style.borderRadius = '50%';
        btn.style.cursor = 'pointer';
        btn.style.background = 'lightgray';
        btn.title = name;

        if(map.hasLayer(layers[name])) btn.style.background = 'dodgerblue';

        btn.onclick = function() {
            Object.values(layers).forEach(l => map.hasLayer(l) && map.removeLayer(l));
            map.addLayer(layers[name]);

            Array.from(div.children).forEach(child => child.style.background = 'lightgray');
            btn.style.background = 'dodgerblue';
        };

        div.appendChild(btn);
    });

    return div;
};
layerControl.addTo(map);

map.on('draw:created', function(e) {
    var type = e.layerType;
    var layer = e.layer;

    var nome = prompt("Digite o nome da região/ponto:", "Sem nome");
    if (nome === null) return;
    // var descricao = prompt("Digite a descrição:", "");
    // if (descricao === null) return;

    var categoria = prompt("Categoria (terminal/fundeadouro/navio):", "");
    if (categoria === null) return;
    while (!['terminal', 'fundeadouro', 'navio'].includes(categoria)) {
        categoria = prompt("Categoria inválida! Escolha 'terminal', 'fundeadouro' ou 'navio':", "");
    }

    if (categoria === 'terminal') {
        var estadosValidos = ['normal','atencao','critico','indisponivel'];
        var estado_ocupacao = prompt("Estado de ocupação (normal/atencao/critico/indisponivel):", "");
        if (estado_ocupacao === null) return;
        while (!estadosValidos.includes(estado_ocupacao)) {
            estado_ocupacao = prompt("Estado inválido! normal, atencao, critico, indisponivel:", "");
        }

        var tipo_carga = null;
        if (categoria === 'terminal') {
            var tiposValidos = [
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
            tipo_carga = prompt("Tipo de carga: Multiproposito, GraneisLiquido_QuimicosCombustiveis, CargaGeral_Conteineres, GraneisLiquido_SucosCitricos, GraneisSolidos_Vegetais, CargaGeral_Celulose, Passageiros, GraneisSolidos_Minerais, CargaGeral_Veiculos", "");
            if (tipo_carga === null) return;
            while (!tiposValidos.includes(tipo_carga)) {
                tipo_carga = prompt("Tipo de carga inválido! Escolha um válido: Multiproposito, GraneisLiquido_QuimicosCombustiveis, CargaGeral_Conteineres, GraneisLiquido_SucosCitricos, GraneisSolidos_Vegetais, CargaGeral_Celulose, Passageiros, GraneisSolidos_Minerais, CargaGeral_Veiculos", "");
            }
        }
    } else if (categoria === 'fundeadouro') {
        var estadosValidos = ['normal','atencao','critico','indisponivel'];
        var estado_ocupacao = prompt("Estado de ocupação (normal/atencao/critico/indisponivel):", "");
        if (estado_ocupacao === null) return;
        while (!estadosValidos.includes(estado_ocupacao)) {
            estado_ocupacao = prompt("Estado inválido! normal, atencao, critico, indisponivel:", "");
        }
    } else {
        var estadoBarcoValidos = ['atracado', 'saida', 'manobra', 'fundeado'];

            estado_barco = prompt("Estado do navio (atracado/saida/manobra/fundeado):", "");
            if (estado_barco === null) return;
            while (!estadoBarcoValidos.includes(estado_barco)) {
                estado_barco = prompt("Estado inválido! Escolha 'atracado', 'saida', 'manobra' ou 'fundeado':", "");
            }
    }
            
    layer.info = { nome, categoria, estado_ocupacao, tipo_carga, cor, estado_barco };
    if (categoria === 'terminal' && tipo_carga) {
        atualizarCorPorCarga(layer);
    } else if (categoria === 'navio') {
        atualizarCorBarco(layer);
    } else {
        atualizarCorPorEstado(layer);
    }
    atualizarPopup(layer);
    drawnItems.addLayer(layer);

    if (layer.setStyle) {
        layer.setStyle({ color: cor, fillColor: cor, fillOpacity: 0.1 });
    } else if (layer instanceof L.Circle) {
        layer.setStyle({ color: cor, fillColor: cor, fillOpacity: 0.1 });
    }

    var geojson = layer.toGeoJSON();
    if (!geojson.properties) geojson.properties = {};

    var desenhoData = {
        nome,
        // descricao,
        tipo: type,
        geojson: geojson,
        cor,
        categoria,
        estado_ocupacao,
        tipo_carga: tipo_carga || "",
        estado_barco,
        alerta: null,
        imo: null,
        local: null,
        fundeadouro_id: null
    };

    guardarDesenho(layer, type, desenhoData);
});

function atualizarPopup(layer) {
    let nome = layer.info?.nome || "Não definido";
    let categoria = layer.info?.categoria || "Sem categoria";
    let estado = layer.info?.estado_ocupacao || "normal";
    let tipo_carga = layer.info?.tipo_carga || "Sem tipo de carga";
    let estado_barco = layer.info?.estado_barco || "Sem estado de barco";
    let alerta = layer.info?.alerta || null;
    let imo = layer.info?.imo || null;
    let local = layer.info?.local || null;
    let fundeadouro_id = layer.info?.fundeadouro_id || null;
    let total_navios = layer.info?.total_navios ?? 0;
    let resumo_navios = layer.info?.resumo_navios || {};

    /* ---------- ALERTA ---------- */
    let alertaHTML = '';
    if (filtroAtual.modo === 'alerta' && categoria === 'terminal' && alerta) {
        alertaHTML = `
            <div class="popup-alerta">
                <strong>Alerta:</strong> ${formatarAlerta(alerta)}
            </div>
        `;
    }

    /* ---------- BOTÕES ---------- */
    let mostrarBotoes = true;

    if (filtroAtual.categoria === 'fundeadouro' && categoria === 'navio' && fundeadouro_id) {
        mostrarBotoes = false;
    }
    if (filtroAtual.modo === 'alerta' && categoria === 'terminal' && alerta) {
        mostrarBotoes = false;
    }
    if (filtroAtual.categoria === 'todos') {
        mostrarBotoes = false;
    }

    let botoesHTML = mostrarBotoes
        ? `
            <div class="popup-botoes">
                <button class="popup-btn popup-btn-editar"
                    onclick="editarInfo('${layer._leaflet_id}')">Editar</button>
                <button class="popup-btn popup-btn-apagar"
                    onclick="apagarDesenho('${layer._leaflet_id}')">Apagar</button>
            </div>
        `
        : `
            <div class="popup-info">
                Ações desativadas
            </div>
        `;

    /* ---------- CONTEÚDO BASE ---------- */
    let conteudo = `
        <div class="popup-container">
            <div class="popup-titulo">${nome}</div>
            <div class="popup-categoria">Categoria: ${categoria}</div>
    `;

    /* ---------- FUNDEADOURO ---------- */
    if (categoria === 'fundeadouro') {

        const listaResumo = Object.entries(resumo_navios)
            .filter(([_, qtd]) => qtd > 0)
            .map(([estadoNavio, qtd]) => `
                <li style="color:${coresNavioFundeado[estadoNavio]}">
                    ${qtd} ${estadoNavio.replace('_', ' ')}
                </li>
            `)
            .join('');

        conteudo += `
            <div class="popup-estado">Estado: ${estado}</div>

            ${
                filtroAtual.categoria !== 'todos'
                    ? `<div class="popup-info">
                        Navios fundeados: <strong> 🛥️ ${total_navios}</strong>
                       </div>`
                    : ''
            }

            ${
                listaResumo && filtroAtual.categoria !== 'todos'
                    ? `<ul class="popup-lista-navios">${listaResumo}</ul>`
                    : ''
            }
        `;
    }

    /* ---------- TERMINAL ---------- */
    else if (categoria === 'terminal') {
        conteudo += `
            <div class="popup-estado">Estado: ${estado}</div>
            <div class="popup-tipo-carga">Tipo de carga: ${tipo_carga}</div>
        `;
    }

    /* ---------- NAVIO ---------- */
    else if (categoria === 'navio') {
        conteudo += `
            <div class="popup-estado">Estado: ${estado_barco}</div>
            <div class="popup-imo">IMO: ${imo}</div>
            <div class="popup-local">Local: ${local}</div>
        `;

        // Só mostrar fundeadouro se NÃO estivermos na aba "navios"
        if (fundeadouro_id !== null && filtroAtual.categoria !== 'navio') {
            const estadoFundeado = layer.info?.estado_navio_fundeado || 'pendente';

            conteudo += `
                <div class="popup-fundeadouro">
                    Fundeadouro ID: ${fundeadouro_id}
                </div>

                <div class="popup-info">
                    Estado no fundeadouro:
                    <strong style="color:${coresNavioFundeado[estadoFundeado]}">
                        ${estadoFundeado.replace('_', ' ')}
                    </strong>
                </div>
            `;
        } else if (fundeadouro_id !== null) {
            // Só mostrar o Fundeadouro ID sem o estado
            conteudo += `
                <div class="popup-fundeadouro">
                    Fundeadouro ID: ${fundeadouro_id}
                </div>
            `;
        }
    }

    /* ---------- FECHO ---------- */
    conteudo += `
        ${alertaHTML}
        ${botoesHTML}
        </div>
    `;

    layer.bindPopup(conteudo);
}






map.on('draw:edited', function(e) {
    e.layers.eachLayer(function(layer) {
        atualizarDesenho(layer);
        atualizarPopup(layer);
    });
});

drawnItems.on('click', function(e){
    atualizarPopup(e.layer);
});



function editarInfo(id) {
    var layer = drawnItems.getLayer(id);
    if (!layer) return;

    const novoNome = prompt("Atualize o nome:", layer.info.nome);
    if (novoNome !== null) { 
        layer.info.nome = novoNome;
    } else {
        layer.closePopup();
        return; 
    }

    if (layer.info.categoria === 'fundeadouro') {
        const estadosValidos = ['normal', 'atencao', 'critico', 'indisponivel'];
        let novoEstado = prompt(
            "Atualize o estado de ocupação (normal/atencao/critico/indisponivel):",
            layer.info.estado_ocupacao || 'normal'
        );
        if (novoEstado === null) { layer.closePopup(); return; } 

        while (!estadosValidos.includes(novoEstado)) {
            novoEstado = prompt(
                `Estado inválido! Escolha um válido: ${estadosValidos.join(', ')}`,
                layer.info.estado_ocupacao || 'normal'
            );
            if (novoEstado === null) { layer.closePopup(); return; } 
        }
        layer.info.estado_ocupacao = novoEstado;

    } else if (layer.info.categoria === 'terminal') {
        const estadosValidos = ['normal', 'atencao', 'critico', 'indisponivel'];
        let novoEstado = prompt(
            "Atualize o estado de ocupação (normal/atencao/critico/indisponivel):",
            layer.info.estado_ocupacao || 'normal'
        );
        if (novoEstado === null) { layer.closePopup(); return; } 

        while (!estadosValidos.includes(novoEstado)) {
            novoEstado = prompt(
                `Estado inválido! Escolha um válido: ${estadosValidos.join(', ')}`,
                layer.info.estado_ocupacao || 'normal'
            );
            if (novoEstado === null) { layer.closePopup(); return; } 
        }
        layer.info.estado_ocupacao = novoEstado;

        const tiposValidos = [
            'Multiproposito', 'GraneisLiquido_QuimicosCombustiveis', 'CargaGeral_Conteineres',
            'GraneisLiquido_SucosCitricos', 'GraneisSolidos_Vegetais', 'CargaGeral_Celulose',
            'Passageiros', 'GraneisSolidos_Minerais', 'CargaGeral_Veiculos'
        ];
        let novoTipoCarga = prompt(
            "Atualize o tipo de carga:",
            layer.info.tipo_carga || ''
        );
        if (novoTipoCarga === null) { layer.closePopup(); return; } 

        while (!tiposValidos.includes(novoTipoCarga)) {
            novoTipoCarga = prompt(
                `Tipo de carga inválido! Escolha um válido: ${tiposValidos.join(', ')}`,
                layer.info.tipo_carga || ''
            );
            if (novoTipoCarga === null) { layer.closePopup(); return; } 
        }
        layer.info.tipo_carga = novoTipoCarga;

    } else if (layer.info.categoria === 'navio') {
        const estadoBarcoValidos = ['atracado', 'saida', 'manobra', 'fundeado'];
        let novoEstadoBarco = prompt(
            "Atualize o estado do navio (atracado/saida/manobra/fundeado):",
            layer.info.estado_barco || ''
        );
        if (novoEstadoBarco === null) { layer.closePopup(); return; } 

        while (!estadoBarcoValidos.includes(novoEstadoBarco)) {
            novoEstadoBarco = prompt(
                `Estado inválido! Escolha um válido: ${estadoBarcoValidos.join(', ')}`,
                layer.info.estado_barco || ''
            );
            if (novoEstadoBarco === null) { layer.closePopup(); return; } 
        }
        layer.info.estado_barco = novoEstadoBarco;
    }

    if (filtroAtual.categoria === 'terminal' && filtroAtual.modo === 'carga') {
        atualizarCorPorCarga(layer);
    } else if (filtroAtual.categoria === 'navio') {
        atualizarCorBarco(layer);
    } else if (filtroAtual.categoria === 'terminal' && filtroAtual.modo === 'alerta') {
        atualizarCorAlerta(layer);
    } else {
        atualizarCorPorEstado(layer);
    }

    atualizarPopup(layer);
    layer.openPopup();
    atualizarDesenho(layer);
}

function obterTerminaisPorAlerta() {
    const mapa = {};

    drawnItems.eachLayer(layer => {
        if (
            layer.info?.categoria === 'terminal' &&
            layer.info.alerta
        ) {
            if (!mapa[layer.info.alerta]) {
                mapa[layer.info.alerta] = [];
            }
            mapa[layer.info.alerta].push({
                nome: layer.info.nome,
                layer
            });
        }
    });

    return mapa;
}

function carregarTerminaisParaAlertas() {
    fetch(API_URL + '/categoria/terminal')
        .then(res => res.json())
        .then(data => {
            if (data.status !== 'sucesso') return;

            let bounds = L.latLngBounds();

            data.dados.forEach(desenho => {
                let layer;

                let geojsonObj = typeof desenho.geojson === 'string'
                    ? JSON.parse(desenho.geojson)
                    : desenho.geojson;

                if (desenho.tipo === 'circle') {
                    const coords = geojsonObj.geometry.coordinates;
                    const raio = geojsonObj.properties?.radius || 100;
                    layer = L.circle([coords[1], coords[0]], { radius: raio });
                } else {
                    layer = L.geoJSON(geojsonObj);
                }

                layer = (layer instanceof L.FeatureGroup)
                    ? layer.getLayers()[0]
                    : layer;

                layer.info = {
                    nome: desenho.nome,
                    categoria: desenho.categoria,
                    estado_ocupacao: desenho.estado_ocupacao,
                    tipo_carga: desenho.tipo_carga,
                    alerta: desenho.alerta || null
                };

                layer.db_id = desenho.id;

                atualizarCorAlerta(layer);
                adicionarIconeAlerta(layer);

                atualizarPopup(layer);
                drawnItems.addLayer(layer);

                if (layer.getBounds) bounds.extend(layer.getBounds());
                else if (layer.getLatLng) bounds.extend(layer.getLatLng());
            });

            if (bounds.isValid()) map.fitBounds(bounds);

            atualizarLegenda();
        });
}

function carregarFundeadourosComNavios() {
    drawnItems.clearLayers();

    fetch(API_URL + '/fundeadouros-navios')
        .then(res => res.json())
        .then(data => {
            if (data.status !== 'sucesso') return;

            let bounds = L.latLngBounds();

            data.dados.forEach(fund => {
                let fundLayer;

                // Criar layer do fundeadouro
                if (fund.tipo === 'circle') {
                    const coords = fund.geojson.geometry.coordinates;
                    const raio = fund.geojson.properties?.radius || 100;
                    fundLayer = L.circle([coords[1], coords[0]], { radius: raio });
                } else {
                    fundLayer = L.geoJSON(fund.geojson);
                }

                fundLayer = (fundLayer instanceof L.FeatureGroup) ? fundLayer.getLayers()[0] : fundLayer;

                // Inicializar resumo de navios fundeados
                const resumo = {
                    bloqueio: 0,
                    chegada_iminente: 0,
                    pendente: 0
                };

                // Contar estados de navios fundeados
                fund.navios.forEach(navio => {
                    if (resumo[navio.estado_navio_fundeado] !== undefined) {
                        resumo[navio.estado_navio_fundeado]++;
                    }
                });

                // Info do fundeadouro
                fundLayer.info = {
                    nome: fund.nome,
                    categoria: 'fundeadouro',
                    estado_ocupacao: fund.estado_ocupacao,
                    total_navios: fund.navios.length,
                    resumo_navios: resumo
                };

                fundLayer.db_id = fund.id;

                atualizarCorPorEstado(fundLayer);
                atualizarPopup(fundLayer);
                drawnItems.addLayer(fundLayer);

                if (fundLayer.getBounds) bounds.extend(fundLayer.getBounds());
                else if (fundLayer.getLatLng) bounds.extend(fundLayer.getLatLng());

                // Criar layers para navios fundeados
                fund.navios.forEach(navio => {
                    let navioLayer;

                    const geojsonOptions = {
                        style: {
                            color: '#4bcafc',
                            fillColor: '#4bcafc',
                            fillOpacity: 0.4,
                            weight: 2
                        },
                        interactive: true
                    };

                    if (navio.tipo === 'circle') {
                        const coords = navio.geojson.geometry.coordinates;
                        const raio = navio.geojson.properties?.radius || 50;
                        navioLayer = L.circle([coords[1], coords[0]], { radius: raio });
                    } else {
                        navioLayer = L.geoJSON(navio.geojson, geojsonOptions);
                    }

                    navioLayer = (navioLayer instanceof L.FeatureGroup) ? navioLayer.getLayers()[0] : navioLayer;

                    navioLayer.info = {
                        nome: navio.nome,
                        categoria: 'navio',
                        estado_barco: 'fundeado',
                        fundeadouro_id: fund.id,
                        imo: navio.imo,
                        local: navio.local,
                        estado_navio_fundeado: navio.estado_navio_fundeado
                    };

                    atualizarPopup(navioLayer);
                    drawnItems.addLayer(navioLayer);

                    if (navioLayer.getBounds) bounds.extend(navioLayer.getBounds());
                    else if (navioLayer.getLatLng) bounds.extend(navioLayer.getLatLng());
                });
            });

            if (bounds.isValid()) map.fitBounds(bounds);
        })
        .catch(err => console.error('❌ Erro ao carregar fundeadouros com navios:', err));
}




function apagarDesenho(id) {
          var layer = drawnItems.getLayer(id);
          if(!layer){
            alert('Desenho não encontrado');
            return;
          }

          if(!layer.db_id){
            alert('Desenho não tem ID no base de dados');
            return;
          }

          if(confirm('Tem certeza que deseja apagar este desenho?')){
            fetch(API_URL + '/' + layer.db_id, {
              method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
              if(data.status === 'sucesso'){
                drawnItems.removeLayer(layer);
                console.log('✅ Desenho apagado com sucesso');
              } else {
                alert('❌ Erro ao apagar: ' + data.mensagem);
              }
            })
            .catch(error => {
              console.error('❌ Erro:', error);
              alert('Erro ao conectar à API');
            });
          }
}

function guardarDesenho(layer, tipo) {
    var geojson = layer.toGeoJSON();

    if (tipo === 'circle' && layer.getRadius) {
        geojson.properties = geojson.properties || {};
        geojson.properties.radius = layer.getRadius();
    }

    var payload = {
        nome: layer.info.nome || "Sem nome",
        // descricao: layer.info.descricao || "",
        tipo: tipo,
        geojson: geojson,
        cor: layer.info.cor || "#808080",
        categoria: layer.info.categoria || "terminal",
        estado_ocupacao: layer.info.estado_ocupacao || "normal",
        tipo_carga: layer.info.tipo_carga || null,
        estado_barco: layer.info.estado_barco || null
    };

    fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'sucesso') {
            layer.db_id = data.id;
            console.log('✅ Desenho guardado com ID:', data.id);
        } else {
            alert('❌ Erro ao guardar: ' + data.mensagem);
        }
    })
    .catch(error => {
        console.error('❌ Erro na requisição:', error);
        alert('Erro ao conectar à API. Verifique se o servidor está ligado!');
    });

    // carregarDesenhos();
    carregarPorFiltroAtual();
}

function atualizarDesenho(layer) {
          if (!layer.db_id) {
            alert('Desenho não tem ID na base de dados');
            return;
          }

          var geojson = layer.toGeoJSON();

          if (layer.getRadius) {
            geojson.properties = geojson.properties || {};
            geojson.properties.radius = layer.getRadius();
          }

          let corParaSalvar = '#808080';
            if (filtroAtual.categoria !== 'todos') {
                corParaSalvar = layer.info.cor || '#808080';
            }

          fetch(API_URL + '/' + layer.db_id, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              nome: layer.info.nome,
            //   descricao: layer.info.descricao,
              geojson: geojson,
              cor: corParaSalvar,
              estado_ocupacao: layer.info.estado_ocupacao,
              tipo_carga: layer.info.tipo_carga,
              estado_barco: layer.info.estado_barco
            })
          })
          .then(response => response.json())
          .then(data => {
            if (data.status === 'sucesso') {
              console.log('✅ Desenho atualizado com sucesso');
            } else {
              alert('❌ Erro ao atualizar: ' + data.mensagem);
            }
          })
          .catch(error => console.error('❌ Erro:', error));
}

function carregarDesenhos() {
    let bounds = L.latLngBounds();

    fetch(API_URL)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'sucesso' && data.dados.length > 0) {
                console.log('📍 A carregar ' + data.dados.length + ' desenho(s)...');

                data.dados.forEach(desenho => {
                    let layer;
                    if (desenho.categoria === 'navio') {
                        cor = coresBarcos[desenho.estado_barco] || '#808080';
                    } else if (desenho.categoria === 'terminal') {
                        if (filtroAtual.modo === 'carga') {
                            cor = coresTipoCarga[desenho.tipo_carga] || '#808080';
                        } else {
                            cor = coresEstado[desenho.estado_ocupacao] || '#808080';
                        }
                    } else { 
                        cor = coresEstado[desenho.estado_ocupacao] || '#808080';
                    }

                    if (desenho.tipo === 'circle') {
                        const coords = desenho.geojson.geometry.coordinates;
                        const raio = desenho.geojson.properties?.radius || 100;
                        layer = L.circle([coords[1], coords[0]], {
                            radius: raio,
                            color: cor,
                            fillColor: cor,
                            fillOpacity: 0.1
                        });
                    } else if (desenho.tipo === 'marker') {
                        layer = L.geoJSON(desenho.geojson);
                        layer = layer.getLayers()[0]; 
                    } else {
                        layer = L.geoJSON(desenho.geojson, {
                            style: {
                                color: cor,
                                fillColor: cor,
                                fillOpacity: 0.1,
                                weight: 2
                            }
                        });
                        layer = layer.getLayers()[0] || layer; 
                    }

                    if (!layer) return; 

                    layer.info = {
                        nome: desenho.nome,
                        categoria: desenho.categoria,
                        estado_ocupacao: desenho.estado_ocupacao,
                        cor: cor,
                        tipo_carga: desenho.tipo_carga,
                        estado_barco: desenho.estado_barco,
                        alerta: desenho.alerta || null,
                        imo: desenho.imo || null,
                        local: desenho.local || null,
                        fundeadouro_id: desenho.fundeadouro_id || null
                    };
                    layer.db_id = desenho.id;

                    if (desenho.categoria === 'navio') {
                        atualizarCorBarco(layer);
                    } else if (desenho.categoria === 'terminal' && filtroAtual.modo === 'carga') {
                        atualizarCorPorCarga(layer);
                    } else {
                        atualizarCorPorEstado(layer);
                    }

                    atualizarPopup(layer);

                    drawnItems.addLayer(layer);

                    if (layer instanceof L.Circle) {
                        bounds.extend(layer.getLatLng());
                    } else if (layer.getBounds) {
                        bounds.extend(layer.getBounds());
                    } else if (layer.getLatLng) {
                        bounds.extend(layer.getLatLng());
                    }
                });

                if (bounds.isValid()) map.fitBounds(bounds);
            } else {
                console.log('📍 Nenhum desenho encontrado');
            }
        })
        .catch(error => {
            console.error('❌ Erro ao carregar desenhos:', error);
            alert('Erro ao conectar à API. Verifique se o servidor está ligado!');
        });
}



carregarDesenhos();

function carregarDesenhosTodos() {
    let bounds = L.latLngBounds();

    fetch(API_URL)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'sucesso' && data.dados.length > 0) {
                console.log('📍 A carregar ' + data.dados.length + ' desenho(s)...');

                data.dados.forEach(desenho => {
                    let layer;
                    const cor = '#808080';

                    if (desenho.tipo === 'circle') {
                        const coords = desenho.geojson.geometry.coordinates;
                        const raio = desenho.geojson.properties?.radius || 100;
                        layer = L.circle([coords[1], coords[0]], {
                            radius: raio,
                            color: '#808080',
                            fillColor: '#808080',
                            fillOpacity: 0.1
                        });
                    } else if (desenho.tipo === 'marker') {
                        layer = L.geoJSON(desenho.geojson);
                        layer = layer.getLayers()[0]; 
                    } else {
                        layer = L.geoJSON(desenho.geojson, {
                            style: {
                                color: '#808080',
                                fillColor: '#808080',
                                fillOpacity: 0.1,
                                weight: 2
                            }
                        });
                        layer = layer.getLayers()[0] || layer; 
                    }

                    if (!layer) return; 

                    layer.info = {
                        nome: desenho.nome,
                        categoria: desenho.categoria,
                        estado_ocupacao: desenho.estado_ocupacao,
                        cor: '#808080',
                        tipo_carga: desenho.tipo_carga,
                        estado_barco: desenho.estado_barco,
                        alerta: desenho.alerta || null,
                        imo: desenho.imo || null,
                        local: desenho.local || null,
                        fundeadouro_id: desenho.fundeadouro_id || null
                    };
                    layer.db_id = desenho.id;

                    //atualizarCorPorEstado(layer);
                    atualizarPopup(layer);

                    drawnItems.addLayer(layer);

                    if (layer instanceof L.Circle) {
                        bounds.extend(layer.getLatLng());
                    } else if (layer.getBounds) {
                        bounds.extend(layer.getBounds());
                    } else if (layer.getLatLng) {
                        bounds.extend(layer.getLatLng());
                    }
                });

                if (bounds.isValid()) map.fitBounds(bounds);
            } else {
                console.log('📍 Nenhum desenho encontrado');
            }
        })
        .catch(error => {
            console.error('❌ Erro ao carregar desenhos:', error);
            alert('Erro ao conectar à API. Verifique se o servidor está ligado!');
        });
}

carregarDesenhosTodos();

function carregarPorFiltroAtual() {
    drawnItems.clearLayers();

    if (filtroAtual.modo === 'alerta'){
        carregarTerminaisParaAlertas();
        return;
    }

    if (filtroAtual.categoria === 'todos') {
        carregarDesenhosTodos();
        atualizarLegenda();
        return;
    }

    if (filtroAtual.categoria === 'fundeadouro') {
        carregarFundeadourosComNavios();
        atualizarLegenda();
        return;
    }

    fetch(API_URL + '/categoria/' + filtroAtual.categoria)
        .then(res => res.json())
        .then(data => {
            if (data.status !== 'sucesso') return;

            let bounds = L.latLngBounds();

            data.dados.forEach(desenho => {
                let layer;

                let geojsonObj = typeof desenho.geojson === 'string'
                    ? JSON.parse(desenho.geojson)
                    : desenho.geojson;

                if (desenho.tipo === 'circle') {
                    const coords = geojsonObj.geometry.coordinates;
                    const raio = geojsonObj.properties?.radius || 100;
                    layer = L.circle([coords[1], coords[0]], { radius: raio });
                } else {
                    layer = L.geoJSON(geojsonObj);
                }

                layer = (layer instanceof L.FeatureGroup) ? layer.getLayers()[0] : layer;

                layer.info = {
                    nome: desenho.nome,
                    // descricao: desenho.descricao,
                    categoria: desenho.categoria,
                    estado_ocupacao: desenho.estado_ocupacao,
                    tipo_carga: desenho.tipo_carga,
                    estado_barco: desenho.estado_barco,
                    alerta: desenho.alerta || null,
                    imo: desenho.imo || null,
                    local: desenho.local || null,
                    fundeadouro_id: desenho.fundeadouro_id || null
                };

                layer.db_id = desenho.id;

                if (filtroAtual.modo === 'alerta' && desenho.categoria === 'terminal') {
                    atualizarCorAlerta(layer);
                    adicionarIconeAlerta(layer);

                } else if (filtroAtual.categoria === 'terminal' && filtroAtual.modo === 'carga') {
                    atualizarCorPorCarga(layer);

                } else if (filtroAtual.categoria === 'navio') {
                    atualizarCorBarco(layer);

                } else {
                    atualizarCorPorEstado(layer);
                }


                atualizarPopup(layer);
                drawnItems.addLayer(layer);

                if (layer.getBounds) bounds.extend(layer.getBounds());
                else if (layer.getLatLng) bounds.extend(layer.getLatLng());
            });

            if (bounds.isValid()) map.fitBounds(bounds);
        });

        atualizarLegenda();

}

function atualizarLegenda() {
    const titulo = document.getElementById('legenda-titulo');
    const lista = document.getElementById('legenda-itens');
    lista.innerHTML = '';
    lista.classList.remove('legenda-alertas');

    if (filtroAtual.categoria === 'fundeadouro' || filtroAtual.modo === 'estado') {
        titulo.textContent = "Estado de Ocupação";

        Object.entries(coresEstado).forEach(([estado, cor]) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="legenda-alerta">
                    <div class="legenda-cor" style="background-color: ${cor}"></div>
                    ${estado}
                </div>
            `;
            li.onmouseenter = () => highlightEstado(estado);
            li.onmouseleave = () => resetHighlightEstado();
            lista.appendChild(li);
        });

    } else if (filtroAtual.categoria === 'terminal' && filtroAtual.modo === 'carga') {
        titulo.textContent = "Carga Portuária";

        Object.entries(coresTipoCarga).forEach(([tipo, cor]) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="legenda-alerta">
                    <div class="legenda-cor" style="background-color: ${cor}"></div>
                    ${tipo.replace(/_/g,' ').replace(/\//g,' / ')}
                </div>
            `;
            li.onmouseenter = () => highlightCarga(tipo);
            li.onmouseleave = () => resetHighlightCarga();
            lista.appendChild(li);
        });

    } else if (filtroAtual.categoria === 'navio') {
        titulo.textContent = "Estado do Navio";

        Object.entries(coresBarcos).forEach(([estado, cor]) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="legenda-alerta">
                    <div class="legenda-cor" style="background-color: ${cor}"></div>
                    ${estado}
                </div>
            `;
            li.onmouseenter = () => highlightBarco(estado);
            li.onmouseleave = () => resetHighlightBarco();
            lista.appendChild(li);
        });

    } else if (filtroAtual.modo === 'alerta') {
        titulo.textContent = "Alertas";
        lista.classList.add('legenda-alertas');

        const terminaisPorAlerta = obterTerminaisPorAlerta();

        Object.entries(coresAlerta).forEach(([alerta, cor]) => {
            if (!terminaisPorAlerta[alerta]) return;

            const li = document.createElement('li');
            li.innerHTML = `
                <div class="legenda-alerta">
                    <div class="legenda-cor" style="background-color:${cor}"></div>
                    <strong>${formatarAlerta(alerta)}</strong>
                </div>
                <ul class="legenda-sublista">
                    ${terminaisPorAlerta[alerta].map(t => `<li>${t.nome}</li>`).join('')}
                </ul>
            `;
            li.onmouseenter = () => highlightAlerta(alerta);
            li.onmouseleave = resetHighlightAlerta;
            lista.appendChild(li);
        });
    } else {
        titulo.textContent = "";
    }
}

function highlightAlerta(alertaSelecionado) {
    drawnItems.eachLayer(layer => {
        if (!layer.info || layer.info.categoria !== 'terminal') return;

        if (layer.info.alerta === alertaSelecionado) {
            layer.setStyle?.({
                weight: 5,
                fillOpacity: 0.5
            });

            layer.bringToFront?.();
        } else {
            layer.setStyle?.({
                opacity: 0.2,
                fillOpacity: 0.05
            });
        }
    });
}

function resetHighlightAlerta() {
    drawnItems.eachLayer(layer => {
        if (!layer.info || layer.info.categoria !== 'terminal') return;
        if (!layer.setStyle) return;

        layer.setStyle({
            opacity: 1,
            fillOpacity: filtroAtual.modo === 'alerta' ? 0.25 : 0.1,
            weight: 3
        });

        if (filtroAtual.modo === 'alerta') {
            atualizarCorAlerta(layer);

        } else if (filtroAtual.categoria === 'terminal' && filtroAtual.modo === 'carga') {
            atualizarCorPorCarga(layer);

        } else if (filtroAtual.categoria === 'navio') {
            atualizarCorBarco(layer);

        } else {
            atualizarCorPorEstado(layer);
        }
    });
}

function highlightEstado(estadoSelecionado) {

    if (filtroAtual.categoria === 'todos') return;

    drawnItems.eachLayer(layer => {
        if (!layer.info) return;

        if (layer.info.categoria !== 'terminal' && layer.info.categoria !== 'fundeadouro') return;

        if (layer.info.estado_ocupacao === estadoSelecionado) {
            layer.setStyle?.({
                weight: 5,
                fillOpacity: 0.5
            });
            layer.bringToFront?.();
        } else {
            layer.setStyle?.({
                opacity: 0.2,
                fillOpacity: 0.05
            });
        }
    });
}

function resetHighlightEstado() {
    drawnItems.eachLayer(layer => {
        if (!layer.info) return;
        if (!layer.setStyle) return;

        layer.setStyle({
            opacity: 1,
            fillOpacity: filtroAtual.modo === 'estado' ? 0.25 : 0.1,
            weight: 3
        });

        if (filtroAtual.categoria === 'fundeadouro' && layer.info.categoria === 'navio') {
        return;
        }

        if (filtroAtual.modo === 'alerta') {
            atualizarCorAlerta(layer);
        } else if (filtroAtual.categoria === 'terminal' && filtroAtual.modo === 'carga') {
            atualizarCorPorCarga(layer);
        } else if (filtroAtual.categoria === 'navio') {
            atualizarCorBarco(layer);
        } else {
            atualizarCorPorEstado(layer);
        }
    });
}

function highlightCarga(tipoCargaSelecionado) {
    drawnItems.eachLayer(layer => {
        if (!layer.info) return;
        if (layer.info.categoria !== 'terminal') return;

        if (layer.info.tipo_carga === tipoCargaSelecionado) {
            layer.setStyle?.({
                weight: 5,
                fillOpacity: 0.5
            });
            layer.bringToFront?.();
        } else {
            layer.setStyle?.({
                opacity: 0.2,
                fillOpacity: 0.05
            });
        }
    });
}

function resetHighlightCarga() {
    drawnItems.eachLayer(layer => {
        if (!layer.info) return;
        if (!layer.setStyle) return;

        layer.setStyle({
            opacity: 1,
            fillOpacity: filtroAtual.modo === 'carga' ? 0.25 : 0.1,
            weight: 3
        });

        if (filtroAtual.modo === 'alerta') {
            atualizarCorAlerta(layer);
        } else if (filtroAtual.categoria === 'terminal' && filtroAtual.modo === 'carga') {
            atualizarCorPorCarga(layer);
        } else if (filtroAtual.categoria === 'navio') {
            atualizarCorBarco(layer);
        } else {
            atualizarCorPorEstado(layer);
        }
    });
}

function highlightBarco(estadoSelecionado) {

    if (filtroAtual.categoria === 'fundeadouro') return;

    drawnItems.eachLayer(layer => {
        if (!layer.info || layer.info.categoria !== 'navio') return;

        if (layer.info.estado_barco === estadoSelecionado) {
            layer.setStyle?.({
                weight: 5,
                fillOpacity: 0.5
            });
            layer.bringToFront?.();
        } else {
            layer.setStyle?.({
                opacity: 0.2,
                fillOpacity: 0.05
            });
        }
    });
}

function resetHighlightBarco() {

    if (filtroAtual.categoria === 'fundeadouro') return;

    drawnItems.eachLayer(layer => {
        if (!layer.info || layer.info.categoria !== 'navio') return;
        if (!layer.setStyle) return;

        layer.setStyle({
            opacity: 1,
            fillOpacity: 0.1,
            weight: 3
        });

        atualizarCorBarco(layer);
    });
}





function setActiveButton(clickedBtn) {
    document.querySelectorAll('#barra-categorias button').forEach(btn => btn.classList.remove('active'));
    clickedBtn.classList.add('active');
}

const btnTodos = document.getElementById('btnTodos');
const btnFundeadores = document.getElementById('btnFundeadores');
const btnTerminais = document.getElementById('btnTerminais');
const btnTerminaisCarga = document.getElementById('btnTerminaisCarga');
const btnBarcos = document.getElementById('btnBarcos');

btnTodos.onclick = () => {
    filtroAtual = { categoria: 'todos' };
    carregarPorFiltroAtual();
    setActiveButton(btnTodos);
    // atualizarLegenda();
};

btnFundeadores.onclick = () => {
    filtroAtual = { categoria: 'fundeadouro', modo: 'estado' };
    carregarPorFiltroAtual();
    setActiveButton(btnFundeadores);
    // atualizarLegenda();
};

btnTerminais.onclick = () => {
    filtroAtual = { categoria: 'terminal', modo: 'estado' };
    carregarPorFiltroAtual();
    setActiveButton(btnTerminais);
    // atualizarLegenda();
};

btnTerminaisCarga.onclick = () => {
    filtroAtual = { categoria: 'terminal', modo: 'carga' };
    carregarPorFiltroAtual();
    setActiveButton(btnTerminaisCarga);
    // atualizarLegenda();
};

btnBarcos.onclick = () => {
    filtroAtual = { categoria: 'navio'};
    carregarPorFiltroAtual();
    setActiveButton(btnBarcos);
    // atualizarLegenda();
}

btnAlertas.onclick = () => {
    filtroAtual = { categoria: 'terminal', modo: 'alerta' };
    carregarPorFiltroAtual();
    setActiveButton(btnAlertas);
    // atualizarLegenda();
}

// atualizarLegenda();


// function carregarCores() {
//             fetch(API_URL + '/cores')
//                 .then(res => res.json())
//                 .then(data => {
//                     if (data.status !== 'sucesso') return;

//                     const container = document.getElementById('lista-cores');
//                     container.innerHTML = '';

//                     data.dados.forEach(cor => {
//                         const item = document.createElement('div');
//                         item.className = 'filtro-item';

//                         item.innerHTML = `
//                             <input type="checkbox" value="${cor}" id="cor-${cor.replace('#','')}">
//                             <label for="cor-${cor.replace('#','')}">
//                                 <span style="
//                                     display:inline-block;
//                                     width:14px;
//                                     height:14px;
//                                     background:${cor};
//                                     border:1px solid #000;
//                                     margin-right:6px;
//                                 "></span>
//                                 ${cor}
//                             </label>
//                         `;

//                         container.appendChild(item);
//                     });
//                 })
//                 .catch(err => console.error('Erro ao carregar cores:', err));
// }

// carregarCores();


// document.getElementById('btnFiltrar').addEventListener('click', function() {
//           var tiposSelecionados = [];

//           if (document.getElementById('check-polygon').checked) tiposSelecionados.push('polygon');
//           if (document.getElementById('check-polyline').checked) tiposSelecionados.push('polyline');
//           if (document.getElementById('check-rectangle').checked) tiposSelecionados.push('rectangle');
//           if (document.getElementById('check-circle').checked) tiposSelecionados.push('circle');
//           //if (document.getElementById('check-marker').checked) tiposSelecionados.push('marker');

//           if (tiposSelecionados.length === 0) {
//             alert('Seleciona pelo menos um tipo!');
//             return;
//           }

//           drawnItems.clearLayers();

//           var queryString = 'tipo=' + tiposSelecionados.join(',');
//           fetch(API_URL + '/filtro?' + queryString)
//             .then(response => response.json())
//             .then(data => {
//               if (data.status === 'sucesso' && data.dados.length > 0) {
//                 console.log('✅ A carregar ' + data.dados.length + ' desenho(s) filtrado(s)...');
//                 data.dados.forEach(desenho => {
//                   var layer;
//                   var cor = coresEstado[desenho.estado_ocupacao] || '#808080';



//                   if (desenho.tipo === 'circle') {
//                         var coords = desenho.geojson.geometry.coordinates;
//                         var raio = desenho.geojson.properties?.radius || 100;
//                         layer = L.circle([coords[1], coords[0]], {
//                             radius: raio,
//                             color: cor,
//                             fillColor: cor,
//                             fillOpacity: 0.1
//                         });
//                     } else if (desenho.tipo === 'marker') {
//                         layer = L.geoJSON(desenho.geojson);
//                     } else {
//                         layer = L.geoJSON(desenho.geojson, {
//                             style: { color: cor, fillColor: cor, fillOpacity: 0.1, weight: 2 }
//                         });
//                     }

//                   layer = (layer instanceof L.FeatureGroup) ? layer.getLayers()[0] : layer;

//                   layer.info = {
//                     nome: desenho.nome,
//                     estado_ocupacao: desenho.estado_ocupacao,
//                     categoria: desenho.categoria,
//                     cor: cor,
//                     tipo_carga: desenho.tipo_carga
//                   };
//                   layer.db_id = desenho.id;
//                   atualizarCorPorEstado(layer);
//                   atualizarPopup(layer);
//                   drawnItems.addLayer(layer);
//                 });
//               } else {
//                 console.log('📍 Nenhum desenho encontrado com esses filtros');
//               }
//             })
//             .catch(error => {
//               console.error('❌ Erro ao filtrar:', error);
//               alert('Erro ao conectar à API');
//             });

//           console.log('✅ Filtrado para tipos: ' + tiposSelecionados.join(', '));
// });

// document.getElementById('btnToggleFiltro').addEventListener('click', function () {
//         const conteudo = document.getElementById('filtro-conteudo');

//         if (conteudo.classList.contains('fechado')) {
//             conteudo.classList.remove('fechado');
//             conteudo.classList.add('aberto');
//             this.innerHTML = '🔼 Filtros';
//         } else {
//             conteudo.classList.remove('aberto');
//             conteudo.classList.add('fechado');
//             this.innerHTML = '🔽 Filtros';
//         }
// });


// document.getElementById('btnFiltrarCategoria').addEventListener('click', function () {
//             const categoria = document.querySelector('input[name="categoria"]:checked')?.value;

//             drawnItems.clearLayers();

//             if (!categoria || categoria === 'todos') {
//                 carregarDesenhos();
//                 return;
//             }
//             fetch(API_URL + '/categoria/' + categoria)
//                 .then(res => res.json())
//                 .then(data => {
//                     if (data.status === 'sucesso') {
//                         data.dados.forEach(desenho => {
//                             let layer;
//                             var cor = coresEstado[desenho.estado_ocupacao] || '#808080';;

//                             let geojsonObj;
//                             try {
//                                 geojsonObj = typeof desenho.geojson === 'string'
//                                     ? JSON.parse(desenho.geojson)
//                                     : desenho.geojson;
//                             } catch (err) {
//                                 console.error('GeoJSON inválido:', desenho.id);
//                                 return;
//                             }

//                             if (desenho.tipo === 'circle') {
//                                 const coords = geojsonObj.geometry.coordinates;
//                                 const raio = geojsonObj.properties?.radius || 100;

//                                 layer = L.circle([coords[1], coords[0]], {
//                                     radius: raio,
//                                     color: cor,
//                                     fillColor: cor,
//                                     fillOpacity: 0.1
//                                 });
//                             }
//                             else if (desenho.tipo === 'marker') {
//                                 layer = L.geoJSON(geojsonObj);
//                             }
//                             else {
//                                 layer = L.geoJSON(geojsonObj, {
//                                     style: {
//                                         color: cor,
//                                         fillColor: cor,
//                                         fillOpacity: 0.1,
//                                         weight: 2
//                                     }
//                                 });
//                             }

//                             layer = (layer instanceof L.FeatureGroup)
//                                 ? layer.getLayers()[0]
//                                 : layer;

//                             layer.info = {
//                                 nome: desenho.nome,
//                                 categoria: desenho.categoria,
//                                 estado_ocupacao: desenho.estado_ocupacao,
//                                 cor: cor
//                             };

//                             layer.db_id = desenho.id;
//                             atualizarCorPorEstado(layer);
//                             atualizarPopup(layer);
//                             drawnItems.addLayer(layer);
//                         });
//                     } else {
//                         alert('Nenhum desenho encontrado');
//                     }
//                 })
//         .catch(err => {
//             console.error('Erro ao filtrar por categoria:', err);
//             alert('Erro ao filtrar por categoria');
//         });
// });

// function filtrarPorCategoria(categoria, modo = 'estado') {
//     drawnItems.clearLayers();

//     if(categoria === 'todos') {
//         carregarDesenhos();
//         return;
//     }

//     fetch(API_URL + '/categoria/' + categoria)
//         .then(res => res.json())
//         .then(data => {
//             if(data.status !== 'sucesso') return;

//             let bounds = L.latLngBounds();

//             data.dados.forEach(desenho => {
//                 let layer;
//                 let cor = desenho.cor || '#808080';

//                 let geojsonObj = typeof desenho.geojson === 'string'
//                     ? JSON.parse(desenho.geojson)
//                     : desenho.geojson;

//                 if(desenho.tipo === 'circle') {
//                     const coords = geojsonObj.geometry.coordinates;
//                     const raio = geojsonObj.properties?.radius || 100;
//                     layer = L.circle([coords[1], coords[0]], {
//                         radius: raio,
//                         color: cor,
//                         fillColor: cor,
//                         fillOpacity: 0.1
//                     });
//                 } else if(desenho.tipo === 'marker') {
//                     layer = L.geoJSON(geojsonObj);
//                 } else {
//                     layer = L.geoJSON(geojsonObj, {
//                         style: {
//                             color: cor,
//                             fillColor: cor,
//                             fillOpacity: 0.1,
//                             weight: 2
//                         }
//                     });
//                 }

//                 layer = (layer instanceof L.FeatureGroup) ? layer.getLayers()[0] : layer;

//                 layer.info = {
//                     nome: desenho.nome,
//                     descricao: desenho.descricao,
//                     categoria: desenho.categoria,
//                     estado_ocupacao: desenho.estado_ocupacao,
//                     cor: cor,
//                     tipo_carga: desenho.tipo_carga
//                 };

//                 layer.db_id = desenho.id;

//                 if (categoria === 'terminal' && modo === 'carga') {
//                     atualizarCorPorCarga(layer);
//                 } else {
//                     atualizarCorPorEstado(layer);
//                 }

//                 atualizarPopup(layer);
//                 drawnItems.addLayer(layer);

//                 if (layer.getBounds) {
//                     bounds.extend(layer.getBounds());
//                 } else if (layer.getLatLng) {
//                     bounds.extend(layer.getLatLng());
//                 }
//             });

//             if (bounds.isValid()) {
//                 map.fitBounds(bounds);
//             }
//         })
//         .catch(err => console.error('Erro ao filtrar por categoria:', err));
// }

// document.getElementById('btnTerminais').onclick = () => filtrarPorCategoria('terminal', 'estado');
// document.getElementById('btnTerminaisCarga').onclick = () => filtrarPorCategoria('terminal', 'carga');
// document.getElementById('btnFundeadores').onclick = () => filtrarPorCategoria('fundeadouro');
// document.getElementById('btnTodos').onclick = () => filtrarPorCategoria('todos');

