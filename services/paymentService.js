export class PaymentService {
  constructor() {
    this.accessToken = null;
    this.alias = null;
  }

  setAccessToken(token) {
    this.accessToken = token;
  }

  setAlias(alias) {
    this.alias = alias;
  }

  async crearPreferenciaMercadoPago(pedido) {
    if (!this.accessToken) {
      throw new Error('El Access Token de Mercado Pago no está configurado.');
    }

    const itemsMP = pedido.items.map(item => ({
      title: String(item.nombre),
      unit_price: Number(item.precio),
      quantity: Number(item.cantidad),
      currency_id: 'ARS'
    }));

    const urlActual = window.location.href.split('?')[0];
    const esLocal = urlActual.includes('127.0.0.1') || urlActual.includes('localhost');

    const preferencia = {
      items: itemsMP,
      external_reference: String(pedido.id),
      notification_url: `https://oyeyjkremybtncegobnq.supabase.co/functions/v1/mercado-pago-webhook?local_id=${pedido.local_id}`
    };

    if (!esLocal && urlActual.includes('https://')) {
      preferencia.back_urls = {
        success: urlActual,
        failure: urlActual,
        pending: urlActual
      };
      preferencia.auto_return = "approved";
    }

    try {
      const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferencia)
      });

      if (!response.ok) {
        throw new Error('Error al comunicarse con Mercado Pago.');
      }

      return await response.json();
    } catch (error) {
      console.error('Error creando preferencia de pago:', error);
      throw error;
    }
  }
}