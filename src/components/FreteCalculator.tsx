import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Truck, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

interface FreteResult {
  valorIda: number;
  valorRetorno: number;
  valorTotal: number;
  servico: string;
  cepOrigem: string;
  cepDestino: string;
}

interface FreteCalculatorProps {
  cep: string;
  onCalculated?: (total: number | null) => void;
}

export default function FreteCalculator({ cep, onCalculated }: FreteCalculatorProps) {
  const [result, setResult] = useState<FreteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCep, setLastCep] = useState<string>('');

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const calcularFrete = useCallback(async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    
    if (cleanCep.length !== 8) return;
    if (cleanCep === lastCep && result) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setLastCep(cleanCep);

    try {
      const response = await fetch('/api/frete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cepDestino: cleanCep }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Erro ao calcular o frete');
      }

      const data: FreteResult = await response.json();
      setResult(data);
      if (onCalculated) onCalculated(data.valorTotal);
    } catch (err: any) {
      setError(err.message || 'Erro ao calcular o frete. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [lastCep, result]);

  // Auto-calculate when CEP changes and has 8 digits
  useEffect(() => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length === 8 && cleanCep !== lastCep) {
      const timer = setTimeout(() => calcularFrete(cep), 600);
      return () => clearTimeout(timer);
    }
  }, [cep, calcularFrete, lastCep]);

  // Reset when CEP is cleared or changed to invalid
  useEffect(() => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length < 8) {
      setResult(null);
      setError(null);
      setLastCep('');
      if (onCalculated) onCalculated(null);
    }
  }, [cep, onCalculated]);

  const cleanCep = cep.replace(/\D/g, '');
  if (cleanCep.length < 8 && !result && !loading) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="frete-section"
        initial={{ opacity: 0, y: 20, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="md:col-span-6 mt-2"
      >
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/40 p-6 relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-100/40 to-transparent rounded-bl-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-100/30 to-transparent rounded-tr-full pointer-events-none" />

          {/* Header */}
          <div className="flex items-center gap-3 mb-5 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-200/50">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-800 tracking-tight">Estimativa de Frete</h4>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Correios • PAC</p>
            </div>
          </div>

          {/* Loading State */}
          <AnimatePresence mode="wait">
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-8 gap-3 relative z-10"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                >
                  <Loader2 className="w-8 h-8 text-blue-500" />
                </motion.div>
                <p className="text-xs text-gray-500 font-medium">Consultando Correios...</p>
              </motion.div>
            )}

            {/* Error State */}
            {error && !loading && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative z-10"
              >
                <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-red-700 mb-1">Não foi possível calcular o frete</p>
                    <p className="text-[11px] text-red-500 leading-relaxed">{error}</p>
                  </div>
                  <button
                    onClick={() => calcularFrete(cep)}
                    className="shrink-0 w-8 h-8 rounded-full bg-white border border-red-100 flex items-center justify-center text-red-400 hover:text-red-600 hover:border-red-200 transition-all"
                    title="Tentar novamente"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Success State */}
            {result && !loading && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, staggerChildren: 0.1 }}
                className="space-y-3 relative z-10"
              >
                {/* Ida */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center justify-between bg-white/80 backdrop-blur-sm rounded-xl px-4 py-3.5 border border-gray-100/80 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Package className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-700">Envio (Ida)</p>
                      <p className="text-[10px] text-gray-400">Seu endereço → Neurobots</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-800 font-mono">
                    {formatCurrency(result.valorIda)}
                  </span>
                </motion.div>

                {/* Retorno */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center justify-between bg-white/80 backdrop-blur-sm rounded-xl px-4 py-3.5 border border-gray-100/80 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <Package className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-700">Retorno (Volta)</p>
                      <p className="text-[10px] text-gray-400">Neurobots → Seu endereço</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-800 font-mono">
                    {formatCurrency(result.valorRetorno)}
                  </span>
                </motion.div>

                {/* Divider */}
                <div className="border-t border-dashed border-gray-200 my-1" />

                {/* Total */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35 }}
                  className="flex items-center justify-between bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl px-5 py-4 shadow-lg shadow-blue-200/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                      <Truck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white/90">Frete Total</p>
                      <p className="text-[10px] text-white/60">Ida + Retorno via PAC</p>
                    </div>
                  </div>
                  <span className="text-lg font-black text-white font-mono tracking-tight">
                    {formatCurrency(result.valorTotal)}
                  </span>
                </motion.div>

                {/* Info note */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-[10px] text-gray-400 text-center pt-1 font-medium italic"
                >
                  * Valores estimados via Correios (PAC). O custo de frete é de responsabilidade do solicitante.
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
