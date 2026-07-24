import { NextResponse } from 'next/server'

/**
 * Protege endpoints pensados para ser llamados por un cron externo o un
 * Database Webhook de Supabase (no por un usuario logueado en el admin).
 * Requiere el header `Authorization: Bearer <CRON_SECRET>`.
 */
export function requireCronSecret(req: Request) {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    console.error('[requireCronSecret] CRON_SECRET no está configurado en el servidor')
    return { error: NextResponse.json({ error: 'Server misconfigured' }, { status: 500 }) }
  }

  const header = req.headers.get('authorization')

  if (header !== `Bearer ${secret}`) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }

  return {}
}
