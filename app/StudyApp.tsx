'use client';

import { type ComponentType, useEffect, useState } from 'react';

export default function StudyApp() {
  const [Reader, setReader] = useState<ComponentType | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    import('../src/App')
      .then((module) => setReader(() => module.App))
      .catch(() => setFailed(true));
  }, []);
  if (Reader) return <Reader />;
  return (
    <main className="reading-shell" aria-busy={!failed}>
      <h1>Probability</h1>
      {failed ? (
        <p>
          The study pages could not load. <a href="/">Try again</a>.
        </p>
      ) : (
        <p role="status">Opening the course…</p>
      )}
    </main>
  );
}
