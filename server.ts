import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3001;

// Melhor Envio API configuration
const MELHOR_ENVIO_TOKEN = process.env.MELHOR_ENVIO_TOKEN || '';
const CEP_ORIGEM = process.env.CEP_ORIGEM || '50030917';

// Myobots equipment specs
const PESO_KG = 0.34; // 340 gramas
const ALTURA_CM = 8;
const LARGURA_CM = 20;
const COMPRIMENTO_CM = 28;

// Melhor Envio API base URL (Production)
const MELHOR_ENVIO_API_BASE = 'https://www.melhorenvio.com.br/api/v2';

interface CorreiosPrecoResponse {
  coProduto: string;
  pcFinal: string;
  pcBase?: string;
  pcBaseGeral?: string;
  peVariacao?: string;
  pcReferencia?: string;
  vlBaseCalculoImposto?: string;
  inPesoCubico?: string;
  dtPrazo?: string;
  prazoEntrega?: number;
  [key: string]: any;
}

/**
 * Calculate shipping price using Melhor Envio API
 */
async function calcularFrete(cepDestino: string): Promise<{ valorFrete: number; servico: string }> {
  if (!MELHOR_ENVIO_TOKEN || MELHOR_ENVIO_TOKEN === 'SEU_TOKEN_AQUI') {
    throw new Error('Token do Melhor Envio não configurado no servidor.');
  }

  const cepDestinoClean = cepDestino.replace(/\D/g, '');
  const cepOrigemClean = CEP_ORIGEM.replace(/\D/g, '');

  const payload = {
    from: { postal_code: cepOrigemClean },
    to: { postal_code: cepDestinoClean },
    package: {
      weight: PESO_KG,
      width: LARGURA_CM,
      height: ALTURA_CM,
      length: COMPRIMENTO_CM
    },
    options: {
      insurance_value: 0,
      receipt: false,
      own_hand: false
    }
  };

  const url = `${MELHOR_ENVIO_API_BASE}/me/shipment/calculate`;
  console.log(`[MelhorEnvio] Requesting: ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MELHOR_ENVIO_TOKEN}`,
      'User-Agent': 'Neurobots (suporte@neurobots.com.br)'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[MelhorEnvio] Error ${response.status}: ${errorBody}`);
    throw new Error(`Erro na API do Melhor Envio: ${response.status} - ${errorBody}`);
  }

  const data: any[] = await response.json();
  console.log('[MelhorEnvio] Response items count:', data?.length);

  // Filter for PAC service. In Melhor Envio, PAC is usually id 1 or name includes "PAC"
  // If it's a list of services, we find the one that has "PAC" in the name and is not an error
  const pacService = data.find((service: any) => 
    service.name && service.name.toUpperCase().includes('PAC') && !service.error
  );

  if (!pacService) {
    console.error('[MelhorEnvio] Full Response:', JSON.stringify(data, null, 2));
    throw new Error('Serviço PAC indisponível para este trecho.');
  }

  const valorFrete = parseFloat(pacService.price || pacService.custom_price || '0');

  if (valorFrete <= 0) {
    throw new Error('Valor do frete retornado é inválido');
  }

  return {
    valorFrete,
    servico: pacService.name,
  };
}

// API Route: Calculate shipping
app.post('/api/frete', async (req, res) => {
  try {
    const { cepDestino } = req.body;

    if (!cepDestino) {
      return res.status(400).json({ error: 'CEP de destino é obrigatório' });
    }

    const cepClean = cepDestino.replace(/\D/g, '');
    if (cepClean.length !== 8) {
      return res.status(400).json({ error: 'CEP deve ter 8 dígitos' });
    }

    console.log(`[Server] Calculating shipping for CEP: ${cepClean}`);
    
    const resultado = await calcularFrete(cepClean);

    // Ida and volta cost the same
    const valorIda = resultado.valorFrete;
    const valorRetorno = resultado.valorFrete;
    const valorTotal = valorIda + valorRetorno;

    return res.json({
      valorIda,
      valorRetorno,
      valorTotal,
      servico: resultado.servico,
      cepOrigem: CEP_ORIGEM,
      cepDestino: cepClean,
    });
  } catch (error: any) {
    console.error('[Server] Error:', error.message);
    return res.status(500).json({ 
      error: 'Não foi possível calcular o frete. Tente novamente.',
      details: error.message 
    });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[Server] Melhor Envio Frete API running on http://localhost:${PORT}`);
  console.log(`[Server] CEP Origem: ${CEP_ORIGEM}`);
  console.log(`[Server] Serviço: PAC`);
});
