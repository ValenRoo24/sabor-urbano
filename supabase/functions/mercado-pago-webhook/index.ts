import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const topic = url.searchParams.get("topic") || url.searchParams.get("type")
    
    // Solo procesamos eventos de tipo 'payment'
    if (topic === 'payment') {
      const paymentId = url.searchParams.get("data.id") || url.searchParams.get("id")
      const localId = url.searchParams.get("local_id") // Lo enviaremos desde el frontend

      if (paymentId && localId) {
        // 1. Obtener el token de Mercado Pago de ese local específico
        const { data: configData } = await supabase
          .from('configuracion')
          .select('mp_access_token')
          .eq('local_id', localId)
          .single()

        if (configData && configData.mp_access_token) {
          // 2. Consultar a Mercado Pago el detalle de este pago
          const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { 'Authorization': `Bearer ${configData.mp_access_token}` }
          })
          const paymentData = await mpResponse.json()

          // 3. Si está aprobado, actualizamos el pedido (external_reference tiene nuestro ID de pedido)
          if (paymentData.status === 'approved' && paymentData.external_reference) {
            await supabase
              .from('pedidos')
              .update({ estado: 'pendiente' })
              .eq('id', paymentData.external_reference)
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { 
      headers: { "Content-Type": "application/json" },
      status: 200 
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})