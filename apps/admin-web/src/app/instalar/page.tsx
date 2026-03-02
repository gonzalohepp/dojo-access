'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Download,
    Share,
    PlusSquare,
    Smartphone,
    ChevronRight,
    CheckCircle2,
    ArrowRight,
    Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePWAInstall } from '@/hooks/usePWAInstall'
import Link from 'next/link'

export default function InstallPage() {
    const { canInstall, isInstalled, promptInstall } = usePWAInstall()
    const [os, setOs] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown')

    useEffect(() => {
        const ua = window.navigator.userAgent.toLowerCase()
        if (/iphone|ipad|ipod/.test(ua)) {
            setOs('ios')
        } else if (/android/.test(ua)) {
            setOs('android')
        } else {
            setOs('desktop')
        }
    }, [])

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent('https://belezadojo.com.ar/instalar')}`

    return (
        <div className="min-h-screen bg-slate-950 text-white selection:bg-blue-500/30">
            <div className="max-w-xl mx-auto px-6 py-12 md:py-20 flex flex-col items-center text-center">

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-12"
                >
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/20 mx-auto mb-6">
                        <img src="/logo.png" alt="Logo" className="w-12 h-12" />
                    </div>
                    <h1 className="text-4xl font-black tracking-tight mb-3 italic">BELEZA <span className="text-blue-500">APP</span></h1>
                    <p className="text-slate-400 font-medium">Instalá nuestra aplicación oficial para una mejor experiencia en el Dojo.</p>
                </motion.div>

                {/* Status Card */}
                <AnimatePresence mode="wait">
                    {isInstalled ? (
                        <motion.div
                            key="installed"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-[2.5rem] p-8 mb-8"
                        >
                            <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-500/30">
                                <CheckCircle2 className="w-10 h-10 text-white" />
                            </div>
                            <h2 className="text-2xl font-black mb-2 uppercase italic">¡App Instalada!</h2>
                            <p className="text-emerald-400 font-bold mb-6">Ya podés usar Beleza Dojo directo desde tu pantalla de inicio.</p>
                            <Button asChild className="w-full h-14 rounded-2xl bg-white text-slate-950 hover:bg-slate-100 font-black uppercase tracking-widest text-sm">
                                <Link href="/login">Ir al Login <ArrowRight className="w-5 h-5 ml-2" /></Link>
                            </Button>
                        </motion.div>
                    ) : (
                        <div className="w-full space-y-6">

                            {/* Android / Desktop Prompt */}
                            {(canInstall || os === 'android' || os === 'desktop') && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl"
                                >
                                    <div className="flex items-center gap-4 mb-6 text-left">
                                        <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center text-blue-400">
                                            <Download className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-lg uppercase tracking-tight italic">Descarga Directa</h3>
                                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Para Android y Chrome</p>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={promptInstall}
                                        className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
                                    >
                                        Instalar Aplicación
                                    </Button>

                                    {!canInstall && (
                                        <p className="mt-4 text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                                            <Info className="w-4 h-4" /> Si el botón no funciona, buscalo en el menú del navegador
                                        </p>
                                    )}
                                </motion.div>
                            )}

                            {/* iOS Guide */}
                            {os === 'ios' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl text-left"
                                >
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
                                            <Smartphone className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-lg uppercase tracking-tight italic">Instalar en iPhone</h3>
                                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Guía para Safari</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-black text-blue-400 shrink-0">1</div>
                                            <p className="text-slate-300 text-sm font-medium">Toca el botón <span className="text-white font-bold inline-flex items-center gap-1 mx-1 px-2 py-0.5 bg-white/10 rounded-md"><Share className="w-3.5 h-3.5" /> Compartir</span> al pie del navegador.</p>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-black text-blue-400 shrink-0">2</div>
                                            <p className="text-slate-300 text-sm font-medium">Desliza hacia arriba y selecciona <span className="text-white font-bold inline-flex items-center gap-1 mx-1 px-2 py-0.5 bg-white/10 rounded-md"><PlusSquare className="w-3.5 h-3.5" /> Agregar a inicio</span>.</p>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-black text-blue-400 shrink-0">3</div>
                                            <p className="text-slate-300 text-sm font-medium">Dale a <span className="text-blue-500 font-black tracking-widest uppercase mx-1">Agregar</span> arriba a la derecha.</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* QR Code (For desktop to mobile transfer) */}
                            {os === 'desktop' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-xl"
                                >
                                    <h3 className="font-black text-lg uppercase tracking-tight italic mb-6">Escaneá para bajar</h3>
                                    <div className="bg-white p-4 rounded-3xl w-48 h-48 mx-auto mb-6 shadow-2xl">
                                        <img src={qrUrl} alt="QR Code" className="w-full h-full" />
                                    </div>
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Apuntá tu cámara al código QR</p>
                                </motion.div>
                            )}

                        </div>
                    )}
                </AnimatePresence>

                {/* Footer removed */}
            </div>
        </div>
    )
}
