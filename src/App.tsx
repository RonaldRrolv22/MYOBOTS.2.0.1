/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'react-qr-code';
import SerialNumberGuide from './components/SerialNumberGuide';
import FreteCalculator from './components/FreteCalculator';
import FirmwareReader, { FirmwareGateState } from './components/FirmwareReader';
import FAQ from './components/FAQ';
import { 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquare,
  Loader2, 
  Info,
  Lock,
  Mail,
  Hash,
  ArrowRight,
  Phone,
  User,
  Copy,
  QrCode,
  AlertTriangle
} from 'lucide-react';

// Types
interface MonthData {
  id: string;
  label: string;
  count: number;
}

interface FormState {
  name: string;
  clientPhone: string;
  serialNumbers: string[];
  email: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  observations: string;
  cpfCnpj: string;
  selectedMonth: string | null;
}

const MAX_CAPACITY = 75;
const MONTHS_LIST = [
  "Maio 2026", "Junho 2026", "Julho 2026", "Agosto 2026", 
  "Setembro 2026", "Outubro 2026", "Novembro 2026", "Dezembro 2026",
  "Janeiro 2027", "Fevereiro 2027", "Março 2027", "Abril 2027", "Maio 2027"
];

const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", 
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", 
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function App() {
  // State
  const [months, setMonths] = useState<MonthData[]>(() => {
    return MONTHS_LIST.map((label, index) => ({
      id: `m-${index}`,
      label,
      count: 0
    }));
  });

  const [shippingCost, setShippingCost] = useState<number | null>(null);
  const [protocolNumber, setProtocolNumber] = useState('');

  const [form, setForm] = useState<FormState>({
    name: '',
    clientPhone: '',
    serialNumbers: [''],
    email: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: '',
    observations: '',
    cpfCnpj: '',
    selectedMonth: null
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [firmwareGate, setFirmwareGate] = useState<FirmwareGateState>({
    bluetoothSupported: typeof navigator !== 'undefined' && !!(navigator as any).bluetooth,
    connected: false,
    isReading: false,
    version: null,
  });
  const firmwareSectionRef = useRef<HTMLDivElement>(null);
  
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };
  
  // Payment State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pixData, setPixData] = useState<{ orderId: string, qrCodeUrl: string, qrCodeText: string } | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'checking' | 'expired'>('pending');
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  const getSafePixCode = () => {
    if (!pixData) return '';
    const code = pixData.qrCodeText || (pixData as any).qr_code_text || (pixData as any).qr_code || (pixData as any).pix_code;
    return (code && code !== 'undefined') ? code : '';
  };

  // Scroll to top when showing form
  useEffect(() => {
    if (showForm) {
      window.scrollTo(0, 0);
    }
  }, [showForm]);

  // Fetch monthly capacities from backend
  useEffect(() => {
    const fetchCapacities = async () => {
      try {
        const response = await fetch('/api/capacities');
        if (!response.ok) throw new Error('Falha ao buscar capacidades');
        
        const counts = await response.json();
        
        setMonths(prev => prev.map(m => ({
          ...m,
          count: counts[m.label] || 0
        })));
      } catch (error) {
        console.error('Error fetching capacities:', error);
      }
    };
    
    fetchCapacities();
  }, []);

  // Validation
  const validateSerialNumber = (value: string) => {
    let error = '';
    const regex = /^([0-9]{4})([A-Z])$/;
    const match = value.match(regex);
    if (!value) error = 'Obrigatório';
    else if (value.length !== 5) error = 'Deve ter 5 caracteres';
    else if (!match) error = 'Formato inválido (ex: 1234M)';
    else {
      const num = parseInt(match[1]);
      if (num < 1000 || num > 1870) {
        error = 'Seu Myobots já está na versão de firmware mais recente e não se enquadra na atualização.';
      }
    }
    return error;
  };

  const validateField = (name: string, value: string) => {
    let error = '';
    if (name === 'email') {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value) error = 'Email é obrigatório';
      else if (!regex.test(value)) error = 'Formato de email inválido';
    } else if (name === 'clientPhone') {
      const cleanPhone = value.replace(/\D/g, '');
      if (!value) error = 'WhatsApp é obrigatório';
      else if (/[^\d]/.test(value) || cleanPhone.length !== 11) error = 'O número de celular não é válido. Informe o DDD + número (apenas números)';
    } else if (name === 'zipCode') {
      const cleanCep = value.replace(/\D/g, '');
      if (!value) error = 'CEP é obrigatório';
      else if (/[^\d]/.test(value) || cleanCep.length !== 8) error = 'O CEP deve conter apenas 8 números';
    } else if (name === 'number') {
      if (!value) error = 'Número é obrigatório';
      else if (/[^\d]/.test(value)) error = 'O campo número deve conter apenas números';
    } else if (name === 'cpfCnpj') {
      const clean = value.replace(/\D/g, '');
      if (!value) error = 'CPF/CNPJ é obrigatório';
      else if (clean.length !== 11 && clean.length !== 14) error = 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos';
    } else if (!value && name !== 'selectedMonth' && name !== 'complement' && name !== 'observations') {
      const labels: Record<string, string> = {
        name: 'Nome',
        street: 'Logradouro',
        neighborhood: 'Bairro',
        city: 'Cidade',
        state: 'Estado'
      };
      error = `${labels[name] || 'Campo'} é obrigatório`;
    }
    return error;
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setForm(prev => ({ ...prev, [name]: value }));
    
    // Clear error on change
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSerialChange = (index: number, value: string) => {
    const finalValue = value.toUpperCase();
    const newSerials = [...form.serialNumbers];
    newSerials[index] = finalValue;
    setForm(prev => ({ ...prev, serialNumbers: newSerials }));
    
    const errorKey = `serialNumber_${index}`;
    if (errors[errorKey]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[errorKey];
        return newErrors;
      });
    }
  };

  const addSerialNumber = () => {
    setForm(prev => ({ ...prev, serialNumbers: [...prev.serialNumbers, ''] }));
  };

  const removeSerialNumber = (index: number) => {
    if (form.serialNumbers.length > 1) {
      const newSerials = form.serialNumbers.filter((_, i) => i !== index);
      setForm(prev => ({ ...prev, serialNumbers: newSerials }));
      
      setErrors(prev => {
        const newErrors = { ...prev };
        Object.keys(newErrors).forEach(k => {
          if (k.startsWith('serialNumber_')) delete newErrors[k];
        });
        return newErrors;
      });
    }
  };

  const handleSelectMonth = (monthId: string) => {
    const month = months.find(m => m.id === monthId);
    if (month && month.count + form.serialNumbers.length <= MAX_CAPACITY) {
      setForm(prev => ({ ...prev, selectedMonth: monthId }));
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.selectedMonth;
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Final validation
    const newErrors: Record<string, string> = {};
    
    form.serialNumbers.forEach((serial, index) => {
      const err = validateSerialNumber(serial);
      if (err) newErrors[`serialNumber_${index}`] = err;
    });

    Object.keys(form).forEach(key => {
      if (key !== 'serialNumbers' && key !== 'selectedMonth') {
        const err = validateField(key, (form as any)[key] || '');
        if (err) newErrors[key] = err;
      }
    });

    if (!form.selectedMonth) {
      newErrors.selectedMonth = 'Por favor, selecione um mês para agendamento';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      
      // Detailed alert for user
      const missingFields = Object.keys(newErrors).map(key => {
        if (key.startsWith('serialNumber_')) return 'Número de série (Equipamento ' + (parseInt(key.split('_')[1]) + 1) + ')';
        const labels: Record<string, string> = {
          name: 'Nome',
          clientPhone: 'WhatsApp',
          email: 'Email',
          street: 'Logradouro',
          number: 'Número',
          neighborhood: 'Bairro',
          city: 'Cidade',
          state: 'Estado',
          zipCode: 'CEP',
          cpfCnpj: 'CPF/CNPJ',
          selectedMonth: 'Mês de Agendamento',
          complement: 'Complemento',
          observations: 'Observações'
        };
        return labels[key] || key;
      });
      
      alert(`Por favor, preencha corretamente os seguintes campos:\n\n• ${missingFields.join('\n• ')}`);

      // Scroll to first error
      const firstError = Object.keys(newErrors)[0];
      const el = document.getElementsByName(firstError)[0] || document.getElementById(firstError);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const selectedMonthObj = months.find(m => m.id === form.selectedMonth);
    if (selectedMonthObj && selectedMonthObj.count + form.serialNumbers.length > MAX_CAPACITY) {
      alert(`O mês selecionado possui apenas ${MAX_CAPACITY - selectedMonthObj.count} vagas disponíveis. Sua solicitação contém ${form.serialNumbers.length} números de série.`);
      return;
    }

    setIsSubmitting(true);
    
    try {
      const monthLabel = months.find(m => m.id === form.selectedMonth)?.label || form.selectedMonth;
      
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          selectedMonth: monthLabel,
          shippingCost: shippingCost
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setIsSubmitting(false);
        if (result.code === 'DUPLICATE_SERIAL') {
          alert('Um ou mais números de série informados já possuem uma solicitação registrada.');
        } else if (result.code === 'UNIQUE_VIOLATION') {
          alert('Já identificamos uma solicitação para este contato. É permitida apenas uma solicitação por cliente.');
        } else {
          alert(result.error || 'Ocorreu um erro ao enviar sua solicitação. Tente novamente mais tarde.');
        }
        return;
      }

      setProtocolNumber(result.protocol);
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('Erro de conexão com o servidor. Tente novamente.');
      setIsSubmitting(false);
      return;
    }

    // Update capacity locally
    setMonths(prev => prev.map(m => 
      m.id === form.selectedMonth ? { ...m, count: m.count + form.serialNumbers.length } : m
    ));
    
    setIsSubmitting(false);
    setIsSuccess(true);
    setShowPaymentModal(false); // Close modal if it was open
    
    // Scroll to top to see success message
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartPayment = async (e: FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: Record<string, string> = {};

    // Firmware gate validation
    if (!firmwareGate.bluetoothSupported) {
      newErrors.firmware = 'Para verificar o firmware, use o Google Chrome ou Microsoft Edge em um computador (ou Android). Em iOS o Web Bluetooth não está disponível.';
    } else if (!firmwareGate.connected) {
      newErrors.firmware = 'Conecte seu Myobots via Bluetooth na seção acima antes de solicitar a atualização.';
    } else if (firmwareGate.isReading) {
      newErrors.firmware = 'Aguarde a leitura da versão do firmware ser concluída.';
    } else if (firmwareGate.version === null) {
      newErrors.firmware = 'Não foi possível ler a versão do firmware. Clique em atualizar ou reconecte o dispositivo.';
    }

    form.serialNumbers.forEach((serial, index) => {
      const err = validateSerialNumber(serial);
      if (err) newErrors[`serialNumber_${index}`] = err;
    });

    Object.keys(form).forEach(key => {
      if (key !== 'serialNumbers' && key !== 'selectedMonth') {
        const err = validateField(key, (form as any)[key] || '');
        if (err) newErrors[key] = err;
      }
    });

    if (!form.selectedMonth) {
      newErrors.selectedMonth = 'Por favor, selecione um mês para agendamento';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (newErrors.firmware) {
        firmwareSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const firstSerialError = Object.keys(newErrors).find(k => k.startsWith('serialNumber_'));
        if (firstSerialError) {
          firmwareSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    if (!shippingCost) {
      alert('Por favor, informe seu CEP para calcular o frete antes de prosseguir.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/payments/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: shippingCost,
          name: form.name.trim(),
          email: form.email.trim(),
          cpfCnpj: form.cpfCnpj.replace(/\D/g, ''),
          phone: form.clientPhone
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.details ? `${data.error}\nDetalhes: ${typeof data.details === 'string' ? data.details : JSON.stringify(data.details)}` : data.error;
        throw new Error(errorMsg || 'Erro ao gerar Pix');
      }

      setPixData(data);
      setShowPaymentModal(true);
      setPaymentStatus('pending');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Polling for payment status
  useEffect(() => {
    let interval: any;
    if (showPaymentModal && pixData && paymentStatus !== 'paid') {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/payments/check/${pixData.orderId}`);
          const data = await response.json();
          if (data.isPaid) {
            setPaymentStatus('paid');
            clearInterval(interval);
            // Finalize registration
            finalizeRegistration();
          }
        } catch (error) {
          console.error('Error checking payment:', error);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [showPaymentModal, pixData, paymentStatus]);

  const finalizeRegistration = async () => {
    // Re-call the original submit logic but without validation since it's already done
    // and passing a flag or just relying on the fact that payment was confirmed
    // Actually I'll just call handleSubmit but I need to adapt it.
    // I'll create a dedicated function for final save.
    
    setIsSubmitting(true);
    
    try {
      const monthLabel = months.find(m => m.id === form.selectedMonth)?.label || form.selectedMonth;
      
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          selectedMonth: monthLabel,
          shippingCost: shippingCost,
          paymentId: pixData?.orderId
        })
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || 'Erro ao salvar agendamento após pagamento. Por favor, contate o suporte com seu comprovante.');
        return;
      }

      setProtocolNumber(result.protocol);
      
      // Update capacity locally
      setMonths(prev => prev.map(m => 
        m.id === form.selectedMonth ? { ...m, count: m.count + form.serialNumbers.length } : m
      ));
      
      setIsSuccess(true);
      setShowPaymentModal(false);
    } catch (error) {
      console.error('Error finalizing registration:', error);
      alert('Erro de conexão. Seu pagamento foi recebido, mas o agendamento falhou. Contate o suporte.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setIsSuccess(false);
    setForm({
      name: '',
      clientPhone: '',
      serialNumbers: [''],
      email: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: '',
      observations: '',
      cpfCnpj: '',
      selectedMonth: null
    });
  };

  const handleCopyPix = () => {
    const code = getSafePixCode();
    
    if (!code) {
      alert('Não foi possível encontrar o código Pix. Por favor, tente gerar o pagamento novamente.');
      return;
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(code)
        .then(() => alert('Código Pix copiado com sucesso!'))
        .catch(() => fallbackCopy(code));
    } else {
      fallbackCopy(code);
    }
  };

  const fallbackCopy = (text: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        alert('Código Pix copiado com sucesso!');
      } else {
        throw new Error('Falha ao copiar');
      }
    } catch (err) {
      console.error('Erro ao copiar:', err);
      alert('Não foi possível copiar automaticamente. Por favor, selecione o código e copie manualmente.');
    }
  };

  return (
    <div className="min-h-screen bg-white selection:bg-[#4FC3F7]/30 overflow-x-hidden font-sans">
      <AnimatePresence>
        {!showForm && !isSuccess ? (
          <motion.section
            key="hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="min-h-screen w-full flex items-center justify-center p-6 bg-[#F7F7F7] relative"
          >
            <motion.div 
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.15 } }
              }}
              className="max-w-3xl w-full flex flex-col items-center text-center relative z-10 py-12"
            >
              {/* Neurobots Logo */}
              <motion.div 
                variants={{
                  hidden: { opacity: 0, y: -10 },
                  visible: { opacity: 1, y: 0 }
                }}
                className="mb-20 flex items-center justify-center cursor-default"
              >
                <img 
                  src="/logo-neurobots.png" 
                  alt="Neurobots" 
                  className="h-14 w-auto object-contain"
                />
              </motion.div>

              {/* Title */}
              <motion.h2 
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 }
                }}
                className="text-4xl md:text-5xl font-bold text-[#1A1A1A] mb-8 leading-tight tracking-tight px-4"
              >
                Atualização de Firmware <br className="hidden md:block" />
                para o seu Myobots
              </motion.h2>

              {/* Description */}
              <motion.p 
                variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1 }
                }}
                className="text-lg md:text-xl text-[#6B6B6B] font-light max-w-2xl mx-auto mb-16 leading-relaxed px-6"
              >
                Você se interessou em atualizar o firmware do seu Myobots? Conseguimos te ajudar nisso. Preencha o formulário e nossa equipe cuida de tudo.
              </motion.p>

              {/* Product Image */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  visible: { opacity: 1, y: 0 }
                }}
                className="mb-16"
              >
                <motion.img
                  src="/myobots-product.png"
                  alt="Equipamento Myobots"
                  className="h-52 md:h-64 w-auto object-contain drop-shadow-2xl"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                />
              </motion.div>

              {/* Pill Action Button */}
                <motion.button 
                variants={{
                  hidden: { opacity: 0, scale: 0.95 },
                  visible: { opacity: 1, scale: 1 }
                }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowForm(true)}
                className="h-14 px-10 rounded-full neuro-gradient text-white font-bold text-sm tracking-[0.1em] flex items-center justify-center gap-3 transition-all shadow-xl shadow-neuro-blue/20 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative z-10">SOLICITAR ATUALIZAÇÃO</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform relative z-10" />
              </motion.button>

              <div className="w-full mt-12 text-left">
                <FAQ />
              </div>

            </motion.div>
          </motion.section>
        ) : (
          <motion.div 
            key="app-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col min-h-screen bg-[#F7F7F7]"
          >
            {/* Minimal Header */}
            <div className="w-full bg-white border-b border-gray-100 py-6 px-6">
              <div className="max-w-6xl mx-auto flex items-center justify-between">
                <div className="flex items-center">
                  <img 
                    src="/logo-neurobots.png" 
                    alt="Neurobots" 
                    className="h-10 w-auto object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Page Title - More compact for the form view */}
            <main className="max-w-6xl mx-auto px-6 py-8 w-full">
              <AnimatePresence mode="wait">
                {/* Main Form Section */}
                {!isSuccess ? (
                  <motion.div
                    key="form-container"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                      <div className="lg:col-span-8 flex flex-col gap-10">
                        {/* Hero / Title Section */}
                        <header className="border-l-4 border-neuro-blue pl-6 py-2">
                          <h2 className="text-xl md:text-2xl font-bold mb-2 leading-tight flex flex-wrap items-center gap-3">
                            <span className="text-[#1A1A1A]">FORMULÁRIO DE</span>
                            <span className="px-3 py-1 rounded-lg neuro-gradient text-white text-sm">ATUALIZAÇÃO</span>
                          </h2>
                          <p className="text-sm md:text-base text-[#6B6B6B] font-medium italic">
                            Equipamento Myobots • Manutenção de Firmware
                          </p>
                        </header>

                  {/* New Rules Section with clean, readable text */}
                  <section className="apple-card p-8 md:p-10 relative overflow-hidden group">
                    <div className="relative z-10">
                      <header className="mb-10 text-center md:text-left">
                        <h3 className="text-xl md:text-2xl font-bold text-[#1A1A1A] tracking-tight uppercase mb-2">
                          Instruções para o seu envio
                        </h3>
                        <p className="text-neuro-blue font-bold tracking-[0.2em] uppercase text-[10px]">
                          Atualização de Firmware Myobots
                        </p>
                      </header>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
                        <div className="space-y-6 md:space-y-8">
                          <div className="flex gap-4">
                            <div className="w-10 h-10 shrink-0 rounded-full bg-blue-50 flex items-center justify-center text-neuro-blue">
                              <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-[#1A1A1A] uppercase text-[10px] tracking-widest mb-1">Autorização de Envio</p>
                              <p className="text-sm text-[#6B6B6B] font-light leading-relaxed">
                                Após o preenchimento do formulário e o pagamento do frete, o seu agendamento estará concluído com sucesso.
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-4">
                            <div className="w-10 h-10 shrink-0 rounded-full bg-blue-50/50 flex items-center justify-center text-neuro-blue">
                              <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-[#1A1A1A] uppercase text-[10px] tracking-widest mb-1">Janela de Postagem</p>
                              <p className="text-sm text-[#6B6B6B] font-light leading-relaxed">
                                Uma vez emitida a autorização, o solicitante tem o prazo de <strong className="text-[#1A1A1A] font-medium">4 dias úteis</strong> para realizar a postagem.
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-4">
                            <div className="w-10 h-10 shrink-0 rounded-full bg-blue-50/30 flex items-center justify-center text-neuro-blue">
                              <MapPin className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-[#1A1A1A] uppercase text-[10px] tracking-widest mb-1">Custos Logísticos</p>
                              <p className="text-sm text-[#6B6B6B] font-light leading-relaxed">
                                O transporte (envio e retorno) é de <strong className="text-[#1A1A1A] font-medium">responsabilidade do solicitante</strong>.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-8">
                          <div className="bg-[#F9FAFB] p-6 rounded-[20px] border border-gray-100 flex flex-col gap-4">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-bold text-[#1A1A1A] uppercase text-[9px] tracking-[0.2em]">Envios no Prazo</p>
                                <span className="bg-white text-[#1A1A1A] text-[9px] font-bold px-2 py-1 rounded-full uppercase border border-gray-100">3 Dias Úteis</span>
                              </div>
                              <p className="text-xs text-[#6B6B6B] font-light">O serviço será concluído em até 3 dias úteis após o recebimento.</p>
                            </div>

                            <div className="h-px bg-gray-200/50" />

                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-bold text-[#6B6B6B] uppercase text-[9px] tracking-[0.2em]">Fora do Prazo</p>
                                <span className="bg-white text-[#6B6B6B] text-[9px] font-bold px-2 py-1 rounded-full uppercase border border-gray-100">8 Dias Úteis</span>
                              </div>
                              <p className="text-xs text-[#6B6B6B] font-light leading-relaxed">
                                Equipamentos postados fora da data de validade da autorização serão retidos até nova liberação.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <form onSubmit={handleStartPayment} className="space-y-10">
                    
                    {/* Section: Identificação */}
                    <div className="apple-card p-8">
                      <div className="flex items-center gap-3 mb-8">
                        <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
                        <h3 className="text-lg font-bold text-gray-800">Informações do Cliente e do Equipamento</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2 space-y-6">
                          <label>Nome do solicitante</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              name="name"
                              placeholder="Digite seu nome completo"
                              value={form.name}
                              onChange={handleChange}
                              className={errors.name ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}
                            />
                            {errors.name && <span className="absolute -bottom-5 left-1 text-[10px] text-red-500 font-medium">{errors.name}</span>}
                          </div>
                        </div>

                        <div className="md:col-span-2 space-y-6">
                          <label>Número do cliente / WhatsApp</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              name="clientPhone"
                              placeholder="(00) 00000-0000"
                              value={form.clientPhone}
                              onChange={handleChange}
                              className={errors.clientPhone ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}
                            />
                            <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                            {errors.clientPhone && <span className="absolute -bottom-5 left-1 text-[10px] text-red-500 font-medium">{errors.clientPhone}</span>}
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <label>Email para contato</label>
                          <div className="relative">
                            <input 
                              type="email" 
                              name="email"
                              placeholder="seu@email.com"
                              value={form.email}
                              onChange={handleChange}
                              className={errors.email ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}
                            />
                            <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                            {errors.email && <span className="absolute -bottom-5 left-1 text-[10px] text-red-500 font-medium">{errors.email}</span>}
                          </div>
                        </div>
                        
                        <div className="md:col-span-2">
                          <label>CPF ou CNPJ (para pagamento)</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              name="cpfCnpj"
                              placeholder="000.000.000-00 ou 00.000.000/0000-00"
                              value={form.cpfCnpj}
                              onChange={handleChange}
                              className={errors.cpfCnpj ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}
                            />
                            <User className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                            {errors.cpfCnpj && <span className="absolute -bottom-5 left-1 text-[10px] text-red-500 font-medium">{errors.cpfCnpj}</span>}
                          </div>
                        </div>

                        <div className="md:col-span-2 space-y-6">
                          <div
                            ref={firmwareSectionRef}
                            className={`rounded-3xl transition-all duration-200 ${errors.firmware ? 'ring-2 ring-red-300 ring-offset-2' : ''}`}
                          >
                            <FirmwareReader onFirmwareGateChange={(state) => {
                              setFirmwareGate(state);
                              if (state.connected && !state.isReading && state.version !== null) {
                                setErrors(prev => {
                                  if (!prev.firmware) return prev;
                                  const next = { ...prev };
                                  delete next.firmware;
                                  return next;
                                });
                              }
                            }} />
                            {errors.firmware && (
                              <motion.p
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-2 ml-1 text-[11px] text-red-600 font-medium flex items-center gap-1.5"
                              >
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                {errors.firmware}
                              </motion.p>
                            )}
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 bg-gray-50/50 p-4 md:p-8 rounded-3xl border border-gray-100">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between mb-4">
                                <label className="text-gray-900 font-black uppercase text-xs tracking-widest italic mb-0">Número(s) de série</label>
                                <button
                                  type="button"
                                  onClick={addSerialNumber}
                                  className="text-xs font-bold text-neuro-blue hover:text-blue-600 transition-colors"
                                >
                                  + Adicionar equipamento
                                </button>
                              </div>
                              
                              <AnimatePresence>
                                {form.serialNumbers.map((serial, index) => {
                                  const errorKey = `serialNumber_${index}`;
                                  const hasError = !!errors[errorKey];
                                  const isRecentError = hasError && errors[errorKey].includes('recente');
                                  
                                  return (
                                    <motion.div 
                                      key={index}
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="space-y-3 mb-4"
                                    >
                                      <div className="relative flex gap-2">
                                        <div className="relative flex-1">
                                          <input 
                                            type="text" 
                                            placeholder={`Ex: 1234M (Equipamento ${index + 1})`}
                                            maxLength={5}
                                            value={serial}
                                            onChange={(e) => handleSerialChange(index, e.target.value)}
                                            className={`font-mono tracking-wider h-14 bg-white transition-all duration-300 w-full rounded-xl border px-4 focus:outline-none ${
                                              isRecentError 
                                                ? 'border-amber-300 focus:border-amber-400 focus:ring-amber-100 focus:ring-4' 
                                                : hasError 
                                                  ? 'border-red-300 focus:border-red-400 focus:ring-red-100 focus:ring-4' 
                                                  : 'border-gray-200 focus:border-neuro-blue focus:ring-4 focus:ring-neuro-blue/5'
                                            }`}
                                          />
                                          <Hash className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                                          {hasError && !isRecentError && <span className="absolute -bottom-5 left-1 text-[10px] text-red-500 font-medium">{errors[errorKey]}</span>}
                                        </div>
                                        {form.serialNumbers.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => removeSerialNumber(index)}
                                            className="w-14 h-14 shrink-0 rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all flex items-center justify-center"
                                            title="Remover equipamento"
                                          >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                          </button>
                                        )}
                                      </div>
                                      
                                      <AnimatePresence>
                                        {isRecentError && (
                                          <motion.div 
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex gap-3 shadow-sm mt-2"
                                          >
                                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                              <Info className="w-4 h-4 text-amber-600" />
                                            </div>
                                            <p className="text-xs text-amber-900 font-medium leading-relaxed">
                                              {errors[errorKey]}
                                            </p>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </motion.div>
                                  );
                                })}
                              </AnimatePresence>

                              <div className="space-y-4 mt-6">
                                <div>
                                  <p className="text-[11px] font-black text-neuro-blue uppercase tracking-wider mb-2">Como localizar o código do seu equipamento:</p>
                                  <ul className="text-[10px] text-gray-500 space-y-2 list-disc pl-4 font-medium leading-relaxed">
                                    <li>Verifique a etiqueta na parte posterior do aparelho, próxima à entrada do carregador.</li>
                                    <li>Localize o campo identificado como SN.</li>
                                    <li>O código é composto por 4 números seguidos da letra M (Exemplo: 1234M).</li>
                                  </ul>
                                </div>

                                <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100">
                                  <p className="text-[11px] font-black text-orange-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> Regra de Preenchimento:
                                  </p>
                                  <ul className="text-[10px] text-orange-800 space-y-1 font-medium leading-tight">
                                    <li>• Digite apenas os 5 caracteres (letras e números).</li>
                                    <li>• Utilize letras MAIÚSCULAS.</li>
                                    <li>• Não adicione espaços, pontos ou textos extras (ex: não escreva "SN: 1234M", digite apenas 1234M).</li>
                                  </ul>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-center bg-white rounded-2xl border border-gray-100 p-2 overflow-visible shadow-inner min-h-[300px]">
                              <SerialNumberGuide />
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Section: Endereço */}
                    <div className="apple-card p-8">
                      <div className="flex items-center gap-3 mb-8">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">Endereço de devolução</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                        <div className="md:col-span-4">
                          <label>Logradouro</label>
                          <input 
                            type="text" 
                            name="street"
                            placeholder="Rua, Avenida, etc."
                            value={form.street}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label>Número</label>
                          <input 
                            type="text" 
                            name="number"
                            placeholder="Nº"
                            value={form.number}
                            onChange={handleChange}
                          />
                        </div>

                        <div className="md:col-span-3">
                          <label>Complemento <span className="text-gray-400 font-normal">(opcional)</span></label>
                          <input 
                            type="text" 
                            name="complement"
                            placeholder="Apt, Sala, Bloco"
                            value={form.complement}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label>Bairro</label>
                          <input 
                            type="text" 
                            name="neighborhood"
                            placeholder="Bairro"
                            value={form.neighborhood}
                            onChange={handleChange}
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label>CEP</label>
                          <input 
                            type="text" 
                            name="zipCode"
                            placeholder="00000-000"
                            value={form.zipCode}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label>Cidade</label>
                          <input 
                            type="text" 
                            name="city"
                            placeholder="Sua cidade"
                            value={form.city}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="md:col-span-1">
                          <label>UF</label>
                          <select name="state" value={form.state} onChange={handleChange}>
                            <option value="">--</option>
                            {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                          </select>
                        </div>

                        <div className="md:col-span-6">
                          <label>Observações <span className="text-gray-400 font-normal">(opcional)</span></label>
                          <textarea 
                            name="observations"
                            rows={3}
                            placeholder="Informações adicionais para a entrega..."
                            value={form.observations}
                            onChange={(e: any) => handleChange(e as ChangeEvent<HTMLInputElement>)}
                            className="w-full h-auto py-3 px-4 rounded-xl border border-gray-100 bg-white shadow-sm focus:border-neuro-blue focus:ring-4 focus:ring-neuro-blue/5 transition-all outline-none text-sm placeholder:text-gray-300 resize-none"
                          />
                        </div>

                        {/* Freight Calculator - appears when CEP is filled */}
                        <FreteCalculator cep={form.zipCode} onCalculated={setShippingCost} />
                      </div>
                    </div>

                    {/* Section: Agendamento */}
                    <div id="scheduling" className="apple-card p-8">
                      <div className="flex items-end justify-between mb-8">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold text-gray-800">Agendamento de Envio <span className="text-sm font-normal text-gray-400 ml-2">Selecione o mês desejado</span></h3>
                        </div>
                        <div className="flex gap-4 text-xs font-medium text-gray-500"><span>Capacidade Mensal: {MAX_CAPACITY}</span></div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {months.map((month) => {
                          const isFull = month.count + form.serialNumbers.length > MAX_CAPACITY;
                          const isSelected = form.selectedMonth === month.id;
                          const percentage = Math.min(100, (month.count / MAX_CAPACITY) * 100);
                          
                          return (
                            <motion.div
                              key={month.id}
                              onClick={() => !isFull && handleSelectMonth(month.id)}
                              className={`
                                ${isFull ? 'month-card-full' : 'month-card-available'}
                                ${isSelected ? 'month-card-selected' : ''}
                              `}
                              whileTap={!isFull ? { scale: 0.98 } : {}}
                            >
                              <div className="flex justify-between items-start mb-3">
                                <span className={`text-sm font-semibold ${isSelected ? 'text-neuro-blue' : 'text-gray-700'}`}>
                                  {month.label}
                                </span>
                                {isFull ? (
                                  <Lock className="w-3 h-3 text-gray-400" />
                                ) : isSelected ? (
                                  <motion.div 
                                    initial={{ scale: 0 }} 
                                    animate={{ scale: 1 }}
                                    className="w-5 h-5 rounded-full neuro-gradient flex items-center justify-center text-white"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                  </motion.div>
                                ) : null}
                              </div>
                              
                              <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                                  <span className={isFull ? 'text-gray-400' : isSelected ? 'text-neuro-blue' : 'text-gray-500'}>
                                    {isFull ? 'Lotado' : `${MAX_CAPACITY - month.count} vagas`}
                                  </span>
                                  <span className="text-gray-300">{month.count}/{MAX_CAPACITY}</span>
                                </div>
                                <div className="progress-bar">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percentage}%` }}
                                    className={`progress-fill ${isFull ? 'bg-gray-300' : ''}`}
                                  />
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Final Button */}
                    <div className="pt-6">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="group relative w-full h-14 rounded-full neuro-gradient text-white font-bold text-base transition-all active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed shadow-xl shadow-neuro-blue/20 hover:shadow-neuro-blue/40 overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <AnimatePresence mode="wait">
                          {isSubmitting ? (
                            <motion.div
                              key="loading"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="flex items-center justify-center gap-3 relative z-10"
                            >
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Enviando solicitação...</span>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="idle"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex items-center justify-center gap-2 relative z-10"
                            >
                              <span>SOLICITAR ATUALIZAÇÃO</span>
                              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>
                      <p className="text-center text-xs text-[#6B6B6B] mt-4 font-light italic">
                        Ao clicar em solicitar, você concorda com os termos de atualização da Neurobots.
                      </p>
                    </div>

                  </form>
                </div>

                {/* Right Column: Sticky Sidebar & Product Bio */}
                <div className="lg:col-span-4 space-y-8">
                  {/* Enhanced Help Card */}
                  <div className="apple-card p-10 border-dashed border-gray-300 bg-gray-50/50 flex flex-col items-center text-center group hover:bg-white hover:border-neuro-blue transition-all duration-300">
                    <div className="w-16 h-16 rounded-3xl bg-green-50 shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform border border-green-100">
                      <MessageSquare className="w-8 h-8 text-green-600" />
                    </div>
                    <h5 className="font-display font-display font-black text-gray-800 text-lg mb-2">Atendimento ao Cliente</h5>
                    <p className="text-sm text-gray-400 mb-8 font-medium leading-relaxed">
                      Dúvidas sobre o número de série ou processo de envio? Entre em contato com nosso time.
                    </p>
                    <a
                      href="https://api.whatsapp.com/send/?phone=5581982615413&text&type=phone_number&app_absent=0"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 rounded-full bg-green-600 text-white text-sm font-bold uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-100 block text-center"
                    >
                      Contatar Equipe por WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
                    key="success-container"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-2xl mx-auto py-20 flex flex-col items-center text-center"
                  >
                    <div className="w-20 h-20 rounded-full bg-white border border-gray-100 flex items-center justify-center text-neuro-blue mb-10 shadow-sm transition-transform hover:scale-105">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: "spring" }}
                      >
                        <CheckCircle2 className="w-10 h-10" />
                      </motion.div>
                    </div>
                    
                    <h2 className="text-4xl font-bold text-[#1A1A1A] mb-4">Solicitação Recebida!</h2>
                    <p className="text-lg text-[#6B6B6B] font-light mb-12 leading-relaxed px-4">
                      Sua solicitação foi registrada com sucesso. Em breve entraremos em contato com você.
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mb-12">
                      <div className="apple-card p-6 md:p-8 text-left bg-white shadow-sm border-gray-100">
                        <span className="text-[11px] font-bold text-[#6B6B6B] uppercase tracking-widest block mb-2">Protocolo</span>
                        <span className="text-xl font-mono font-bold text-[#1A1A1A] tracking-wider">#{protocolNumber}</span>
                      </div>
                      <div className="apple-card p-6 md:p-8 text-left bg-white shadow-sm border-gray-100">
                        <span className="text-[11px] font-bold text-[#6B6B6B] uppercase tracking-widest block mb-2">Janela de Envio</span>
                        <span className="text-xl font-bold text-neuro-blue">{months.find(m => m.id === form.selectedMonth)?.label}</span>
                      </div>
                    </div>

                    <button 
                      onClick={resetForm}
                      className="text-sm font-medium text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors flex items-center gap-2 group"
                    >
                      Realizar nova solicitação
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Payment Modal Overlay */}
              <AnimatePresence>
                {showPaymentModal && pixData && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex justify-center p-4 bg-[#1A1A1A]/80 backdrop-blur-sm overflow-y-auto py-6 md:py-12"
                  >
                    <motion.div
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                      className="bg-white w-full max-w-md rounded-[32px] p-6 md:p-8 shadow-2xl relative my-auto"
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-2xl neuro-gradient flex items-center justify-center text-white mb-6 shadow-lg shadow-neuro-blue/20">
                          <QrCode className="w-8 h-8" />
                        </div>
                        
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Pagamento via Pix</h3>
                        <p className="text-gray-500 text-sm mb-8">
                          Para confirmar seu agendamento, realize o pagamento do frete no valor de <strong className="text-neuro-blue">{formatCurrency(shippingCost || 0)}</strong>
                        </p>

                        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-8 w-full flex flex-col items-center">
                          <div className="mb-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 inline-block">
                            {getSafePixCode() ? (
                              <QRCode
                                value={getSafePixCode()}
                                size={192} // 48 * 4 = 192px (equivalent to w-48 h-48)
                                bgColor="#ffffff"
                                fgColor="#000000"
                                level="M"
                                className="mx-auto"
                              />
                            ) : (
                              <div className="w-48 h-48 bg-gray-100 flex flex-col items-center justify-center text-gray-500 text-[10px] text-left p-4 overflow-auto break-all font-mono">
                                <span className="text-red-500 font-bold mb-1">DEBUG INFO:</span>
                                {pixData ? JSON.stringify(pixData, null, 2) : 'null'}
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1">Status do Pagamento</p>
                          <div className="flex items-center gap-2">
                            {paymentStatus === 'paid' ? (
                              <div className="flex items-center gap-1.5 text-green-600 font-bold text-sm">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>PAGAMENTO CONFIRMADO</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-neuro-blue" />
                                <span className="text-sm font-bold text-gray-600 uppercase tracking-tight">Aguardando confirmação...</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4 w-full">
                          <div className="relative">
                            <input
                              type="text"
                              readOnly
                              value={getSafePixCode()}
                              className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl px-4 text-[10px] font-mono text-gray-500 pr-12 focus:ring-0 cursor-default"
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                            />
                            <button 
                              onClick={handleCopyPix}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neuro-blue hover:text-blue-600"
                              title="Copiar Código"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>

                          <button
                            onClick={handleCopyPix}
                            className="w-full h-14 rounded-2xl neuro-gradient text-white flex items-center justify-center gap-3 font-bold shadow-lg shadow-neuro-blue/20 hover:shadow-neuro-blue/40 transition-all active:scale-95"
                          >
                            <Copy className="w-5 h-5" />
                            <span>COPIAR CÓDIGO PIX</span>
                          </button>
                          
                          <button
                            onClick={() => setShowPaymentModal(false)}
                            className="w-full py-2 text-sm font-medium text-gray-400 hover:text-red-500 transition-colors"
                          >
                            Cancelar e voltar
                          </button>
                        </div>

                        <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3 text-left">
                          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                          <p className="text-[11px] text-amber-900 leading-relaxed">
                            <strong>Atenção:</strong> O agendamento só será processado após a confirmação automática do pagamento. Não feche esta janela até a confirmação.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </main>

            <footer className="mt-auto py-12 border-t border-gray-100">
              <div className="max-w-6xl mx-auto px-6 text-center">
                <p className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-[0.3em]">
                  © 2026 Neurobots
                </p>
              </div>
            </footer>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .logo-fallback {
          display: none;
        }
        img[style*="display: none"] + .logo-fallback {
          display: flex;
        }
      `}</style>
    </div>
  );
}

