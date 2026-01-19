'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export function usePushNotifications() {
    const [isSupported, setIsSupported] = useState(false)
    const [subscription, setSubscription] = useState<PushSubscription | null>(null)

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true)
            registerServiceWorker()
        }
    }, [])

    const registerServiceWorker = async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js')
            const sub = await registration.pushManager.getSubscription()
            setSubscription(sub)
        } catch (err) {
            console.error('SW registration failed:', err)
        }
    }

    const subscribeUser = async (vapidPublicKey: string) => {
        try {
            const registration = await navigator.serviceWorker.ready
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidPublicKey
            })

            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                await supabase.from('push_subscriptions').insert({
                    user_id: user.id,
                    subscription: sub.toJSON()
                })
            }

            setSubscription(sub)
            return sub
        } catch (err) {
            console.error('Failed to subscribe:', err)
            return null
        }
    }

    return { isSupported, subscription, subscribeUser }
}
