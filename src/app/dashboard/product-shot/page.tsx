import GenerationInterface from '@/components/GenerationInterface';

export default function ProductShotPage() {
  return (
    <GenerationInterface 
      title="Product Shots" 
      description="Place your product in incredibly realistic lifestyle environments without ever booking a studio. (Requires a base image)"
      type="product-shot"
      requiresImage={true}
    />
  );
}
