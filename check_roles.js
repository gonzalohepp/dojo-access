const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function check() {
  const { data, error } = await supabase.from('profiles').select('role').limit(100)
  if (error) {
    console.error(error)
    return
  }
  const roles = data.reduce((acc, curr) => {
    acc[curr.role] = (acc[curr.role] || 0) + 1
    return acc
  }, {})
  console.log('Roles found:', roles)
}
check()
