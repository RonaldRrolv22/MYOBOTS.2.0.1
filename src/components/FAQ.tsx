import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus } from 'lucide-react';

const faqData = [
  {
    question: "Como acessar o sistema de avaliação Myobots?",
    answer: "O acesso é feito através de um navegador de Internet, no link https://app.myobots.com/ utilizando o mesmo login e senha utilizado no aplicativo Myobots. É possível utilizar o navegador de Internet em notebook, desktop, celular ou tablet Android. Em breve, estará disponível para iOS (ipad e celular), assim que a Apple finalizar a revisão do aplicativo que já foi submetido por nós."
  },
  {
    question: "Quais protocolos de avaliação o sistema oferece?",
    answer: "O software já vem configurado de forma automática com o protocolo de Glazer, que é o mais validado para o assoalho pélvico. Além disso, o sistema permite que você duplique, edite ou crie protocolos totalmente novos do zero, adicionando blocos de repouso, contração fásica, contração tônica, endurance e blocos personalizados, como por exemplo, testes de tosse ou esforço evacuatório."
  },
  {
    question: "Caso meu atendimento não seja na área pélvica, é possível utilizar o módulo de avaliação?",
    answer: "Sim, o módulo de avaliação pode ser utilizado em qualquer musculatura superficial do corpo. No relatório, serão exibidas todas as métricas relacionadas a diferentes tipos de contração e você poderá acompanhar a evolução do seu paciente no tratamento. Porém, no momento, os valores normativos da literatura para referência estão disponíveis apenas para a região pélvica. Em breve, serão lançados outros protocolos."
  },
  {
    question: "Como o sistema mede a fadiga muscular de forma precisa?",
    answer: "A forma mais validada na literatura de avaliar a fadiga é através da análise da frequência mediana da Eletromiografia. Em termos simples, esse dado revela a velocidade de disparo da musculatura. No início de cada contração, a frequência mediana tente a ser mais alta, pois tanto as fibras rápidas como as lentas estão com energia suficiente para ajudar na sustentação das contrações. Mas, assim que as fibras rápidas começam a fadigar, a frequência começa a reduzir, segundo a segundo. Portanto, o sistema analisa o declínio da frequência mediana, um indicador espectral que detecta o ritmo de disparo da musculatura e identifica a troca de fibras rápidas (que fadigam primeiro) por fibras lentas durante uma contração sustentada de endurance."
  },
  {
    question: "O que o sistema avalia durante as contrações fásicas (rápidas)?",
    answer: "O sistema marca automaticamente o início e o fim dos picos de contração para calcular o tempo de subida e o tempo de descida. O tempo de subida avalia o recrutamento muscular e a consciência corporal, enquanto o tempo de descida mede quanto tempo o músculo leva para relaxar e voltar ao repouso, o que é essencial para identificar casos de hipertonia. Você também tem total liberdade para editar essas marcações manualmente no relatório, se desejar."
  },
  {
    question: "Como são gerados os relatórios da avaliação?",
    answer: "Assim que a coleta termina, os dados são processados na nuvem e o relatório é gerado na mesma hora. O documento é dividido em blocos lógicos seguindo a ordem da sua avaliação, compara os resultados do paciente com valores normativos da literatura e traz textos de interpretação que são 100% editáveis."
  },
  {
    question: "Posso exportar e compartilhar o laudo com o paciente?",
    answer: "Sim. No final do relatório, você pode digitar um parecer clínico ou comentário final com suas observações. Com um clique, o sistema formata tudo em um documento PDF pronto para ser salvo, impresso e compartilhado com o paciente ou com a equipe multidisciplinar."
  },
  {
    question: "Após a realização da sessão, é possível visualizar o gráfico completo com o sinal bruto dela?",
    answer: "Sim, o Módulo de Avaliação tem uma funcionalidade de visualização do sinal de toda a sessão, após sua realização. Caso o Myobots tenha a versão do firmware atualizado, é possível visualizar esse gráfico nas opções: sinal bruto, envelope e suavizado. Sem a atualização do firmware é possível visualizar na versão suavizado."
  },
  {
    question: "A atualização é obrigatória para ter acesso à avaliação?",
    answer: "Não. Todos os Myobots são compatíveis com o novo programa. Com o novo software, será possível realizar relatórios automáticos para avaliar o repouso, contrações fásicas, tônicas, endurance ou outros testes personalizados. Mas, nós lançamos uma atualização gratuita no software interno do Myobots que permite o acesso a algumas métricas a mais, como: visualização do sinal bruto, cálculos de tempos de contração/relaxamento e fadiga através da análise de frequência mediana. Recomendamos que você teste a versão atual do seu aparelho para que possa decidir se/ou quando será necessário realizar a sua atualização."
  },
  {
    question: "Qual a diferença desse novo módulo para o aplicativo?",
    answer: "O aplicativo do Myobots continua funcionando da mesma forma que é hoje. Com o mesmo acesso a todos os módulos de treinamento e jogos. Na prática, estamos ampliando as possibilidades de uso em um espaço separado e específico para realizar as avaliações. Portanto, o app atual, que você já usa nas sessões de Biofeedback não será alterado no momento."
  },
  {
    question: "Como saber se meu equipamento precisa ser atualizado?",
    answer: "A decisão sobre atualizar o equipamento (e o melhor momento para isso) é uma decisão do profissional. Myobots com número de série entre 1000M e 1870M podem ter acesso gratuito à atualização, com custos apenas de frete, até maio de 2027."
  },
  {
    question: "Como será a atualização?",
    answer: "A atualização é feita através do envio do equipamento para a Neurobots. Para solicitar a atualização do seu Myobots, acesse a página e preencha os seus dados para gerar a autorização de postagem e realizar o pagamento do frete. O equipamento será enviado para o endereço de origem após a atualização."
  },
  {
    question: "Como funciona a autorização de postagem, como é feito o pagamento e qual a validade?",
    answer: "É um documento emitido pelos Correios que permite o envio da encomenda para nosso endereço. O cliente não precisa preparar etiqueta com endereços, nem fazer impressão ou enviar nota fiscal/declaração de conteúdo. Basta mostrar no celular a autorização de postagem emitida e levar o Myobots bem protegido, dentro de uma caixa de papelão. Recomendamos utilizar plástico bolha para o Myobots não se movimentar dentro da caixa. Importante: não envie acessórios (cabos, eletrodos, sondas) ou a caixa original. O pagamento da autorização de postagem (ida e retorno) pode ser feito em até 24h, através de pix. Após o pagamento, a autorização tem validade de 4 dias úteis para envio nos Correios. O código de protocolo que aparece após o pagamento do pix é apenas interno, não se trata ainda do código de autorização de postagem que será enviado via mensagem posteriormente."
  },
  {
    question: "Como funciona o frete (custo, forma de envio e prazos)?",
    answer: "O frete de ida e volta será pago pelo cliente através da autorização de postagem. O valor é definido pelos Correios (PAC) de acordo com o seu endereço. Os residentes de Recife/PE e região metropolitana podem utilizar o serviço dos Correios ou realizar a entrega e retirada do equipamento na Neurobots, seguindo o prazo de atualização de 3 dias úteis. Nesse caso, entre em contato com o Atendimento ao Cliente para agendar o seu envio."
  },
  {
    question: "Haverá custo para atualização?",
    answer: "Não haverá custos para a atualização, isso faz parte do nosso compromisso de trazer os novos recursos para nossa rede. O cliente arcará apenas com o frete de envio e retorno."
  },
  {
    question: "Existe alguma aula sobre o módulo de avaliação?",
    answer: "Sim, confira a aula de Bira Maciel sobre a autilização do módulo de avaliação: https://youtu.be/UxcnuGPz1NE"
  }
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleOpen = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const renderAnswer = (answer: string) => {
    // Detect YouTube youtu.be links
    const youtubeMatch = answer.match(/https:\/\/youtu\.be\/([a-zA-Z0-9_-]+)/);
    
    if (youtubeMatch) {
      const videoId = youtubeMatch[1];
      const textWithoutLink = answer.replace(youtubeMatch[0], '').trim();
      
      return (
        <div className="space-y-6 mt-2">
          <p>{textWithoutLink}</p>
          <div className="relative w-full max-w-2xl overflow-hidden pt-[56.25%] rounded-2xl shadow-lg border border-gray-100 bg-gray-50">
            <iframe 
              className="absolute top-0 left-0 w-full h-full"
              src={`https://www.youtube.com/embed/${videoId}`} 
              title="YouTube video player" 
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
              allowFullScreen
            ></iframe>
          </div>
        </div>
      );
    }
    
    // Normal links
    if (answer.includes('https://')) {
      return (
        <span dangerouslySetInnerHTML={{
          __html: answer.replace(
            /(https:\/\/[^\s]+)/g, 
            '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-neuro-blue hover:underline font-medium break-all">$1</a>'
          )
        }} />
      );
    }

    return <span>{answer}</span>;
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-24 mb-16 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center mb-12"
      >
        <h3 className="text-3xl font-bold text-[#1A1A1A] mb-4">Perguntas Frequentes</h3>
        <p className="text-[#6B6B6B]">Tire suas dúvidas sobre o novo sistema de avaliação e a atualização de firmware.</p>
      </motion.div>

      <div className="space-y-4 text-left">
        {faqData.map((faq, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.05 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <button
              onClick={() => toggleOpen(index)}
              className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            >
              <span className="font-semibold text-gray-800 pr-8 leading-snug">{faq.question}</span>
              <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-gray-50 text-neuro-blue">
                {openIndex === index ? (
                  <Minus className="w-5 h-5" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
              </div>
            </button>
            
            <AnimatePresence>
              {openIndex === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                  <div className="px-6 pb-6 pt-2 text-gray-600 leading-relaxed border-t border-gray-50">
                    {renderAnswer(faq.answer)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
