'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export function usePushNotifications() {
    const [isSupported, setIsSupported] = useState(false)
    const [subscription, setSubscription] = useState<PushSubscription | null>(null)

    const registerServiceWorker = async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js')
            const sub = await registration.pushManager.getSubscription()
            setSubscription(sub)
        } catch (err) {
            console.error('SW registration failed:', err)
        }
    }

    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true)
            registerServiceWorker()
        }
    }, [])

    const subscribeUser = async (vapidPublicKey: string) => {
        try {
            const registration = await navigator.serviceWorker.ready
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: vapidPublicKey
            })

            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                // Remove any old subscriptions for THIS same endpoint to keep it clean
                // The DB unique constraint will also catch this, but upsert is better
                await supabase.from('push_subscriptions').upsert({
                    user_id: user.id,
                    subscription: sub.toJSON(),
                    endpoint: sub.endpoint
                }, { onConflict: 'endpoint' })
            }

            setSubscription(sub)
            return sub
        } catch (err) {
            console.error('Failed to subscribe:', err)
            return null
        }
    }

    const unsubscribeUser = async () => {
        try {
            if (subscription) {
                await subscription.unsubscribe()
                await supabase.from('push_subscriptions').delete().match({ endpoint: subscription.endpoint })
                setSubscription(null)
                return true
            }
            return false
        } catch (err) {
            console.error('Failed to unsubscribe:', err)
            return false
        }
    }

    return { isSupported, subscription, subscribeUser, unsubscribeUser }
}
