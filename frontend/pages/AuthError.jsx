import React from 'react';

const AuthError = () => {
  const params = new URLSearchParams(window.location.search);
  const message = params.get('message') || 'Authentication failed';

  return (
    <main style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <section style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <h1>Authentication failed</h1>
        <p>{message}</p>
        <a href="/login" style={{ display: 'inline-block', marginTop: 16 }}>
          Try again
        </a>
      </section>
    </main>
  );
};

export default AuthError;
