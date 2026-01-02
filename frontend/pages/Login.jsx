import React, { useEffect, useState } from 'react';

const Login = () => {
  const [error, setError] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleLogin = async () => {
    try {
      setIsRedirecting(true);
      window.location.href = '/api/auth/okta/login';
    } catch (err) {
      setIsRedirecting(false);
      setError('Unable to start login flow. Please try again.');
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const message = params.get('message');
    if (message) {
      setError(message);
    }
  }, []);

  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <section style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <h1>Sign in</h1>
        <p>Use your Okta account to continue.</p>
        {isRedirecting && <p>Redirecting to Okta…</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button onClick={handleLogin} disabled={isRedirecting} style={{ marginTop: 16, padding: '12px 16px' }}>
          Sign in with Okta
        </button>
      </section>
    </main>
  );
};

export default Login;
