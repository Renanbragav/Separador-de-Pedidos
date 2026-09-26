import { Order } from '../types';

export const SAMPLE_ORDER_160753: Order = {
  id: 'sample-160753',
  orderNumber: '160753',
  dateCad: '17/09/2026 - 17:07:49',
  clientCode: '7743',
  clientName: 'FOUR FITNESS LTDA',
  clientFantasia: 'BLESS FIT ACADEMIAS',
  clientAddress: 'AV. ELISA MACIEL SANTIAGO - GUANABARA - RUSSAS-CE N1990',
  cnpj: '50.923.857/0001-51',
  transport: 'TRANSRAPIDO LOGISTICA LTDA',
  route: '1 - LOCAL',
  sellerName: 'ZELIA CAVALCANTE',
  sellerNormalized: 'Zelia',
  status: 'Pendente',
  totalItems: 9,
  totalValue: 2290.79,
  createdAt: Date.now() - 3600000,
  dateKey: new Date().toISOString().split('T')[0],
  fileType: 'sample',
  items: [
    {
      id: 'item-1',
      code: '9357',
      quantityOrdered: 16,
      quantitySeparated: 16,
      unit: 'UN',
      description: 'SALTY CHIPS SOUR CREAM 40G',
      presentation: '40G',
      manufacturer: 'BENDU',
      expirationDate: '04/06/2027',
      unitPrice: 7.76,
      totalPrice: 124.16,
      location: 'GELADEIRA 01',
      lotInfo: 'L->04/06/2027 Lt S040668 Qt 16',
      checked: false,
    },
    {
      id: 'item-2',
      code: '9358',
      quantityOrdered: 16,
      quantitySeparated: 16,
      unit: 'UN',
      description: 'SALTY CHIPS WHITE CHEESE 40G',
      presentation: '40G',
      manufacturer: 'BENDU',
      expirationDate: '03/06/2027',
      unitPrice: 7.76,
      totalPrice: 124.16,
      location: 'PRATELEIRA B',
      lotInfo: 'L->03/06/2027 Lt S03066A Qt 16',
      checked: false,
    },
    {
      id: 'item-3',
      code: '4967',
      quantityOrdered: 3,
      quantitySeparated: 3,
      unit: 'PT',
      description: 'NUCLEAR RUSH GUARANA 100G',
      presentation: '100G',
      manufacturer: 'BODYACTION',
      expirationDate: '26/11/2027',
      unitPrice: 39.89,
      totalPrice: 119.67,
      location: 'ESTOQUE2-BLOCO-K',
      lotInfo: 'L->26/11/2027 Lt 9110 Qt 3',
      checked: false,
    },
    {
      id: 'item-4',
      code: '8211',
      quantityOrdered: 4,
      quantitySeparated: 4,
      unit: 'PT',
      description: 'NUCLEAR RUSH GUARANA 300G',
      presentation: '300G',
      manufacturer: 'BODYACTION',
      expirationDate: '30/10/2026',
      unitPrice: 94.0,
      totalPrice: 376.0,
      location: 'ESTOQUE2-BLOCO-K',
      lotInfo: 'L->30/10/2026 Lt 4070003/7601 Qt 4',
      checked: false,
    },
    {
      id: 'item-5',
      code: '8394',
      quantityOrdered: 5,
      quantitySeparated: 5,
      unit: 'CX',
      description: 'IM CRISP BAR OVOMALTINE 12X45G',
      presentation: '12X45G',
      manufacturer: 'INTEGRALMEDICA',
      expirationDate: '26/06/2027',
      unitPrice: 87.7,
      totalPrice: 438.5,
      location: 'ESTOQUE1-BLOCO-E',
      lotInfo: 'L->26/06/2027 Lt 083686 Qt 5',
      checked: false,
    },
    {
      id: 'item-6',
      code: '6756',
      quantityOrdered: 3,
      quantitySeparated: 3,
      unit: 'SCH',
      description: 'IM WHEY 100% BAUNILHA POUNCH 900G',
      presentation: '900G',
      manufacturer: 'INTEGRALMEDICA',
      expirationDate: '26/01/2028',
      unitPrice: 139.9,
      totalPrice: 419.7,
      location: 'ESTOQUE1-BLOCO-E',
      lotInfo: 'L->26/01/2028 Lt 083938 Qt 3',
      checked: false,
    },
    {
      id: 'item-7',
      code: '6759',
      quantityOrdered: 2,
      quantitySeparated: 2,
      unit: 'SCH',
      description: 'IM WHEY 100% COOKIES POUNCH 900G',
      presentation: '900G',
      manufacturer: 'INTEGRALMEDICA',
      expirationDate: '26/01/2028',
      unitPrice: 139.9,
      totalPrice: 279.8,
      location: 'ESTOQUE1-BLOCO-E',
      lotInfo: 'L->26/01/2028 Lt 083877 Qt 2',
      checked: false,
    },
    {
      id: 'item-8',
      code: '5005',
      quantityOrdered: 2,
      quantitySeparated: 2,
      unit: 'PT',
      description: 'MAX. 100% WHEY POTE CHOCOLATE 900G',
      presentation: '900G',
      manufacturer: 'MAX TITANIUM',
      expirationDate: '16/11/2027',
      unitPrice: 139.9,
      totalPrice: 279.8,
      location: 'ESTOQUE2-BLOCO-N',
      lotInfo: 'L->16/11/2027 Lt 2613802 Qt 2',
      checked: false,
    },
    {
      id: 'item-9',
      code: '4757',
      quantityOrdered: 3,
      quantitySeparated: 3,
      unit: 'UN',
      description: 'MAX. CREATINE POTE 300G',
      presentation: '300G',
      manufacturer: 'MAX TITANIUM',
      expirationDate: '26/05/2028',
      unitPrice: 43.0,
      totalPrice: 129.0,
      location: 'ESTOQUE1-BLOCO-F',
      lotInfo: 'L->26/05/2028 Lt 2614705 Qt 3',
      checked: false,
    },
  ],
};

export const SAMPLE_MATRIX_TEXT = `Pedido: 160753   Data Cad.: 17/09/2026 - 17:07:49
Cliente: 7743 - FOUR FITNESS LTDA
Fantasia: BLESS FIT ACADEMIAS
Endereço: AV. ELISA MACIEL SANTIAGO - GUANABARA - RUSSAS-CE N1990
CNPJ: 50.923.857/0001-51
Transportadora: TRANSRAPIDO LOGISTICA LTDA   Rota: 1 - LOCAL
Vendedor: ZELIA CAVALCANTE

Cód.  Quant.  Unid.  Descrição do Produto                  Apres.  Fornecedor       Vlr. Unit.  Vlr. Total  Localização
9357  16      UN     SALTY CHIPS SOUR CREAM 40G            40G     BENDU            7,76        124,16      GELADEIRA 01
L->04/06/2027 Lt S040668 Qt 16
9358  16      UN     SALTY CHIPS WHITE CHEESE 40G          40G     BENDU            7,76        124,16      PRATELEIRA B
L->03/06/2027 Lt S03066A Qt 16
4967  3       PT     NUCLEAR RUSH GUARANA 100G             100G    BODYACTION       39,89       119,67      ESTOQUE2-BLOCO-K
L->26/11/2027 Lt 9110 Qt 3
8211  4       PT     NUCLEAR RUSH GUARANA 300G             300G    BODYACTION       94,00       376,00      ESTOQUE2-BLOCO-K
L->30/10/2026 Lt 4070003/7601 Qt 4
8394  5       CX     IM CRISP BAR OVOMALTINE 12X45G        12X45G  INTEGRALMEDICA   87,70       438,50      ESTOQUE1-BLOCO-E
L->26/06/2027 Lt 083686 Qt 5
6756  3       SCH    IM WHEY 100% BAUNILHA POUNCH 900G     900G    INTEGRALMEDICA   139,90      419,70      ESTOQUE1-BLOCO-E
L->26/01/2028 Lt 083938 Qt 3
6759  2       SCH    IM WHEY 100% COOKIES POUNCH 900G      900G    INTEGRALMEDICA   139,90      279,80      ESTOQUE1-BLOCO-E
L->26/01/2028 Lt 083877 Qt 2
5005  2       PT     MAX. 100% WHEY POTE CHOCOLATE 900G    900G    MAX TITANIUM     139,90      279,80      ESTOQUE2-BLOCO-N
L->16/11/2027 Lt 2613802 Qt 2
4757  3       UN     MAX. CREATINE POTE 300G               300G    MAX TITANIUM     43,00       129,00      ESTOQUE1-BLOCO-F
L->26/05/2028 Lt 2614705 Qt 3`;

