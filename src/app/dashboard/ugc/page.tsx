import GenerationInterface from '@/components/GenerationInterface';

export default function UgcPage() {
  return (
    <GenerationInterface
      title="UGC Creator"
      description="Generate authentic, creator-shot style videos — handheld, casual and native to TikTok, Reels and Shorts."
      type="ugc"
      requiresImage={false}
    />
  );
}
