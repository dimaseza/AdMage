'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';

interface Generation {
  id: string;
  type: string;
  status: string;
  resultUrl: string | null;
  createdAt: string;
}

export default function GalleryPage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<{url: string, type: string} | null>(null);

  useEffect(() => {
    async function fetchGallery() {
      try {
        const res = await fetch('/api/gallery');
        const data = await res.json();
        if (data.success) {
          const flattened = data.generations.flatMap((gen: any) => {
            const urls = gen.resultUrls?.length > 0 ? gen.resultUrls : (gen.resultUrl ? [gen.resultUrl] : []);
            if (urls.length === 0) {
              return [gen]; // return the empty/failed generation
            }
            return urls.map((url: string, i: number) => ({
              ...gen,
              id: `${gen.id}-${i}`,
              resultUrl: url
            }));
          });
          setGenerations(flattened);
        }
      } catch (err) {
        console.error("Failed to load gallery", err);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchGallery();
  }, []);

  return (
    <div className={styles.container}>
      {selectedMedia && (
        <div 
          className={styles.lightbox} 
          onClick={() => setSelectedMedia(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
        >
          {selectedMedia.type === 'video' ? (
            <video src={selectedMedia.url} controls autoPlay style={{ maxHeight: '90vh', maxWidth: '90vw', borderRadius: '8px' }} />
          ) : (
            <img src={selectedMedia.url} alt="Expanded" style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain', borderRadius: '8px' }} />
          )}
        </div>
      )}

      <div className={styles.header}>
        <h1>Your Gallery</h1>
        <p>View and manage your generated content.</p>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Loading your masterpieces...</div>
      ) : generations.length === 0 ? (
        <div className={styles.empty}>
          <p>You haven't generated anything yet.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {generations.map((gen) => (
            <div key={gen.id} className={styles.card}>
              <div 
                className={styles.mediaContainer} 
                onClick={() => {
                  if (gen.status === 'COMPLETED' && gen.resultUrl) {
                    setSelectedMedia({ url: gen.resultUrl, type: gen.type });
                  }
                }}
                style={{ cursor: gen.status === 'COMPLETED' ? 'zoom-in' : 'default' }}
              >
                {gen.status === 'COMPLETED' && gen.resultUrl ? (
                  gen.type === 'video' ? (
                    <video src={gen.resultUrl} className={styles.media} />
                  ) : (
                    <img src={gen.resultUrl} alt={gen.type} className={styles.media} />
                  )
                ) : (
                  <div className={styles.placeholder}>
                    {gen.status === 'FAILED' ? 'Failed' : 'Processing...'}
                  </div>
                )}
              </div>
              <div className={styles.meta}>
                <span className={styles.typeBadge}>{gen.type.replace('-', ' ')}</span>
                <span className={styles.date}>
                  {new Date(gen.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
