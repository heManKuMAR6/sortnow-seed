import { SeedArea } from '@sortnow/seed/react';
import draft from './seed/draft.json';
// Starts as []. Only a person adds to this file, after reviewing the exact draft. Never generate it from draft.json.
import approvals from './seed/reviewed-approvals.json';

export function CampaignHero({ children }) {
  return (
    <SeedArea experiences={[draft]} approvals={approvals} area="hero" mode="variables">
      {children}
    </SeedArea>
  );
}
