import GenerationInterface from '@/components/GenerationInterface';

export default function RefinePage() {
  return (
    <GenerationInterface 
      title="Refine Image" 
      description="Upscale and apply cinematic lighting to your raw assets. (Requires a base image to work from)"
      type="refine"
      requiresImage={true}
    />
  );
}
