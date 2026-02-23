import 'server-only'
import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not defined')
}

const _resend = new Resend(process.env.RESEND_API_KEY)

export const resend = _resend
