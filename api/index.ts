import express from 'express';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

import fs from 'fs';

if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else {
  dotenv.config();
}

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const PAGARME_SECRET_KEY = process.env.PAGARME_SECRET_KEY || '';
const PAGARME_ACCOUNT_ID = process.env.PAGARME_ACCOUNT_ID || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();
app.use(express.json());

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
    throw new Error(`Erro na API do Melhor Envio: ${response.status}`);
  }

  const data: any[] = await response.json();

  const pacService = data.find((service: any) => 
    service.name && service.name.toUpperCase().includes('PAC') && !service.error
  );

  if (!pacService) {
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
    
    const resultado = await calcularFrete(cepClean);

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
/**
 * Pagar.me Integration Endpoints
 */

// API Route: Create Pix Payment
app.post('/api/payments/create-pix', async (req, res) => {
  try {
    const { amount, name, email, cpfCnpj } = req.body;

    if (!amount || !name || !email || !cpfCnpj) {
      return res.status(400).json({ error: 'Dados incompletos para gerar o Pix' });
    }

    if (!PAGARME_SECRET_KEY) {
      return res.status(500).json({ error: 'Chave do Pagar.me não configurada' });
    }

    const auth = Buffer.from(`${PAGARME_SECRET_KEY}:`).toString('base64');
    const cleanCpfCnpj = cpfCnpj.replace(/\D/g, '');

    const orderData = {
      items: [
        {
          amount: Math.round(amount * 100), // Pagar.me expects cents
          description: 'Atualização de Firmware Myobots - Frete',
          quantity: 1,
          code: 'firmware-update-shipping'
        }
      ],
      customer: {
        name,
        email: email.toLowerCase().trim(),
        document: cleanCpfCnpj,
        type: cleanCpfCnpj.length > 11 ? 'corporation' : 'individual'
      },
      payments: [
        {
          payment_method: 'pix',
          pix: {
            expires_in: 3600 // 1 hour
          }
        }
      ]
    };

    const response = await axios.post('https://api.pagar.me/core/v5/orders', orderData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      }
    });

    const charge = response.data.charges?.[0];
    const pixInfo = charge?.last_transaction;

    if (!pixInfo) {
      throw new Error('Falha ao obter informações do Pix do Pagar.me');
    }

    return res.json({
      orderId: response.data.id,
      qrCodeUrl: pixInfo.qr_code_url,
      qrCodeText: pixInfo.qr_code
    });

  } catch (error: any) {
    console.error('[Pagar.me] Error creating Pix:', error.response?.data || error.message);
    return res.status(500).json({ 
      error: 'Não foi possível gerar o Pix. Verifique os dados e tente novamente.',
      details: error.response?.data || error.message
    });
  }
});

// API Route: Check Payment Status
app.get('/api/payments/check/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!PAGARME_SECRET_KEY) {
      return res.status(500).json({ error: 'Chave do Pagar.me não configurada' });
    }

    const auth = Buffer.from(`${PAGARME_SECRET_KEY}:`).toString('base64');
    
    const response = await axios.get(`https://api.pagar.me/core/v5/orders/${orderId}`, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    const status = response.data.status; // 'paid', 'pending', 'canceled', etc.
    
    return res.json({ 
      status,
      isPaid: status === 'paid'
    });

  } catch (error: any) {
    console.error('[Pagar.me] Error checking payment:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Erro ao verificar status do pagamento' });
  }
});

// API Route: Get monthly capacities
app.get('/api/capacities', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('firmware_requests')
      .select('selected_month, serial_numbers');

    if (error) throw error;

    const counts = data.reduce((acc: Record<string, number>, curr) => {
      if (curr.selected_month) {
        const numSerials = Array.isArray(curr.serial_numbers) ? curr.serial_numbers.length : 1;
        acc[curr.selected_month] = (acc[curr.selected_month] || 0) + numSerials;
      }
      return acc;
    }, {});

    return res.json(counts);
  } catch (error: any) {
    console.error('[Server] Error fetching capacities:', error.message);
    return res.status(500).json({ error: 'Erro ao buscar capacidades.' });
  }
});

// API Route: Submit request
app.post('/api/requests', async (req, res) => {
  try {
    const { 
      name, clientPhone, email, serialNumbers, street, number, 
      complement, neighborhood, city, state, zipCode, 
      observations, selectedMonth, shippingCost, cpfCnpj, paymentId 
    } = req.body;

    // Check for duplicate serial numbers
    const { data: existingSerials, error: serialsError } = await supabase
      .from('firmware_requests')
      .select('id')
      .overlaps('serial_numbers', serialNumbers)
      .limit(1);

    if (serialsError) throw serialsError;
    
    if (existingSerials && existingSerials.length > 0) {
      return res.status(409).json({ 
        error: 'Um ou mais números de série informados já possuem uma solicitação registrada.',
        code: 'DUPLICATE_SERIAL'
      });
    }

    const generatedProtocol = Math.random().toString(36).substring(7).toUpperCase();

    // Save to Supabase
    const { error } = await supabase.from('firmware_requests').insert({
      name,
      client_phone: clientPhone.replace(/\D/g, ''),
      email: email.toLowerCase().trim(),
      serial_numbers: serialNumbers,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      zip_code: zipCode.replace(/\D/g, ''),
      observations,
      selected_month: selectedMonth,
      shipping_cost: shippingCost,
      protocol_number: generatedProtocol,
      cpf_cnpj: cpfCnpj.replace(/\D/g, ''),
      payment_id: paymentId,
      status_payment: 'approved'
    });

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ 
          error: 'Já identificamos uma solicitação para este contato. É permitida apenas uma solicitação por cliente.',
          code: 'UNIQUE_VIOLATION'
        });
      }
      throw error;
    }

    return res.json({ success: true, protocol: generatedProtocol });
  } catch (error: any) {
    console.error('[Server] Error submitting request:', error.message);
    return res.status(500).json({ error: 'Erro ao processar solicitação.' });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
