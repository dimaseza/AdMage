import GenerationInterface from '@/components/GenerationInterface';

export default function CampaignPage() {
  return (
    <GenerationInterface 
      title="Campaign Concepts" 
      description="Instantly ideate massive multi-channel visual campaigns in seconds. (Image reference optional but recommended)"
      type="campaign"
      requiresImage={true}
    />
  );
}
