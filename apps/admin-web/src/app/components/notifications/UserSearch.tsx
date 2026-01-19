'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Search, User as UserIcon, Check, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface User {
    user_id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    avatar_url: string | null
}

interface UserSearchProps {
    onSelect: (user: User | null) => void
    selectedUser: User | null
}

export default function UserSearch({ onSelect, selectedUser }: UserSearchProps) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<User[]>([])
    const [loading, setLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const wrapperRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        const searchUsers = async () => {
            if (query.length < 2) {
                setResults([])
                return
            }

            setLoading(true)

            // Split query into terms for better multi-word matching
            const terms = query.trim().split(/\s+/)
            let queryBuilder = supabase
                .from('profiles')
                .select('user_id, first_name, last_name, email, avatar_url')

            if (terms.length === 1) {
                // Single word search
                queryBuilder = queryBuilder.or(`first_name.ilike.%${terms[0]}%,last_name.ilike.%${terms[0]}%,email.ilike.%${terms[0]}%`)
            } else {
                // Multi-word search (e.g. "Juan Perez")
                // We'll try to match both first and last name combinations
                queryBuilder = queryBuilder.or(`and(first_name.ilike.%${terms[0]}%,last_name.ilike.%${terms[1]}%),and(first_name.ilike.%${terms[1]}%,last_name.ilike.%${terms[0]}%)`)
            }

            const { data, error } = await queryBuilder.limit(8)

            if (!error && data) {
                setResults(data)
                setIsOpen(true)
            }
            setLoading(false)
        }

        const timer = setTimeout(searchUsers, 300)
        return () => clearTimeout(timer)
    }, [query])

    return (
        <div ref={wrapperRef} className="relative">
            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Buscar Usuario</label>

            {selectedUser ? (
                <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center overflow-hidden">
                            {selectedUser.avatar_url ? (
                                <img src={selectedUser.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <UserIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            )}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                {selectedUser.first_name} {selectedUser.last_name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{selectedUser.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => onSelect(null)}
                        className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-md transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>
            ) : (
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Nombre, apellido o email..."
                        className="w-full h-12 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onFocus={() => query.length >= 2 && setIsOpen(true)}
                    />

                    {loading && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                        </div>
                    )}
                </div>
            )}

            <AnimatePresence>
                {isOpen && results.length > 0 && !selectedUser && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden"
                    >
                        {results.map((user) => (
                            <button
                                key={user.user_id}
                                onClick={() => {
                                    onSelect(user)
                                    setIsOpen(false)
                                    setQuery('')
                                }}
                                className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                            >
                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                                    {user.avatar_url ? (
                                        <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <UserIcon className="w-5 h-5 text-slate-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                        {user.first_name} {user.last_name}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                                </div>
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
