export interface Box {
  id: 'getafe' | 'parla' | 'lasrosas';
  nombre: string;
  zona: string;
  direccion: string;
  codigoPostal: string;
  localidad: string;
  url: string;
  // TODO: confirmar número propio de Getafe y Las Rosas.
  // De momento todos los leads entran por el WhatsApp de Parla (+34 604 840 858).
  whatsapp: string;
  keyword: string;
}

export const WHATSAPP_DEFECTO = '34604840858';

export const boxes: Box[] = [
  {
    id: 'getafe',
    nombre: 'Getafe',
    zona: 'El Bercial',
    direccion: 'Avda. de la Paz, 35',
    codigoPostal: '28907',
    localidad: 'Getafe, Madrid',
    url: '/crossfit-en-getafe/',
    whatsapp: WHATSAPP_DEFECTO,
    keyword: 'CrossFit en Getafe',
  },
  {
    id: 'parla',
    nombre: 'Parla',
    zona: 'Centro',
    direccion: 'C. Roma, 18',
    codigoPostal: '28983',
    localidad: 'Parla, Madrid',
    url: '/crossfit-parla/',
    whatsapp: WHATSAPP_DEFECTO,
    keyword: 'CrossFit en Parla',
  },
  {
    id: 'lasrosas',
    nombre: 'Las Rosas',
    zona: 'San Blas – Canillejas',
    direccion: 'C. de Sofía, 30',
    codigoPostal: '28022',
    localidad: 'Madrid',
    url: '/crossfit-las-rosas/',
    whatsapp: WHATSAPP_DEFECTO,
    keyword: 'CrossFit en Las Rosas',
  },
];

export function waLink(box: Box, mensaje?: string): string {
  const texto = mensaje ?? `Hola, me gustaría probar una clase en CrossFit Metropolitano ${box.nombre}.`;
  return `https://wa.me/${box.whatsapp}?text=${encodeURIComponent(texto)}`;
}
