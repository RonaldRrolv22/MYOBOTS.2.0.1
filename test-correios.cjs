const { calcularPrecoPrazo } = require('correios-brasil');

let args = {
  sCepOrigem: '50030917',
  sCepDestino: '01001000',
  nVlPeso: '0.340', // 340 grams = 0.340 kg
  nCdFormato: '1',  // 1 for box/package
  nVlComprimento: '28',
  nVlAltura: '8',
  nVlLargura: '20',
  nCdServico: ['04510'], // 04510 = PAC sem contrato
  nVlDiametro: '0',
};

calcularPrecoPrazo(args).then((response) => {
  console.log(response);
}).catch((error) => {
  console.error(error);
});
