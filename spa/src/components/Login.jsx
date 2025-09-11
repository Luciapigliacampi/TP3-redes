import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export default function Login() {
  const { setToken } = useAuth();
  const [email, setEmail] = useState('demo@x.com');
  const [password, setPassword] = useState('1234');
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      if (mode === 'register') {
        await api.register(email, password);
      }
      const { token } = await api.login(email, password);
      setToken(token);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{maxWidth:380, margin:'80px auto', fontFamily:'system-ui'}}>
      <h2>Login — Weather SPA</h2>
      <form onSubmit={onSubmit} style={{display:'grid', gap:8}}>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" />
        <button disabled={loading}>{mode === 'login' ? 'Ingresar' : 'Registrarse y entrar'}</button>
        <small style={{cursor:'pointer', color:'#06f'}} onClick={()=>setMode(mode==='login'?'register':'login')}>
          {mode==='login' ? 'Crear cuenta' : 'Ya tengo cuenta'}
        </small>
        {err && <div style={{color:'crimson'}}>{err}</div>}
      </form>
    </div>
  );
}
