import GenerationInterface from '@/components/GenerationInterface';

export default function VideoPage() {
  return (
    <GenerationInterface 
      title="Cinematic Video Ads" 
      description="Generate highly engaging, high-fidelity short-form videos tailored for social media."
      type="video"
      requiresImage={false}
    />
  );
}
